import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
import { jobSchema } from "../lib/validation.ts";
const db = new PGlite();
const ids = {
  seeker: "10000000-0000-4000-8000-000000000001",
  other: "10000000-0000-4000-8000-000000000002",
  owner: "10000000-0000-4000-8000-000000000003",
  outsider: "10000000-0000-4000-8000-000000000004",
  admin: "10000000-0000-4000-8000-000000000005",
};
let business, job, application;
async function as(who, fn) {
  await db.exec(`set role ${who === "anon" ? "anon" : "authenticated"}`);
  await db.query("select set_config('request.jwt.claim.sub',$1,false)", [
    ids[who] || "",
  ]);
  try {
    return await fn();
  } finally {
    await db.exec("reset role");
  }
}
before(async () => {
  await db.exec(`create role anon;create role authenticated;create schema auth;create schema storage;
 create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}');
 create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 grant usage on schema auth,storage to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
 create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
 create table storage.objects(id uuid default gen_random_uuid(),bucket_id text,name text);
 alter table storage.objects enable row level security;grant select,insert,delete on storage.objects to anon,authenticated;
 create function storage.foldername(text) returns text[] language sql immutable as $$select string_to_array($1,'/')$$;`);
  const files = (
    await readdir(new URL("../supabase/migrations/", import.meta.url))
  ).sort();
  for (const file of files)
    await db.exec(
      await readFile(
        new URL(`../supabase/migrations/${file}`, import.meta.url),
        "utf8",
      ),
    );
  for (const [key, id] of Object.entries(ids))
    await db.query(
      "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
      [
        id,
        JSON.stringify({
          full_name: key,
          account_type: ["owner", "outsider"].includes(key)
            ? "business_owner"
            : "jobseeker",
          role: "admin",
        }),
      ],
    );
  await db.query("update public.profiles set role='admin' where id=$1", [
    ids.admin,
  ]);
  business = (
    await as("owner", () =>
      db.query("select public.create_business($1) as id", [
        JSON.stringify({
          name: "Test Local Business",
          description:
            "A fictional business used for database authorization tests.",
          category: "Services",
          address: "Candelaria, Quezon",
          contact_email: "test@example.com",
        }),
      ]),
    )
  ).rows[0].id;
  job = (
    await as("owner", () =>
      db.query(
        "insert into public.jobs(business_id,title,description,employment_type,arrangement,location,category,deadline) values($1,'Test assistant','A meaningful test job description with enough detail.','Full-time','On-site','Candelaria','Administration',current_date+30) returning id",
        [business],
      ),
    )
  ).rows[0].id;
});
after(() => db.close());
let friendship;

test("job input normalizes empty deadlines and still rejects invalid dates", () => {
  const values = {
    business_id: ids.outsider,
    title: "Local design assistant",
    description: "Help our local design team with daily creative projects.",
    responsibilities: "",
    qualifications: "",
    employment_type: "Full-time",
    arrangement: "On-site",
    location: "Candelaria",
    category: "Design",
    salary_min: "0",
    salary_max: "0",
    vacancies: "1",
  };
  for (const deadline of [undefined, null, ""]) {
    assert.equal(jobSchema.parse({ ...values, deadline }).deadline, null);
  }
  assert.equal(
    jobSchema.parse({ ...values, deadline: "2028-02-29" }).deadline,
    "2028-02-29",
  );
  for (const deadline of ["not-a-date", "2026-02-29", "2026-13-01"]) {
    assert.equal(jobSchema.safeParse({ ...values, deadline }).success, false);
  }
});

test("job descriptions accept short text but still require nonblank content", () => {
  const description = jobSchema.shape.description;
  assert.equal(description.parse("Hiring"), "Hiring");
  assert.equal(description.parse("  Help our team  "), "Help our team");
  assert.equal(description.parse("x"), "x");
  assert.equal(description.parse("a".repeat(15000)).length, 15000);
  for (const value of [undefined, null, "", "   ", "\t\n", "a".repeat(15001)]) {
    assert.equal(description.safeParse(value).success, false);
  }
});
test("registration metadata cannot assign administrator privileges", async () => {
  const r = await db.query("select role from public.profiles where id=$1", [
    ids.seeker,
  ]);
  assert.equal(r.rows[0].role, "jobseeker");
});
test("anonymous users cannot see draft jobs, profiles, or business contacts", async () =>
  as("anon", async () => {
    assert.equal((await db.query("select * from public.jobs")).rows.length, 0);
    await assert.rejects(db.query("select * from public.profiles"));
    await assert.rejects(db.query("select * from public.business_contacts"));
  }));
test("profile owner can edit headline but cannot self-promote or suspend others", async () =>
  as("seeker", async () => {
    await db.query(
      "update public.profiles set headline='Local talent' where id=$1",
      [ids.seeker],
    );
    await assert.rejects(
      db.query("update public.profiles set role='admin' where id=$1", [
        ids.seeker,
      ]),
    );
    await assert.rejects(
      db.query("update public.profiles set suspended=true where id=$1", [
        ids.owner,
      ]),
    );
    assert.equal(
      (await db.query("select * from public.profiles")).rows.length,
      1,
    );
  }));
test("public profile is opt-in and exposes only the safe profile projection", async () => {
  await as("anon", async () => {
    const hidden = await db.query(
      "select public.get_public_profile($1) as profile",
      [ids.seeker],
    );
    assert.equal(hidden.rows[0].profile, null);
  });
  await as("seeker", () =>
    db.query(
      "update public.profiles set public_profile=true,cv_path=$2 where id=$1",
      [ids.seeker, `${ids.seeker}/private-resume.pdf`],
    ),
  );
  await as("other", async () => {
    const changed = await db.query(
      "update public.profiles set public_profile=true where id=$1 returning id",
      [ids.seeker],
    );
    assert.equal(changed.rows.length, 0);
  });
  await as("anon", async () => {
    const result = await db.query(
      "select public.get_public_profile($1) as profile",
      [ids.seeker],
    );
    const profile = result.rows[0].profile;
    assert.equal(profile.id, ids.seeker);
    assert.equal(profile.full_name, "seeker");
    assert.equal("cv_path" in profile, false);
    assert.equal("email" in profile, false);
  });
});
test("people search returns only safe, public, active profiles and honors search terms", async () => {
  await as("anon", async () => {
    const result = (
      await db.query("select public.search_people('SEEK',1) as result")
    ).rows[0].result;
    assert.equal(result.total, 1);
    assert.equal(result.people[0].id, ids.seeker);
    assert.deepEqual(
      Object.keys(result.people[0]).sort(),
      ["id", "full_name", "headline", "location", "avatar_path"].sort(),
    );
    assert.equal(
      (await db.query("select public.search_people('other',1) as result"))
        .rows[0].result.total,
      0,
    );
    assert.equal(
      (await db.query("select public.search_people('%',1) as result")).rows[0]
        .result.total,
      0,
    );
    await assert.rejects(db.query("select * from public.profiles"));
  });
  await db.query("update public.profiles set suspended=true where id=$1", [
    ids.seeker,
  ]);
  await as("anon", async () =>
    assert.equal(
      (await db.query("select public.search_people('seeker',1) as result"))
        .rows[0].result.total,
      0,
    ),
  );
  await db.query("update public.profiles set suspended=false where id=$1", [
    ids.seeker,
  ]);
  await as("seeker", () =>
    db.query("update public.profiles set public_profile=false where id=$1", [
      ids.seeker,
    ]),
  );
  await as("anon", async () =>
    assert.equal(
      (await db.query("select public.search_people('seeker',1) as result"))
        .rows[0].result.total,
      0,
    ),
  );
  await as("seeker", () =>
    db.query("update public.profiles set public_profile=true where id=$1", [
      ids.seeker,
    ]),
  );
});
test("people search excludes the caller without hiding them from other users", async () => {
  await as("seeker", async () => {
    const { result } = (
      await db.query("select public.search_people('seeker',1) as result")
    ).rows[0];
    assert.equal(result.total, 0);
    assert.deepEqual(result.people, []);
  });
  await as("other", async () => {
    const { result } = (
      await db.query("select public.search_people('seeker',1) as result")
    ).rows[0];
    assert.equal(result.total, 1);
    assert.equal(result.people[0].id, ids.seeker);
  });
});

test("people search pages are bounded and stable for signed-in callers", async () => {
  const created = await db.query(`insert into auth.users(id,raw_user_meta_data)
    select gen_random_uuid(),jsonb_build_object('full_name','PagingPerson ' || lpad(n::text,2,'0'))
    from generate_series(1,13) n returning id`);
  const fixtureIds = created.rows.map((row) => row.id);
  await db.query(
    "update public.profiles set public_profile=true where id=any($1::uuid[])",
    [fixtureIds],
  );
  await as("other", async () => {
    const first = (
      await db.query("select public.search_people('pagingperson',0) as result")
    ).rows[0].result;
    const second = (
      await db.query("select public.search_people('pagingperson',2) as result")
    ).rows[0].result;
    assert.equal(first.total, 13);
    assert.equal(first.people.length, 12);
    assert.equal(second.people.length, 1);
    assert.equal(first.people[0].full_name, "PagingPerson 01");
    assert.equal(second.people[0].full_name, "PagingPerson 13");
    assert.equal(
      first.people.some((person) => person.id === second.people[0].id),
      false,
    );
  });
  await db.query("delete from auth.users where id=any($1::uuid[])", [
    fixtureIds,
  ]);
});
test("unverified businesses cannot publish", async () =>
  as("owner", () =>
    assert.rejects(
      db.query("update public.jobs set status='published' where id=$1", [job]),
    ),
  ));
test("unrelated owners cannot edit or inspect another business private information", async () =>
  as("outsider", async () => {
    assert.equal(
      (await db.query("select * from public.business_contacts")).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "update public.jobs set title='Stolen opportunity' where id=$1 returning id",
          [job],
        )
      ).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.update_business($1,$2)", [
        JSON.stringify({ name: "Hijacked" }),
        business,
      ]),
    );
    await assert.rejects(
      db.query(
        "insert into public.business_members(business_id,user_id) values($1,$2)",
        [business, ids.outsider],
      ),
    );
  }));
test("only admin can approve; decision creates an immutable audit entry", async () => {
  await as("owner", () =>
    assert.rejects(
      db.query(
        "select public.moderate($1,'business','verified','Verified for integration testing')",
        [business],
      ),
    ),
  );
  await as("admin", () =>
    db.query(
      "select public.moderate($1,'business','verified','Verified for integration testing')",
      [business],
    ),
  );
  assert.equal(
    (await db.query("select * from public.audit_logs")).rows.length,
    1,
  );
  await as("admin", () =>
    assert.rejects(db.query("delete from public.audit_logs")),
  );
});
test("verified owner can publish; anonymous users can discover published jobs", async () => {
  await as("owner", () =>
    db.query("update public.jobs set status='published' where id=$1", [job]),
  );
  await as("anon", async () =>
    assert.equal((await db.query("select * from public.jobs")).rows.length, 1),
  );
});
test("public SQL search filters and paginates without bypassing RLS", async () =>
  as("anon", async () => {
    const found = await db.query(
      "select public.search_jobs('assistant','','','','newest',1) as results",
    );
    assert.equal(found.rows[0].results.total, 1);
    assert.equal(found.rows[0].results.jobs[0].id, job);
    const absent = await db.query(
      "select public.search_jobs('no-such-role','','','','newest',1) as results",
    );
    assert.equal(absent.rows[0].results.total, 0);
    assert.equal(
      (
        await db.query(
          "select public.search_jobs('','Part-time','','','newest',1) as results",
        )
      ).rows[0].results.total,
      0,
    );
  }));
test("reports are scoped to their author and administrators", async () => {
  await as("seeker", () =>
    db.query(
      "insert into public.reports(reporter_id,subject_type,subject_id,reason) values($1,'job',$2,'A meaningful moderation concern')",
      [ids.seeker, job],
    ),
  );
  await as("other", async () =>
    assert.equal(
      (await db.query("select * from public.reports")).rows.length,
      0,
    ),
  );
  await as("admin", async () =>
    assert.equal(
      (await db.query("select * from public.reports")).rows.length,
      1,
    ),
  );
  await as("seeker", () =>
    assert.rejects(
      db.query(
        "insert into public.reports(reporter_id,subject_type,subject_id,reason,status) values($1,'job',$2,'Attempt to skip moderation','resolved')",
        [ids.seeker, job],
      ),
    ),
  );
});
test("application requires owned CV; duplicate applications and forged statuses are denied", async () => {
  await as("seeker", async () => {
    await db.query(
      "insert into storage.objects(bucket_id,name) values('cvs',$1)",
      [`${ids.seeker}/resume.pdf`],
    );
    await assert.rejects(
      db.query(
        "insert into public.applications(job_id,applicant_id,cv_path) values($1,$2,$3)",
        [job, ids.seeker, `${ids.other}/resume.pdf`],
      ),
    );
    application = (
      await db.query(
        "insert into public.applications(job_id,applicant_id,cv_path) values($1,$2,$3) returning id",
        [job, ids.seeker, `${ids.seeker}/resume.pdf`],
      )
    ).rows[0].id;
    await assert.rejects(
      db.query(
        "insert into public.applications(job_id,applicant_id,cv_path) values($1,$2,$3)",
        [job, ids.seeker, `${ids.seeker}/resume.pdf`],
      ),
    );
    await assert.rejects(
      db.query("update public.applications set status='Accepted' where id=$1", [
        application,
      ]),
    );
  });
  assert.equal(
    (
      await db.query("select * from public.notifications where user_id=$1", [
        ids.owner,
      ])
    ).rows.length,
    1,
  );
});
test("applicant, authorized employer, and unrelated users have isolated application and CV access", async () => {
  await as("owner", async () => {
    assert.equal(
      (await db.query("select * from public.applications")).rows.length,
      1,
    );
    assert.equal(
      (await db.query("select * from storage.objects where bucket_id='cvs'"))
        .rows.length,
      1,
    );
    assert.equal(
      (
        await db.query("select * from public.profiles where id=$1", [
          ids.seeker,
        ])
      ).rows.length,
      1,
    );
  });
  for (const who of ["other", "outsider"])
    await as(who, async () => {
      assert.equal(
        (await db.query("select * from public.applications")).rows.length,
        0,
      );
      assert.equal(
        (await db.query("select * from storage.objects where bucket_id='cvs'"))
          .rows.length,
        0,
      );
    });
});
test("internal notes are invisible to applicant and unrelated employers", async () => {
  await as("owner", () =>
    db.query(
      "insert into public.applicant_notes(application_id,author_id,note) values($1,$2,'Private interview note')",
      [application, ids.owner],
    ),
  );
  for (const who of ["seeker", "outsider"])
    await as(who, async () =>
      assert.equal(
        (await db.query("select * from public.applicant_notes")).rows.length,
        0,
      ),
    );
});
test("employer status updates create applicant notifications; unrelated employers denied", async () => {
  await as("outsider", () =>
    assert.rejects(
      db.query("select public.change_application_status($1,'Shortlisted')", [
        application,
      ]),
    ),
  );
  await as("owner", () =>
    db.query("select public.change_application_status($1,'Under Review')", [
      application,
    ]),
  );
  await as("seeker", async () => {
    assert.equal(
      (await db.query("select * from public.notifications")).rows.length,
      1,
    );
    await assert.rejects(
      db.query("select public.change_application_status($1,'Accepted')", [
        application,
      ]),
    );
    await db.query("select public.change_application_status($1,'Withdrawn')", [
      application,
    ]);
  });
  await as("owner", () =>
    assert.rejects(
      db.query("select public.change_application_status($1,'Accepted')", [
        application,
      ]),
    ),
  );
});
test("bookmarks cannot be created or deleted for another user", async () => {
  await as("seeker", () =>
    db.query("insert into public.saved_jobs(user_id,job_id) values($1,$2)", [
      ids.seeker,
      job,
    ]),
  );
  await as("other", async () => {
    assert.equal(
      (await db.query("select * from public.saved_jobs")).rows.length,
      0,
    );
    assert.equal(
      (await db.query("delete from public.saved_jobs returning *")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("insert into public.saved_jobs(user_id,job_id) values($1,$2)", [
        ids.seeker,
        job,
      ]),
    );
  });
});
test("suspension revokes business operations; moderation unpublishes jobs", async () => {
  await as("admin", () =>
    db.query(
      "select public.moderate($1,'business','suspended','Suspended for test policy verification')",
      [business],
    ),
  );
  await as("anon", async () =>
    assert.equal((await db.query("select * from public.jobs")).rows.length, 0),
  );
  await as("admin", () =>
    db.query(
      "select public.moderate($1,'user','suspend','Suspended for test policy verification')",
      [ids.owner],
    ),
  );
  await as("owner", async () => {
    assert.equal(
      (await db.query("select * from public.applications")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.create_business($1)", [
        JSON.stringify({ name: "Blocked" }),
      ]),
    );
  });
});
test("development seed remains pending and non-public", async () => {
  await db.query("select set_config('request.jwt.claim.sub','',false)");
  await db.exec(
    await readFile(new URL("../supabase/seed.sql", import.meta.url), "utf8"),
  );
  const r = await db.query(
    "select verification_status from public.businesses where id='20000000-0000-4000-8000-000000000001'",
  );
  assert.equal(r.rows[0].verification_status, "pending");
  await as("anon", async () =>
    assert.equal((await db.query("select * from public.jobs")).rows.length, 0),
  );
});

test("friend requests require an active account, consent, and unique participants", async () => {
  await db.query("update public.profiles set public_profile=true where id=$1", [
    ids.other,
  ]);
  await as("anon", () =>
    assert.rejects(
      db.query("select public.friend_action($1,'request')", [ids.other]),
    ),
  );
  await as("seeker", async () => {
    await assert.rejects(
      db.query("select public.friend_action($1,'request')", [ids.seeker]),
    );
    await assert.rejects(
      db.query("select public.friend_action($1,'request')", [ids.owner]),
    );
    friendship = (
      await db.query("select public.friend_action($1,'request') as id", [
        ids.other,
      ])
    ).rows[0].id;
    await assert.rejects(
      db.query("select public.friend_action($1,'request')", [ids.other]),
    );
    await assert.rejects(
      db.query("select public.friend_action($1,'accept')", [ids.other]),
    );
    await assert.rejects(
      db.query(
        "insert into public.friendships(requester_id,recipient_id,status) values($1,$2,'accepted')",
        [ids.seeker, ids.outsider],
      ),
    );
  });
  await as("other", async () => {
    await assert.rejects(
      db.query("select public.friend_action($1,'request')", [ids.seeker]),
    );
    await assert.rejects(
      db.query("select public.friend_action($1,'cancel')", [ids.seeker]),
    );
  });
  for (const who of ["outsider", "admin"])
    await as(who, async () => {
      assert.equal(
        (await db.query("select * from public.friendships")).rows.length,
        0,
      );
      await assert.rejects(
        db.query("select public.connection_details($1)", [friendship]),
      );
    });
  await as("seeker", async () => {
    const peer = (await db.query("select public.list_connections() as data"))
      .rows[0].data.connections[0].peer;
    assert.equal(peer.id, ids.other);
    assert.equal("cv_path" in peer, false);
    assert.equal("role" in peer, false);
    assert.equal("email" in peer, false);
  });
});

test("messages require accepted friendship and remain private even from administrators", async () => {
  const messageId = "80000000-0000-4000-8000-000000000001";
  await as("seeker", () =>
    assert.rejects(
      db.query("select public.send_direct_message($1,$2,'Hello')", [
        friendship,
        messageId,
      ]),
    ),
  );
  await as("other", () =>
    db.query("select public.friend_action($1,'accept')", [ids.seeker]),
  );
  await as("seeker", async () => {
    await db.query("select public.send_direct_message($1,$2,'Hello')", [
      friendship,
      messageId,
    ]);
    await db.query("select public.send_direct_message($1,$2,'Hello')", [
      friendship,
      messageId,
    ]);
    assert.equal(
      (await db.query("select * from public.direct_messages")).rows.length,
      1,
    );
    await assert.rejects(
      db.query(
        "select public.send_direct_message($1,gen_random_uuid(),'   ')",
        [friendship],
      ),
    );
    await assert.rejects(
      db.query(
        "select public.send_direct_message($1,gen_random_uuid(),repeat('a',4001))",
        [friendship],
      ),
    );
    await assert.rejects(
      db.query(
        "insert into public.direct_messages(id,friendship_id,sender_id,body) values(gen_random_uuid(),$1,$2,'Forged')",
        [friendship, ids.other],
      ),
    );
    await assert.rejects(
      db.query("update public.direct_messages set body='Changed'"),
    );
    await assert.rejects(db.query("delete from public.direct_messages"));
  });
  await as("other", async () => {
    assert.equal(
      (
        await db.query("select public.conversation_messages($1) as data", [
          friendship,
        ])
      ).rows[0].data.messages[0].body,
      "Hello",
    );
    await assert.rejects(
      db.query("select public.send_direct_message($1,$2,'Hello')", [
        friendship,
        messageId,
      ]),
    );
  });
  for (const who of ["outsider", "admin"])
    await as(who, async () => {
      assert.equal(
        (await db.query("select * from public.direct_messages")).rows.length,
        0,
      );
      await assert.rejects(
        db.query("select public.conversation_messages($1)", [friendship]),
      );
      await assert.rejects(
        db.query(
          "select public.send_direct_message($1,gen_random_uuid(),'Intrusion')",
          [friendship],
        ),
      );
    });
  await as("anon", () =>
    assert.rejects(db.query("select * from public.direct_messages")),
  );
});

test("conversation history paginates without duplicates and unfriend stops sending", async () => {
  await as("seeker", async () => {
    for (let i = 0; i < 35; i++)
      await db.query(
        "select public.send_direct_message($1,gen_random_uuid(),$2)",
        [friendship, `Message ${i}`],
      );
    const latest = (
      await db.query("select public.conversation_messages($1) as data", [
        friendship,
      ])
    ).rows[0].data;
    assert.equal(latest.messages.length, 30);
    assert.equal(latest.has_more, true);
    const older = (
      await db.query("select public.conversation_messages($1,$2) as data", [
        friendship,
        latest.messages[0].id,
      ])
    ).rows[0].data;
    assert.equal(older.messages.length, 6);
    assert.equal(older.has_more, false);
    assert.equal(
      new Set([...latest.messages, ...older.messages].map((m) => m.id)).size,
      36,
    );
    await assert.rejects(
      db.query("select public.conversation_messages($1,gen_random_uuid())", [
        friendship,
      ]),
    );
  });
  await db.query("update public.profiles set suspended=true where id=$1", [
    ids.other,
  ]);
  await as("other", async () => {
    assert.equal(
      (await db.query("select * from public.direct_messages")).rows.length,
      0,
    );
    await assert.rejects(
      db.query("select public.conversation_messages($1)", [friendship]),
    );
  });
  await as("seeker", () =>
    assert.rejects(
      db.query(
        "select public.send_direct_message($1,gen_random_uuid(),'Blocked')",
        [friendship],
      ),
    ),
  );
  await db.query("update public.profiles set suspended=false where id=$1", [
    ids.other,
  ]);
  await as("seeker", async () => {
    await db.query("select public.friend_action($1,'remove')", [ids.other]);
    await assert.rejects(
      db.query(
        "select public.send_direct_message($1,gen_random_uuid(),'Blocked')",
        [friendship],
      ),
    );
    assert.equal(
      (
        await db.query("select public.conversation_messages($1) as data", [
          friendship,
        ])
      ).rows[0].data.messages.length,
      30,
    );
    await assert.rejects(
      db.query("select public.friend_action($1,'request')", [ids.other]),
    );
  });
});

test("outgoing requests can be canceled and recipients can decline", async () => {
  await as("outsider", async () => {
    await db.query("select public.friend_action($1,'request')", [ids.other]);
    await db.query("select public.friend_action($1,'cancel')", [ids.other]);
    assert.equal(
      (
        await db.query(
          "select status from public.friendships where requester_id=$1",
          [ids.outsider],
        )
      ).rows[0].status,
      "removed",
    );
  });
  await as("admin", () =>
    db.query("select public.friend_action($1,'request')", [ids.other]),
  );
  await as("other", () =>
    db.query("select public.friend_action($1,'decline')", [ids.admin]),
  );
  await as("admin", async () =>
    assert.equal(
      (
        await db.query(
          "select status from public.friendships where requester_id=$1",
          [ids.admin],
        )
      ).rows[0].status,
      "declined",
    ),
  );
});

let readConnection;
const readMessageIds = [1, 2, 3].map(
  (n) => `90000000-0000-4000-8000-00000000000${n}`,
);

test("activity counts belong to the caller and include incoming requests and unread messages", async () => {
  ids.reader = "20000000-0000-4000-8000-000000000001";
  ids.writer = "20000000-0000-4000-8000-000000000002";
  for (const name of ["reader", "writer"]) {
    await db.query(
      "insert into auth.users(id,raw_user_meta_data) values($1,$2)",
      [ids[name], JSON.stringify({ full_name: name })],
    );
  }
  await db.query("update public.profiles set public_profile=true where id=$1", [
    ids.writer,
  ]);
  await as("reader", async () => {
    readConnection = (
      await db.query("select public.friend_action($1,'request') as id", [
        ids.writer,
      ])
    ).rows[0].id;
  });
  await as("writer", async () => {
    const before = (await db.query("select public.account_activity() as data"))
      .rows[0].data;
    assert.deepEqual(before, { messages: 0, friends: 1, notifications: 1 });
    await db.query("select public.friend_action($1,'accept')", [ids.reader]);
    assert.equal(
      (await db.query("select public.account_activity() as data")).rows[0].data
        .friends,
      0,
    );
    await db.query(
      "update public.notifications set read=true where user_id=$1",
      [ids.writer],
    );
    assert.equal(
      (await db.query("select public.account_activity() as data")).rows[0].data
        .notifications,
      0,
    );
  });
  await as("reader", async () => {
    for (const id of readMessageIds)
      await db.query(
        "select public.send_direct_message($1,$2,'Hello from your friend')",
        [readConnection, id],
      );
    assert.equal(
      (await db.query("select public.account_activity() as data")).rows[0].data
        .messages,
      0,
    );
  });
  // Exercise the timestamp tie-breaker used by conversation history and read positions.
  await db.query(
    "update public.direct_messages set created_at='2000-01-01 12:00:00+00' where friendship_id=$1",
    [readConnection],
  );
  await as("writer", async () => {
    assert.equal(
      (await db.query("select public.account_activity() as data")).rows[0].data
        .messages,
      3,
    );
    const c = (await db.query("select public.list_connections() as data"))
      .rows[0].data.connections[0];
    assert.equal(c.unread_count, 3);
    assert.equal(c.last_message.id, readMessageIds[2]);
    assert.equal(c.last_message.body, "Hello from your friend");
  });
  for (const who of ["outsider", "admin"])
    await as(who, async () => {
      assert.equal(
        (await db.query("select public.account_activity() as data")).rows[0]
          .data.messages,
        0,
      );
      await assert.rejects(
        db.query("select public.mark_conversation_read($1,$2)", [
          readConnection,
          readMessageIds[2],
        ]),
      );
      await assert.rejects(
        db.query("select * from private.conversation_reads"),
      );
      await assert.rejects(
        db.query("select private.unread_message_count($1)", [readConnection]),
      );
    });
  await as("anon", async () => {
    await assert.rejects(db.query("select public.account_activity()"));
    await assert.rejects(
      db.query("select public.mark_conversation_read($1,$2)", [
        readConnection,
        readMessageIds[2],
      ]),
    );
  });
});

test("read positions advance only through the specified conversation and never move backwards", async () => {
  await as("writer", async () => {
    await assert.rejects(
      db.query("select public.mark_conversation_read($1,$2)", [
        readConnection,
        "80000000-0000-4000-8000-000000000001",
      ]),
    );
    await assert.rejects(
      db.query("select public.mark_conversation_read($1,gen_random_uuid())", [
        readConnection,
      ]),
    );
    await db.query("select public.mark_conversation_read($1,$2)", [
      readConnection,
      readMessageIds[1],
    ]);
    assert.equal(
      (await db.query("select public.account_activity() as data")).rows[0].data
        .messages,
      1,
    );
    await db.query("select public.mark_conversation_read($1,$2)", [
      readConnection,
      readMessageIds[0],
    ]);
    assert.equal(
      (await db.query("select public.account_activity() as data")).rows[0].data
        .messages,
      1,
    );
    await db.query("select public.mark_conversation_read($1,$2)", [
      readConnection,
      readMessageIds[2],
    ]);
    await db.query("select public.mark_conversation_read($1,$2)", [
      readConnection,
      readMessageIds[2],
    ]);
    assert.equal(
      (await db.query("select public.account_activity() as data")).rows[0].data
        .messages,
      0,
    );
    assert.equal(
      (await db.query("select public.list_connections() as data")).rows[0].data
        .connections[0].unread_count,
      0,
    );
  });
  // A later incoming message remains unread; writing a reply doesn't mark it read.
  await as("reader", () =>
    db.query(
      "select public.send_direct_message($1,gen_random_uuid(),'A later message')",
      [readConnection],
    ),
  );
  await as("writer", async () => {
    await db.query(
      "select public.send_direct_message($1,gen_random_uuid(),'My reply')",
      [readConnection],
    );
    assert.equal(
      (await db.query("select public.account_activity() as data")).rows[0].data
        .messages,
      1,
    );
  });
  await db.query("update public.profiles set suspended=true where id=$1", [
    ids.writer,
  ]);
  await as("writer", async () => {
    await assert.rejects(db.query("select public.account_activity()"));
    await assert.rejects(
      db.query("select public.mark_conversation_read($1,$2)", [
        readConnection,
        readMessageIds[2],
      ]),
    );
  });
  await db.query("update public.profiles set suspended=false where id=$1", [
    ids.writer,
  ]);
});

let evergreenBusiness, evergreenJob;
test("undated jobs can be saved, published, discovered, and applied to until closed", async () => {
  await as("outsider", async () => {
    evergreenBusiness = (
      await db.query("select public.create_business($1) as id", [
        JSON.stringify({
          name: "Evergreen Hiring",
          description:
            "A local business that accepts applications without a fixed deadline.",
          category: "Services",
          address: "Candelaria, Quezon",
          contact_email: "evergreen@example.test",
        }),
      ])
    ).rows[0].id;
    evergreenJob = (
      await db.query(
        `insert into public.jobs(business_id,title,description,employment_type,arrangement,location,category)
      values($1,'Evergreen local helper','Help our community team with daily local services.','Full-time','On-site','Candelaria','Services') returning id,deadline`,
        [evergreenBusiness],
      )
    ).rows[0];
    assert.equal(evergreenJob.deadline, null);
    // Omitting a deadline must not bypass business verification.
    await assert.rejects(
      db.query("update public.jobs set status='published' where id=$1", [
        evergreenJob.id,
      ]),
    );
  });
  await as("admin", () =>
    db.query(
      "select public.moderate($1,'business','verified','Verified evergreen hiring business')",
      [evergreenBusiness],
    ),
  );
  await as("outsider", () =>
    db.query("update public.jobs set status='published' where id=$1", [
      evergreenJob.id,
    ]),
  );
  await as("anon", async () => {
    const visible = (
      await db.query("select deadline from public.jobs where id=$1", [
        evergreenJob.id,
      ])
    ).rows;
    assert.equal(visible.length, 1);
    assert.equal(visible[0].deadline, null);
    const search = (
      await db.query(
        "select public.search_jobs('Evergreen local helper') as data",
      )
    ).rows[0].data;
    assert.equal(search.total, 1);
    assert.equal(search.jobs[0].id, evergreenJob.id);
    assert.equal(search.jobs[0].deadline, null);
  });
  await as("seeker", () =>
    db.query(
      "insert into public.applications(job_id,applicant_id,cv_path) values($1,$2,$3)",
      [evergreenJob.id, ids.seeker, `${ids.seeker}/resume.pdf`],
    ),
  );
  await as("outsider", () =>
    db.query("update public.jobs set status='closed' where id=$1", [
      evergreenJob.id,
    ]),
  );
  await as("anon", async () => {
    assert.equal(
      (
        await db.query("select * from public.jobs where id=$1", [
          evergreenJob.id,
        ])
      ).rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select public.search_jobs('Evergreen local helper') as data",
        )
      ).rows[0].data.total,
      0,
    );
  });
  await as("other", async () => {
    await db.query(
      "insert into storage.objects(bucket_id,name) values('cvs',$1)",
      [`${ids.other}/optional-deadline.pdf`],
    );
    await assert.rejects(
      db.query(
        "insert into public.applications(job_id,applicant_id,cv_path) values($1,$2,$3)",
        [evergreenJob.id, ids.other, `${ids.other}/optional-deadline.pdf`],
      ),
    );
  });
});

test("dated jobs retain expiry checks and an existing deadline can be cleared", async () => {
  let expiredJob;
  await as("outsider", async () => {
    await db.query(
      "update public.jobs set deadline=current_date+1,status='published' where id=$1",
      [evergreenJob.id],
    );
    await db.query("update public.jobs set deadline=null where id=$1", [
      evergreenJob.id,
    ]);
    assert.equal(
      (
        await db.query("select deadline from public.jobs where id=$1", [
          evergreenJob.id,
        ])
      ).rows[0].deadline,
      null,
    );
    await assert.rejects(
      db.query("update public.jobs set deadline=current_date-1 where id=$1", [
        evergreenJob.id,
      ]),
    );
    expiredJob = (
      await db.query(
        `insert into public.jobs(business_id,title,description,employment_type,arrangement,location,category,deadline)
      values($1,'Expired local helper','A historical listing used to verify application expiry.','Full-time','On-site','Candelaria','Services',current_date-1) returning id`,
        [evergreenBusiness],
      )
    ).rows[0].id;
    await assert.rejects(
      db.query("update public.jobs set status='published' where id=$1", [
        expiredJob,
      ]),
    );
  });
  // Simulate a previously published listing whose deadline has since passed.
  await db.exec("alter table public.jobs disable trigger valid_job");
  try {
    await db.query("update public.jobs set status='published' where id=$1", [
      expiredJob,
    ]);
  } finally {
    await db.exec("alter table public.jobs enable trigger valid_job");
  }
  await as("anon", async () => {
    assert.equal(
      (await db.query("select * from public.jobs where id=$1", [expiredJob]))
        .rows.length,
      0,
    );
    assert.equal(
      (
        await db.query(
          "select public.search_jobs('Expired local helper') as data",
        )
      ).rows[0].data.total,
      0,
    );
  });
  await as("other", () =>
    assert.rejects(
      db.query(
        "insert into public.applications(job_id,applicant_id,cv_path) values($1,$2,$3)",
        [expiredJob, ids.other, `${ids.other}/optional-deadline.pdf`],
      ),
    ),
  );
  await as("outsider", () =>
    db.query("update public.jobs set deadline=current_date where id=$1", [
      evergreenJob.id,
    ]),
  );
  await as("anon", async () =>
    assert.equal(
      (
        await db.query("select * from public.jobs where id=$1", [
          evergreenJob.id,
        ])
      ).rows.length,
      1,
    ),
  );
  await as("other", () =>
    db.query(
      "insert into public.applications(job_id,applicant_id,cv_path) values($1,$2,$3)",
      [evergreenJob.id, ids.other, `${ids.other}/optional-deadline.pdf`],
    ),
  );
});

test("owners can create and edit short descriptions while the database rejects blank or oversized content", async () => {
  let shortJob;
  await as("outsider", async () => {
    shortJob = (
      await db.query(
        `insert into public.jobs(business_id,title,description,employment_type,arrangement,location,category)
      values($1,'Short description role','Hiring','Full-time','On-site','Candelaria','Services') returning id`,
        [evergreenBusiness],
      )
    ).rows[0].id;
    await db.query(
      "update public.jobs set description='x',status='published' where id=$1",
      [shortJob],
    );
    for (const description of [null, "", "   ", "\t\n", "a".repeat(15001)]) {
      await assert.rejects(
        db.query("update public.jobs set description=$1 where id=$2", [
          description,
          shortJob,
        ]),
      );
    }
  });
  await as("anon", async () => {
    assert.equal(
      (
        await db.query("select description from public.jobs where id=$1", [
          shortJob,
        ])
      ).rows[0].description,
      "x",
    );
  });
  await as("seeker", async () => {
    assert.equal(
      (
        await db.query(
          "update public.jobs set description='Unauthorized change' where id=$1 returning id",
          [shortJob],
        )
      ).rows.length,
      0,
    );
  });
});
