import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { PGlite } from "@electric-sql/pglite";
import { readFile, readdir } from "node:fs/promises";
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
