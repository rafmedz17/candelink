import Link from "next/link";
import { Search } from "lucide-react";
import { requireAccount } from "@/lib/access";
import { DashboardLayout, SetupNeeded, Stats } from "@/components/dashboard";
import { PageTitle } from "@/components/site";
import { ActionForm, PhotoUpload } from "@/components/forms";
export default async function Admin({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const a = await requireAccount("admin");
  if (!a) return <SetupNeeded role="admin" />;
  const p = await searchParams,
    tab = p.tab || "overview";
  const [
    { data: businesses },
    { data: users },
    { data: jobs },
    { data: reports },
    { data: logs },
    { count },
  ] = await Promise.all([
    a.db.from("businesses").select("*,business_contacts(contact_email)"),
    a.db.from("profiles").select("id,full_name,role,suspended,created_at"),
    a.db.from("jobs").select("id,title,status,business_id"),
    a.db.from("reports").select("*"),
    a.db
      .from("audit_logs")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    a.db.from("applications").select("id", { head: true, count: "exact" }),
  ]);
  const { data: requests } = await a.db
    .from("business_verification_requests")
    .select("*,businesses(name)")
    .eq("status", "pending");
  const q = p.q?.trim().toLowerCase() || "";
  const role = ["jobseeker", "business_owner", "admin"].includes(p.role)
    ? p.role
    : "";
  const status = ["active", "suspended"].includes(p.status) ? p.status : "";
  const filteredUsers = (users || []).filter(
    (u) =>
      `${u.full_name} ${u.role}`.toLowerCase().includes(q) &&
      (!role || u.role === role) &&
      (!status || u.suspended === (status === "suspended")),
  );
  const filteredBusinesses = (businesses || []).filter((b) =>
    `${b.name} ${b.verification_status}`.toLowerCase().includes(q),
  );
  const visibleBusinesses =
    tab === "overview" ? filteredBusinesses.slice(0, 5) : filteredBusinesses;
  return (
    <DashboardLayout role="admin" active={tab}>
      <PageTitle
        eyebrow="CANDELINK ADMINISTRATION · RESTRICTED"
        title="A community worth looking after."
        description="Review businesses, protect applicants, and keep local connections trustworthy."
      />
      {tab === "overview" && (
        <Stats
          items={[
            { label: "Registered accounts", value: users?.length || 0 },
            {
              label: "Published jobs",
              value: jobs?.filter((j) => j.status === "published").length || 0,
            },
            { label: "Total applications", value: count || 0 },
          ]}
        />
      )}
      {tab === "profile" && (
        <>
          <PhotoUpload path={a.profile.avatar_path} />
          <div className="panel">
            <h2>Your administrator profile</h2>
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
                {
                  name: "skills",
                  label: "Skills (comma separated)",
                  value: a.profile.skills,
                },
                {
                  name: "education",
                  label: "Education",
                  type: "textarea",
                  value: a.profile.education,
                },
                {
                  name: "experience",
                  label: "Work experience",
                  type: "textarea",
                  value: a.profile.experience,
                },
              ]}
            />
          </div>
        </>
      )}
      {tab === "users" && (
        <form
          action="/admin"
          className="panel admin-user-filters"
          aria-label="Filter users"
        >
          <input type="hidden" name="tab" value="users" />
          <label>
            Search users
            <input name="q" defaultValue={p.q} placeholder="Name or role" />
          </label>
          <label>
            Role
            <select name="role" defaultValue={role}>
              <option value="">All roles</option>
              <option value="jobseeker">Jobseeker</option>
              <option value="business_owner">Business owner</option>
              <option value="admin">Admin</option>
            </select>
          </label>
          <label>
            Account status
            <select name="status" defaultValue={status}>
              <option value="">All statuses</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </label>
          <div className="admin-user-filter-actions">
            <button className="button" type="submit">
              Apply filters
            </button>
            {(q || role || status) && (
              <Link className="text-link" href="/admin?tab=users">
                Clear filters
              </Link>
            )}
          </div>
        </form>
      )}
      {tab !== "profile" && tab !== "users" && (
        <form
          className="hero-search page-search"
          style={{ width: "100%", marginTop: 0, marginBottom: 25 }}
        >
          <input type="hidden" name="tab" value={tab} />
          <Search size={20} aria-hidden="true" />
          <input
            name="q"
            defaultValue={p.q}
            placeholder="Search records"
            aria-label="Search administrative records"
          />
          <button className="button small">Search</button>
        </form>
      )}
      {["overview", "businesses"].includes(tab) && (
        <>
          <div className="panel">
            <h2>Pending verification · {requests?.length || 0}</h2>
            {requests?.map((r) => (
              <div className="record" key={r.id}>
                <strong>{r.businesses?.name}</strong>
                <span>
                  Requested {new Date(r.created_at).toLocaleDateString("en-PH")}
                </span>
              </div>
            ))}
            {!requests?.length && <p>The verification queue is clear.</p>}
          </div>
          <div className="workspace-list-heading">
            <div>
              <h2>
                {tab === "overview" ? "Recent business reviews" : "Businesses"}
              </h2>
              <p>
                {filteredBusinesses.length} matching business
                {filteredBusinesses.length === 1 ? "" : "es"}
              </p>
            </div>
            {tab === "overview" && filteredBusinesses.length > 5 && (
              <Link className="text-link" href="/admin?tab=businesses">
                Review all businesses
              </Link>
            )}
          </div>
          {visibleBusinesses.map((b) => (
            <details className="panel" key={b.id}>
              <summary className="review-summary">
                <span>{b.name}</span>
                <span
                  className={`badge status-badge status-badge--${b.verification_status}`}
                >
                  {b.verification_status}
                </span>
              </summary>
              <p>
                {b.description}
                <br />
                {b.address}
                <br />
                {b.business_contacts?.contact_email}
              </p>
              <ActionForm
                kind="moderate"
                hidden={{ target: "business", id: b.id }}
                fields={[
                  {
                    name: "decision",
                    label: "Decision",
                    options: ["verified", "rejected", "suspended", "pending"],
                  },
                  {
                    name: "reason",
                    label: "Recorded reason (optional)",
                    type: "textarea",
                  },
                ]}
                submit="Record decision"
              />
            </details>
          ))}
          {!visibleBusinesses.length && (
            <div className="empty-state">
              <h2>No matching businesses</h2>
              <p>Try a different search or check another review queue.</p>
            </div>
          )}
        </>
      )}
      {tab === "users" && (
        <>
          <p className="admin-user-result-count" role="status">
            {filteredUsers.length} matching{" "}
            {filteredUsers.length === 1 ? "user" : "users"}
          </p>
          {filteredUsers.map((u) => (
            <details className="panel" key={u.id}>
              <summary className="review-summary">
                <span>
                  {u.full_name || u.id}
                  <small>{u.role.replaceAll("_", " ")}</small>
                </span>
                <span
                  className={`badge status-badge status-badge--${u.suspended ? "suspended" : "verified"}`}
                >
                  {u.suspended ? "Suspended" : "Active"}
                </span>
              </summary>
              <ActionForm
                kind="moderate"
                hidden={{ target: "user", id: u.id }}
                fields={[
                  {
                    name: "decision",
                    label: "Account action",
                    options: ["suspend", "restore"],
                  },
                  {
                    name: "reason",
                    label: "Recorded reason (optional)",
                    type: "textarea",
                  },
                ]}
                submit="Update account"
              />
            </details>
          ))}
          {!filteredUsers.length && (
            <div className="empty-state">
              <h2>No matching users</h2>
              <p>Try another name, role, or account status.</p>
              <Link className="button outline" href="/admin?tab=users">
                Clear filters
              </Link>
            </div>
          )}
        </>
      )}
      {tab === "jobs" &&
        jobs
          ?.filter((j) => j.title.toLowerCase().includes(q))
          .map((j) => (
            <details className="panel" key={j.id}>
              <summary className="review-summary">
                <span>{j.title}</span>
                <span
                  className={`badge status-badge status-badge--${j.status}`}
                >
                  {j.status}
                </span>
              </summary>
              <ActionForm
                kind="moderate"
                hidden={{ target: "job", id: j.id }}
                fields={[
                  {
                    name: "decision",
                    label: "Action",
                    options: ["closed", "archived"],
                  },
                  {
                    name: "reason",
                    label: "Recorded reason (optional)",
                    type: "textarea",
                  },
                ]}
                submit="Unpublish job"
              />
            </details>
          ))}
      {tab === "reports" && (
        <div className="panel">
          <h2>Community reports</h2>
          {reports
            ?.filter((r) => `${r.reason} ${r.status}`.toLowerCase().includes(q))
            .map((r) => (
              <details className="panel" key={r.id}>
                <summary className="review-summary">
                  <span>Reported {r.subject_type}</span>
                  <span
                    className={`badge status-badge status-badge--${r.status}`}
                  >
                    {r.status}
                  </span>
                </summary>
                <p>{r.reason}</p>
                <p>Subject ID: {r.subject_id}</p>
                <ActionForm
                  kind="moderate"
                  hidden={{ target: "report", id: r.id }}
                  fields={[
                    {
                      name: "decision",
                      label: "Resolution",
                      options: ["resolved", "dismissed"],
                    },
                    {
                      name: "reason",
                      label: "Recorded reason (optional)",
                      type: "textarea",
                    },
                  ]}
                  submit="Resolve report"
                />
              </details>
            ))}
          {!reports?.length && <p>No reports to review.</p>}
        </div>
      )}
      {tab === "audit" && (
        <div className="panel">
          <h2>Administrative audit trail</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>When</th>
                  <th>Action</th>
                  <th>Target</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {logs
                  ?.filter((l) => JSON.stringify(l).toLowerCase().includes(q))
                  .map((l) => (
                    <tr key={l.id}>
                      <td data-label="When">
                        {new Date(l.created_at).toLocaleString("en-PH", {
                          timeZone: "Asia/Manila",
                        })}
                      </td>
                      <td data-label="Action">{l.action}</td>
                      <td data-label="Target">
                        {l.target_type} · {l.target_id}
                      </td>
                      <td data-label="Reason">
                        {l.reason || "No reason provided"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
