import { requireAccount } from "@/lib/access";
import { DashboardLayout, SetupNeeded, Stats } from "@/components/dashboard";
import { PageTitle } from "@/components/site";
import { ActionForm } from "@/components/forms";
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
  const q = p.q?.toLowerCase() || "";
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
      <form
        className="hero-search"
        style={{ width: "100%", marginTop: 0, marginBottom: 25 }}
      >
        <input type="hidden" name="tab" value={tab} />
        <input
          name="q"
          defaultValue={p.q}
          placeholder="Search records"
          aria-label="Search administrative records"
          style={{ flex: 1 }}
        />
        <button className="button small">Search</button>
      </form>
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
          {businesses
            ?.filter((b) =>
              `${b.name} ${b.verification_status}`.toLowerCase().includes(q),
            )
            .map((b) => (
              <details className="panel" key={b.id}>
                <summary>
                  {b.name} · {b.verification_status}
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
                      label: "Recorded reason (at least 10 characters)",
                      type: "textarea",
                      required: true,
                    },
                  ]}
                  submit="Record decision"
                />
              </details>
            ))}
        </>
      )}
      {tab === "users" &&
        users
          ?.filter((u) => `${u.full_name} ${u.role}`.toLowerCase().includes(q))
          .map((u) => (
            <details className="panel" key={u.id}>
              <summary>
                {u.full_name || u.id} · {u.role} ·{" "}
                {u.suspended ? "Suspended" : "Active"}
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
                    label: "Recorded reason",
                    type: "textarea",
                    required: true,
                  },
                ]}
                submit="Update account"
              />
            </details>
          ))}
      {tab === "jobs" &&
        jobs
          ?.filter((j) => j.title.toLowerCase().includes(q))
          .map((j) => (
            <details className="panel" key={j.id}>
              <summary>
                {j.title} · {j.status}
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
                    label: "Recorded reason",
                    type: "textarea",
                    required: true,
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
                <summary>
                  {r.subject_type} · {r.status}
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
                      label: "Recorded reason",
                      type: "textarea",
                      required: true,
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
                      <td>
                        {new Date(l.created_at).toLocaleString("en-PH", {
                          timeZone: "Asia/Manila",
                        })}
                      </td>
                      <td>{l.action}</td>
                      <td>
                        {l.target_type} · {l.target_id}
                      </td>
                      <td>{l.reason}</td>
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
