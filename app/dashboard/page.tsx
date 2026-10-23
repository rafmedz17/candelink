import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { requireAccount } from "@/lib/access";
import { DashboardLayout, SetupNeeded, Stats } from "@/components/dashboard";
import { PageTitle, JobCard } from "@/components/site";
import { getJobs } from "@/lib/data";
import {
  ActionForm,
  ProfileVisibility,
  QuickAction,
  PhotoUpload,
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
    .select("*, jobs(title,location,arrangement)")
    .eq("applicant_id", a.user.id)
    .order("created_at", { ascending: false });
  const { data: saved } = await a.db
    .from("saved_jobs")
    .select("*, jobs(title,location,arrangement,salary_min,salary_max)")
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
  const avatarUrl = p.avatar_path
    ? a.db.storage.from("avatars").getPublicUrl(p.avatar_path).data.publicUrl
    : null;
  const skills = String(p.skills || "")
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean);
  return (
    <DashboardLayout active={tab}>
      <PageTitle
        eyebrow="YOUR LOCAL CAREER COMPANION"
        title={
          tab === "overview"
            ? "Your professional profile"
            : `Welcome back, ${p.full_name?.split(" ")[0] || "neighbor"}.`
        }
        description={
          tab === "overview"
            ? "Shape the story local employers and connections see."
            : "A little progress today. New possibilities tomorrow."
        }
      />
      {tab === "overview" && (
        <>
          <section className="social-profile panel">
            <div className="social-profile-header" />
            <div className="social-profile-body">
              <div className="social-avatar">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={`${p.full_name || "User"}'s profile photo`}
                    width={112}
                    height={112}
                    unoptimized
                  />
                ) : (
                  <span aria-hidden="true">
                    {(p.full_name || "C").slice(0, 1).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="social-profile-heading">
                <div>
                  <h2>{p.full_name || "Your name"}</h2>
                  <p>{p.headline || "Add a professional headline"}</p>
                  <span>
                    <MapPin size={14} aria-hidden="true" /> {p.location}
                  </span>
                </div>
                <Link className="button small" href="/dashboard?tab=profile">
                  Edit profile
                </Link>
              </div>
              <div className="social-profile-copy">
                <h3>About</h3>
                <p>
                  {p.introduction ||
                    "Tell your community a little about yourself, your experience, and the kind of work you enjoy."}
                </p>
              </div>
              {skills.length > 0 && (
                <div className="social-profile-copy">
                  <h3>Skills</h3>
                  <div className="tags">
                    {skills.map((skill) => (
                      <span key={skill}>{skill}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </section>
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
          <div className="panel profile-completion">
            <h2>Your profile is {completion}% complete</h2>
            <p>
              Complete your details so people can understand your experience.
            </p>
            <div className="progress">
              <span style={{ width: `${completion}%` }} />
            </div>
            <Link className="text-link" href="/dashboard?tab=profile">
              {p.public_profile
                ? "Manage public profile"
                : "Finish your profile"}
            </Link>
          </div>
        </>
      )}
      {tab === "profile" && <PhotoUpload path={p.avatar_path} />}
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
        <>
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
          <ProfileVisibility
            profileId={a.user.id}
            isPublic={Boolean(p.public_profile)}
          />
        </>
      ) : tab === "saved" ? (
        <div className="panel">
          <h2>Saved for your next chapter</h2>
          {saved?.length ? (
            saved.map((s) => (
              <div className="record" key={s.job_id}>
                <Link href={`/jobs/${s.job_id}`}>
                  <strong>{s.jobs?.title || "Unavailable opportunity"}</strong>
                  {s.jobs && (
                    <p>
                      {s.jobs.location} · {s.jobs.arrangement}
                    </p>
                  )}
                </Link>
                <div className="record-actions">
                  <Link
                    className="button outline small"
                    href={`/jobs/${s.job_id}`}
                  >
                    View job
                  </Link>
                  <QuickAction
                    kind="save"
                    values={{ id: s.job_id, remove: true }}
                    label="Remove bookmark"
                  />
                </div>
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
              <div
                className={`record ${n.read ? "" : "record-unread"}`}
                key={n.id}
              >
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
                    Applied{" "}
                    {new Date(app.created_at).toLocaleDateString("en-PH")}
                    {app.jobs?.location ? ` · ${app.jobs.location}` : ""}
                  </p>
                  <p>
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
