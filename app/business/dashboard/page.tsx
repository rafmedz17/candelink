import Link from "next/link";
import Image from "next/image";
import { Store, Plus, Pencil, ArrowUpRight } from "lucide-react";
import { DeleteBusinessButton } from "@/components/delete-business-button";
import { requireAccount } from "@/lib/access";
import { DashboardLayout, SetupNeeded, Stats } from "@/components/dashboard";
import { PageTitle } from "@/components/site";
import { BusinessLocationPicker } from "@/components/business-location-picker";
import { BusinessCoverUpload } from "@/components/business-cover-upload";
import {
  ActionForm,
  QuickAction,
  CvButton,
  PhotoUpload,
  ProfileVisibility,
} from "@/components/forms";

const terminalApplicationStatuses = new Set([
  "Accepted",
  "Rejected",
  "Withdrawn",
]);

const statusSlug = (status: string) =>
  status.toLowerCase().replace(/[^a-z0-9]+/g, "-");

const statusBadgeClass = (status: string) =>
  `badge status-badge status-badge--${statusSlug(status)}`;

export default async function BusinessDashboard({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const a = await requireAccount("business_owner");
  if (!a) return <SetupNeeded role="business_owner" />;
  const p = await searchParams;
  const tab = p.tab || "overview";
  const { data: businesses, error: businessError } = await a.db
    .from("businesses")
    .select("*, business_members!inner(user_id)")
    .eq("business_members.user_id", a.user.id)
    .order("created_at");
  if (businessError)
    throw new Error("Your businesses could not be loaded. Please try again.");
  const creating = tab === "new-business";
  const directory = tab === "overview" && !p.business;
  const b =
    creating || directory
      ? undefined
      : p.business
        ? businesses?.find((x) => x.id === p.business)
        : businesses?.[0];
  if (p.business && !b && !creating)
    return (
      <DashboardLayout role="business_owner">
        <PageTitle
          eyebrow="YOUR BUSINESS WORKSPACE"
          title="Business unavailable"
          description="Choose one of your businesses to continue."
        />
        <Link className="button" href="/business/dashboard">
          My businesses
        </Link>
      </DashboardLayout>
    );
  const { data: jobs } =
    b && (["overview", "jobs", "new-job"].includes(tab) || p.edit)
      ? await a.db
          .from("jobs")
          .select("*")
          .eq("business_id", b.id)
          .order("created_at", { ascending: false })
      : { data: [] };
  const { data: apps } =
    b && ["overview", "applicants"].includes(tab)
      ? await a.db
          .from("applications")
          .select(
            "*,jobs!inner(title,business_id),profiles!applications_applicant_id_fkey(full_name,headline,skills,education,experience),applicant_notes(note)",
          )
          .eq("jobs.business_id", b.id)
          .order("created_at", { ascending: false })
      : { data: [] };
  const { data: notifications } =
    tab === "notifications"
      ? await a.db
          .from("notifications")
          .select("*")
          .eq("user_id", a.user.id)
          .order("created_at", { ascending: false })
          .limit(50)
      : { data: [] };
  const edit = jobs?.find((j) => j.id === p.edit);
  const dashboardHref = (
    nextTab: string,
    extra: Record<string, string | undefined> = {},
    businessId = b?.id,
  ) => {
    const query = new URLSearchParams({ tab: nextTab });
    if (businessId) query.set("business", businessId);
    for (const [key, value] of Object.entries(extra)) {
      if (value) query.set(key, value);
    }
    return `?${query.toString()}`;
  };
  const filteredApps = (apps || []).filter(
    (app) => !p.status || app.status === p.status,
  );
  return (
    <DashboardLayout role="business_owner" active={tab} businessId={b?.id}>
      <PageTitle
        eyebrow="LOCAL TALENT. YOUR NEXT GREAT TEAM."
        title={creating ? "Add a business" : b ? b.name : "Your businesses"}
        description={
          b
            ? `Verification: ${b.verification_status}. Manage your profile and build your team.`
            : "Manage each business, build your teams, and grow locally."
        }
      />
      {!directory && !creating && businesses && businesses.length > 1 && (
        <div className="tags">
          {businesses.map((x) => (
            <Link
              className="badge"
              key={x.id}
              href={dashboardHref(
                tab,
                tab === "applicants" ? { status: p.status } : {},
                x.id,
              )}
            >
              {x.name}
            </Link>
          ))}
        </div>
      )}
      <div className="business-dashboard-toolbar">
        {!directory && (
          <Link className="text-link" href="/business/dashboard">
            All businesses
          </Link>
        )}
        <Link className="button small" href="?tab=new-business">
          <Plus size={16} /> Add business
        </Link>
      </div>
      {directory && (
        <>
          <Stats
            items={[
              { label: "My businesses", value: businesses?.length || 0 },
              {
                label: "Verified businesses",
                value:
                  businesses?.filter(
                    (x) => x.verification_status === "verified",
                  ).length || 0,
              },
            ]}
          />
          {businesses?.length ? (
            <div className="owner-business-grid">
              {businesses.map((business) => (
                <article
                  className="panel owner-business-card"
                  key={business.id}
                >
                  <div className="owner-business-card-heading">
                    <div className="owner-business-logo">
                      {business.logo_path ? (
                        <Image
                          src={
                            process.env.NEXT_PUBLIC_SUPABASE_URL +
                            "/storage/v1/object/public/avatars/" +
                            business.logo_path
                          }
                          alt=""
                          width={64}
                          height={64}
                          unoptimized
                        />
                      ) : (
                        <Store size={28} />
                      )}
                    </div>
                    <span
                      className={statusBadgeClass(business.verification_status)}
                    >
                      {business.verification_status}
                    </span>
                  </div>
                  <h2>{business.name}</h2>
                  <p>{business.category}</p>
                  <p>{business.address}</p>
                  <div className="owner-business-card-actions">
                    <Link
                      className="button small"
                      href={dashboardHref("overview", {}, business.id)}
                    >
                      Manage <ArrowUpRight size={16} />
                    </Link>
                    <Link
                      className="button outline small"
                      href={dashboardHref("profile", {}, business.id)}
                    >
                      <Pencil size={15} /> Edit
                    </Link>
                    <DeleteBusinessButton
                      id={business.id}
                      name={business.name}
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="panel">
              <h2>Introduce your first business</h2>
              <p>Create a business profile to start building your team.</p>
              <Link className="button" href="?tab=new-business">
                Add business
              </Link>
            </div>
          )}
        </>
      )}
      {b && (
        <section
          className={`workspace-status workspace-status-${b.verification_status}`}
        >
          <div>
            <span>Business status</span>
            <strong>
              {b.verification_status === "verified"
                ? "Verified and ready to hire"
                : b.verification_status === "pending"
                  ? "Awaiting verification"
                  : `Verification ${b.verification_status}`}
            </strong>
            <p>
              {b.verification_status === "verified"
                ? "Your business can publish local opportunities."
                : "Complete your business details and request a review before publishing jobs."}
            </p>
          </div>
          <Link
            className="button small"
            href={dashboardHref(
              b.verification_status === "verified" ? "new-job" : "profile",
            )}
          >
            {b.verification_status === "verified"
              ? "Post a job"
              : "View business profile"}
          </Link>
        </section>
      )}
      {tab === "overview" && b && (
        <>
          <Stats
            items={[
              {
                label: "Active listings",
                value:
                  jobs?.filter((j) => j.status === "published").length || 0,
              },
              { label: "Total applications", value: apps?.length || 0 },
              {
                label: "Shortlisted candidates",
                value:
                  apps?.filter((x) => x.status === "Shortlisted").length || 0,
              },
            ]}
          />
          <div className="panel">
            <h2>Ready to meet your next team member?</h2>
            <p>
              Only verified businesses can publish jobs. You can prepare draft
              listings while your profile is being reviewed.
            </p>
            <Link
              className="button"
              style={{ marginTop: 20 }}
              href={dashboardHref("new-job")}
            >
              Post a job ↗
            </Link>
          </div>
          <div className="panel">
            <h2>Applications by status</h2>
            {[
              "Submitted",
              "Under Review",
              "Shortlisted",
              "Interview",
              "Accepted",
              "Rejected",
            ].map((s) => (
              <div className="record" key={s}>
                <span>{s}</span>
                <strong>
                  {apps?.filter((x) => x.status === s).length || 0}
                </strong>
              </div>
            ))}
          </div>
        </>
      )}
      {tab === "profile" && b && (
        <>
          <PhotoUpload key={b.id} path={b.logo_path} businessId={b.id} />
          <BusinessCoverUpload
            key={b.id}
            businessId={b.id}
            paths={b.cover_paths || []}
          />
        </>
      )}
      {tab === "profile" && (
        <>
          <ProfileVisibility
            profileId={a.user.id}
            isPublic={Boolean(a.profile.public_profile)}
          />
          <details className="panel">
            <summary>Your professional profile</summary>
            <PhotoUpload path={a.profile.avatar_path} />
            <ActionForm
              kind="profile"
              fields={[
                {
                  name: "full_name",
                  label: "Full name",
                  value: a.profile.full_name,
                  required: true,
                },
                {
                  name: "headline",
                  label: "Professional headline",
                  value: a.profile.headline,
                },
                {
                  name: "location",
                  label: "Location",
                  value: a.profile.location,
                },
                {
                  name: "introduction",
                  label: "A little about you",
                  type: "textarea",
                  value: a.profile.introduction,
                },
              ]}
            />
          </details>
        </>
      )}
      {(tab === "profile" || creating) && (
        <div className="panel">
          <h2>{b ? "Business details" : "Create your business"}</h2>
          <ActionForm
            kind="business"
            key={b?.id || "new-business"}
            successHref={b ? undefined : "/business/dashboard"}
            submit={b ? "Save changes" : "Create business"}
            hidden={b ? { id: b.id } : {}}
            fields={[
              {
                name: "name",
                label: "Business name",
                value: b?.name,
                required: true,
              },
              {
                name: "category",
                label: "Category",
                value: b?.category,
                required: true,
              },
              {
                name: "description",
                label: "About your business (optional)",
                type: "textarea",
                value: b?.description,
              },
              {
                name: "address",
                label: "Business address",
                value: b?.address,
                required: true,
              },
              {
                name: "public_email",
                label: "Public contact email (optional)",
                type: "email",
                value: b?.public_email,
              },
              {
                name: "public_phone",
                label: "Public contact number (optional)",
                type: "tel",
                value: b?.public_phone,
              },
              {
                name: "operating_details",
                label: "Operating details (optional)",
                type: "textarea",
                value: b?.operating_details,
              },
            ]}
          />
          {b && b.verification_status !== "verified" && (
            <div style={{ marginTop: 25 }}>
              <h3>Verification</h3>
              <p>
                Submit your business profile for administrator review. Any email
                or phone number you provide above will be visible on your public
                business profile.
              </p>
              <QuickAction
                kind="verify"
                values={{ id: b.id }}
                label="Request verification"
              />
            </div>
          )}
        </div>
      )}
      {tab === "profile" && b && (
        <BusinessLocationPicker
          key={b.id}
          businessId={b.id}
          latitude={b.latitude}
          longitude={b.longitude}
        />
      )}
      {(tab === "new-job" || p.edit) && b && (
        <div className="panel">
          <h2>{edit ? "Edit opportunity" : "Create an opportunity"}</h2>
          <p>
            Leave the deadline blank to accept applications until you close the
            listing.
          </p>
          <ActionForm
            kind="job"
            hidden={{ business_id: b.id, ...(edit ? { id: edit.id } : {}) }}
            fields={[
              {
                name: "title",
                label: "Job title",
                value: edit?.title,
                required: true,
              },
              {
                name: "description",
                label: "Description",
                type: "textarea",
                value: edit?.description,
                required: true,
              },
              {
                name: "responsibilities",
                label: "Responsibilities",
                type: "textarea",
                value: edit?.responsibilities,
              },
              {
                name: "qualifications",
                label: "Qualifications",
                type: "textarea",
                value: edit?.qualifications,
              },
              {
                name: "category",
                label: "Category",
                value: edit?.category,
                required: true,
              },
              {
                name: "employment_type",
                label: "Employment type",
                options: ["Full-time", "Part-time", "Contract", "Internship"],
                value: edit?.employment_type,
              },
              {
                name: "arrangement",
                label: "Work arrangement",
                options: ["On-site", "Hybrid", "Remote"],
                value: edit?.arrangement,
              },
              {
                name: "location",
                label: "Location",
                value: edit?.location || "Candelaria, Quezon",
                required: true,
              },
              {
                name: "salary_min",
                label: "Minimum monthly salary (PHP)",
                type: "number",
                value: edit?.salary_min || 0,
              },
              {
                name: "salary_max",
                label: "Maximum monthly salary (PHP)",
                type: "number",
                value: edit?.salary_max || 0,
              },
              {
                name: "vacancies",
                label: "Number of vacancies",
                type: "number",
                value: edit?.vacancies || 1,
              },
              {
                name: "deadline",
                label: "Application deadline (optional)",
                type: "date",
                value: edit?.deadline ?? "",
              },
            ]}
            submit="Save draft / changes"
          />
        </div>
      )}
      {["jobs", "overview"].includes(tab) && b && !p.edit && (
        <div className="panel">
          <div className="section-heading">
            <h2>Job listings</h2>
            <Link className="button small" href={dashboardHref("new-job")}>
              Post a job ↗
            </Link>
          </div>
          {jobs?.length ? (
            jobs.map((j) => (
              <article
                className={`record job-listing-card job-listing-card--${statusSlug(
                  j.status,
                )}`}
                key={j.id}
              >
                <div className="job-listing-card-content">
                  <div className="job-listing-card-heading">
                    <strong>{j.title}</strong>
                    <span className={statusBadgeClass(j.status)}>
                      {j.status}
                    </span>
                  </div>
                  <p className="job-listing-card-meta">
                    {j.employment_type} · {j.arrangement} · {j.location}
                  </p>
                  <Link
                    className="text-link"
                    href={dashboardHref("jobs", { edit: j.id })}
                  >
                    Edit listing
                  </Link>
                  <details
                    className="job-listing-preview"
                    style={{ marginTop: 12 }}
                  >
                    <summary>Preview listing</summary>
                    <h3>{j.title}</h3>
                    <p style={{ whiteSpace: "pre-line" }}>{j.description}</p>
                    <p>
                      {j.employment_type} · {j.arrangement} · {j.location}
                    </p>
                    <p>Responsibilities: {j.responsibilities}</p>
                    <p>Qualifications: {j.qualifications}</p>
                    <p>Deadline: {j.deadline || "No deadline"}</p>
                  </details>
                </div>
                <div className="tags job-listing-actions">
                  {j.status !== "published" && (
                    <QuickAction
                      kind="job-status"
                      values={{ id: j.id, status: "published" }}
                      label="Publish"
                    />
                  )}
                  {j.status === "published" && (
                    <QuickAction
                      kind="job-status"
                      values={{ id: j.id, status: "closed" }}
                      label="Close"
                      confirm
                    />
                  )}
                  {j.status !== "archived" && (
                    <QuickAction
                      kind="job-status"
                      values={{ id: j.id, status: "archived" }}
                      label="Archive"
                      confirm
                    />
                  )}
                </div>
              </article>
            ))
          ) : (
            <p>No listings yet. Start with a draft.</p>
          )}
        </div>
      )}
      {tab === "applicants" && (
        <>
          <form
            action="/business/dashboard"
            className="panel applicant-filter"
            method="get"
          >
            <input type="hidden" name="tab" value="applicants" />
            {b && <input type="hidden" name="business" value={b.id} />}
            <label>
              Status{" "}
              <select name="status" defaultValue={p.status || ""}>
                <option value="">All applications</option>
                {[
                  "Submitted",
                  "Under Review",
                  "Shortlisted",
                  "Interview",
                  "Accepted",
                  "Rejected",
                  "Withdrawn",
                ].map((s) => (
                  <option key={s}>{s}</option>
                ))}
              </select>
            </label>
            <button className="button small" style={{ marginTop: 15 }}>
              Filter applicants
            </button>
          </form>
          {filteredApps.length ? (
            filteredApps.map((app) => {
              const isFinal = terminalApplicationStatuses.has(app.status);
              return (
                <article
                  className={`panel applicant-card applicant-card--${statusSlug(
                    app.status,
                  )}`}
                  key={app.id}
                >
                  <header className="applicant-card-header">
                    <div>
                      <h2>{app.profiles?.full_name || "Applicant"}</h2>
                      {app.profiles?.headline && (
                        <p className="applicant-card-headline">
                          {app.profiles.headline}
                        </p>
                      )}
                      <p className="applicant-card-job">
                        {app.jobs?.title || "Job opportunity"}
                      </p>
                    </div>
                    <span className={statusBadgeClass(app.status)}>
                      {app.status}
                    </span>
                  </header>
                  <div className="applicant-card-actions">
                    <CvButton id={app.id} />
                    {isFinal ? (
                      <p className="application-status-read-only">
                        This application is final and can no longer be updated.
                      </p>
                    ) : (
                      <div className="applicant-status-action">
                        <ActionForm
                          kind="application-status"
                          hidden={{ id: app.id }}
                          fields={[
                            {
                              name: "status",
                              label: "Application status",
                              options: [
                                "Under Review",
                                "Shortlisted",
                                "Interview",
                                "Accepted",
                                "Rejected",
                              ],
                              value: app.status,
                            },
                          ]}
                          submit="Update status"
                        />
                      </div>
                    )}
                  </div>
                  <details className="applicant-card-details">
                    <summary>View application details</summary>
                    <div className="applicant-card-detail-content">
                      <section>
                        <h3>Skills</h3>
                        <p>{app.profiles?.skills || "Not provided."}</p>
                      </section>
                      <section>
                        <h3>Education</h3>
                        <p>{app.profiles?.education || "Not provided."}</p>
                      </section>
                      <section>
                        <h3>Experience</h3>
                        <p>{app.profiles?.experience || "Not provided."}</p>
                      </section>
                      <section>
                        <h3>Cover letter</h3>
                        <p>{app.cover_letter || "No cover letter provided."}</p>
                      </section>
                      <details className="applicant-card-subsection">
                        <summary>Report this account</summary>
                        <ActionForm
                          kind="report"
                          hidden={{
                            subject_type: "user",
                            subject_id: app.applicant_id,
                          }}
                          fields={[
                            {
                              name: "reason",
                              label: "Reason for reporting",
                              type: "textarea",
                              required: true,
                            },
                          ]}
                          submit="Send report"
                        />
                      </details>
                      <details className="applicant-card-subsection">
                        <summary>Private hiring notes</summary>
                        <ActionForm
                          kind="note"
                          hidden={{ application_id: app.id }}
                          fields={[
                            {
                              name: "note",
                              label:
                                "Internal note · visible to this business only",
                              type: "textarea",
                              value: app.applicant_notes?.note || "",
                            },
                          ]}
                        />
                      </details>
                    </div>
                  </details>
                </article>
              );
            })
          ) : (
            <div className="panel applicant-empty-state">
              <h2>
                {p.status
                  ? `No ${p.status.toLowerCase()} applications`
                  : "No applications yet"}
              </h2>
              <p>
                {p.status
                  ? "Try another status or clear the filter to see every applicant."
                  : "Applications will appear here when candidates apply to your jobs."}
              </p>
              {p.status && (
                <Link className="text-link" href={dashboardHref("applicants")}>
                  Clear status filter
                </Link>
              )}
            </div>
          )}
        </>
      )}
      {tab === "notifications" && (
        <div className="panel">
          <h2>Hiring updates</h2>
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
            <p>Your notifications will appear here.</p>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
