import Link from "next/link";
import { requireAccount } from "@/lib/access";
import { DashboardLayout, SetupNeeded, Stats } from "@/components/dashboard";
import { PageTitle, JobCard } from "@/components/site";
import { getJobs } from "@/lib/data";
import {
  ActionForm,
  QuickAction,
  PhotoUpload,
  PrivateCvUpload,
} from "@/components/forms";
export default async function Dashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const a = await requireAccount();
  if (!a) return <SetupNeeded />;
  if (a.profile.role !== "jobseeker") {
    const { redirect } = await import("next/navigation");
    redirect(a.profile.role === "admin" ? "/admin" : "/business/dashboard");
  }
  const { tab = "overview" } = await searchParams;
  const { data: apps } = await a.db
    .from("applications")
    .select("*, jobs(title)")
    .eq("applicant_id", a.user.id)
    .order("created_at", { ascending: false });
  const { data: saved } = await a.db
    .from("saved_jobs")
    .select("*, jobs(title)")
    .eq("user_id", a.user.id);
  const { data: notifications } = await a.db
    .from("notifications")
    .select("*")
    .eq("user_id", a.user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const p = a.profile;
  const { jobs: recentJobs } =
    tab === "overview" ? await getJobs() : { jobs: [] };
  const completion = Math.round(
    ([
      p.full_name,
      p.headline,
      p.introduction,
      p.skills,
      p.education,
      p.experience,
    ].filter(Boolean).length /
      6) *
      100,
  );
  return (
    <DashboardLayout active={tab}>
      <PageTitle
        eyebrow="YOUR LOCAL CAREER COMPANION"
        title={`Welcome back, ${p.full_name?.split(" ")[0] || "neighbor"}.`}
        description="A little progress today. New possibilities tomorrow."
      />
      {tab === "overview" && (
        <>
          <Stats
            items={[
              { label: "Applications sent", value: apps?.length || 0 },
              { label: "Saved opportunities", value: saved?.length || 0 },
              {
                label: "Unread notifications",
                value: notifications?.filter((n) => !n.read).length || 0,
              },
            ]}
          />
          <div className="panel">
            <h2>Your story, coming together</h2>
            <p>
              Your profile is {completion}% complete. Help hiring teams get to
              know you.
            </p>
            <div className="progress">
              <span style={{ width: `${completion}%` }} />
            </div>
            <Link className="text-link" href="/dashboard?tab=profile">
              Complete your profile ↗
            </Link>
          </div>
        </>
      )}
      {tab === "profile" && <PhotoUpload path={p.avatar_path} />}
      {tab === "profile" && <PrivateCvUpload hasCv={Boolean(p.cv_path)} />}
      {tab === "overview" && recentJobs.length > 0 && (
        <section style={{ marginBottom: 25 }}>
          <h2 style={{ marginBottom: 20, fontSize: 20 }}>
            Fresh opportunities near you
          </h2>
          <div className="jobs-grid">
            {recentJobs.slice(0, 3).map((j) => (
              <JobCard job={j} key={j.id} />
            ))}
          </div>
        </section>
      )}
      {tab === "profile" ? (
        <div className="panel">
          <h2>Your professional profile</h2>
          <ActionForm
            kind="profile"
            fields={[
              {
                name: "full_name",
                label: "Full name",
                value: p.full_name,
                required: true,
              },
              {
                name: "headline",
                label: "Professional headline",
                value: p.headline,
              },
              { name: "location", label: "Location", value: p.location },
              {
                name: "introduction",
                label: "A little about you",
                type: "textarea",
                value: p.introduction,
              },
              {
                name: "skills",
                label: "Skills (comma separated)",
                value: p.skills,
              },
              {
                name: "education",
                label: "Education",
                type: "textarea",
                value: p.education,
              },
              {
                name: "experience",
                label: "Work experience",
                type: "textarea",
                value: p.experience,
              },
            ]}
          />
        </div>
      ) : tab === "saved" ? (
        <div className="panel">
          <h2>Saved for your next chapter</h2>
          {saved?.length ? (
            saved.map((s) => (
              <div className="record" key={s.job_id}>
                <Link href={`/jobs/${s.job_id}`}>
                  {s.jobs?.title || "Unavailable opportunity"}
                </Link>
                <QuickAction
                  kind="save"
                  values={{ id: s.job_id, remove: true }}
                  label="Remove bookmark"
                />
              </div>
            ))
          ) : (
            <p>
              No bookmarks yet. Browse jobs and save the ones that feel right.
            </p>
          )}
        </div>
      ) : tab === "notifications" ? (
        <div className="panel">
          <h2>Your notifications</h2>
          {notifications?.length ? (
            notifications.map((n) => (
              <div className="record" key={n.id}>
                <div>
                  <strong>{n.title}</strong>
                  <p>{n.body}</p>
                </div>
                {!n.read && (
                  <QuickAction
                    kind="read"
                    values={{ id: n.id }}
                    label="Mark read"
                  />
                )}
              </div>
            ))
          ) : (
            <p>You’re all caught up. Application updates will appear here.</p>
          )}
        </div>
      ) : (
        <div className="panel">
          <h2>Recent applications</h2>
          {apps?.length ? (
            apps.map((app) => (
              <div className="record" key={app.id}>
                <div>
                  <Link href={`/jobs/${app.job_id}`}>
                    <strong>{app.jobs?.title || "Job opportunity"}</strong>
                  </Link>
                  <p>
                    {new Date(app.created_at).toLocaleDateString("en-PH")} ·{" "}
                    <span className="badge">{app.status}</span>
                  </p>
                </div>
                {[
                  "Submitted",
                  "Under Review",
                  "Shortlisted",
                  "Interview",
                ].includes(app.status) && (
                  <QuickAction
                    kind="application-status"
                    values={{ id: app.id, status: "Withdrawn" }}
                    label="Withdraw"
                    confirm
                  />
                )}
              </div>
            ))
          ) : (
            <>
              <p>Your next chapter starts with your first application.</p>
              <Link className="button" style={{ marginTop: 20 }} href="/jobs">
                Find opportunities
              </Link>
            </>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
