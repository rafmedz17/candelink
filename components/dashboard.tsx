import Link from "next/link";
import {
  LayoutDashboard,
  UserRound,
  Bookmark,
  BriefcaseBusiness,
  Bell,
  ShieldCheck,
  Flag,
  UsersRound,
  MessageCircle,
} from "lucide-react";
import { Header, PageTitle } from "./site";
import { ActivityBadge } from "./activity-badge";
export function DashboardLayout({
  children,
  role = "jobseeker",
  active = "overview",
  businessId,
}: {
  children: React.ReactNode;
  role?: string;
  active?: string;
  businessId?: string;
}) {
  const base =
    role === "business_owner"
      ? "/business/dashboard"
      : role === "admin"
        ? "/admin"
        : "/dashboard";
  const links =
    role === "jobseeker"
      ? [
          ["overview", "Dashboard", LayoutDashboard],
          ["applications", "Applications", BriefcaseBusiness],
          ["saved", "Saved jobs", Bookmark],
          ["notifications", "Notifications", Bell],
        ]
      : role === "admin"
        ? [
            ["overview", "Dashboard", LayoutDashboard],
            ["businesses", "Verification queue", ShieldCheck],
            ["users", "User management", UserRound],
            ["jobs", "Job management", BriefcaseBusiness],
            ["reports", "Reports", Flag],
            ["audit", "Audit logs", ShieldCheck],
          ]
        : [
            ["overview", "Dashboard", LayoutDashboard],
            ["jobs", "Manage jobs", BriefcaseBusiness],
            ["applicants", "Applicants", UserRound],
            ["notifications", "Notifications", Bell],
          ];
  return (
    <>
      <Header />
      <main id="main-content" className="page-bg workspace-page">
        <div className="container dashboard-shell">
          <nav className="dashboard-nav" aria-label="Workspace navigation">
            <span className="workspace-nav-label">
              {role === "admin"
                ? "Administration"
                : role === "business_owner"
                  ? "Business workspace"
                  : "My workspace"}
            </span>
            {links.map(([key, label, Icon]) => {
              const I = Icon as typeof LayoutDashboard;
              return (
                <Link
                  key={String(key)}
                  href={`${base}?tab=${key}${businessId ? `&business=${businessId}` : ""}`}
                  className={active === key ? "active" : ""}
                  aria-current={active === key ? "page" : undefined}
                >
                  <I size={18} />
                  {String(label)}
                  {key === "notifications" && (
                    <ActivityBadge kind="notifications" />
                  )}
                </Link>
              );
            })}
            <Link
              href="/friends"
              className={active === "friends" ? "active" : ""}
              aria-current={active === "friends" ? "page" : undefined}
            >
              <UsersRound size={18} />
              Friends
              <ActivityBadge kind="friends" />
            </Link>
            <Link
              href="/messages"
              className={active === "messages" ? "active" : ""}
              aria-current={active === "messages" ? "page" : undefined}
            >
              <MessageCircle size={18} />
              Messages
              <ActivityBadge kind="messages" />
            </Link>
          </nav>
          <div className="dashboard-content">{children}</div>
        </div>
      </main>
      <footer className="workspace-footer">
        <div className="container">
          <span>CANDELINK · Your local professional community</span>
          <div>
            <Link href="/privacy">Privacy</Link>
            <Link href="/terms">Terms</Link>
          </div>
        </div>
      </footer>
    </>
  );
}
export function SetupNeeded({ role = "jobseeker" }: { role?: string }) {
  return (
    <DashboardLayout role={role}>
      <PageTitle
        eyebrow="LET’S MAKE THE CONNECTION"
        title="Your workspace is almost ready."
        description="Supabase configuration is required to securely access this dashboard."
      />
      <div className="panel">
        <h2>Connect your project</h2>
        <p>
          Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
          to .env.local, apply the database migrations, then sign in. No private
          dashboard data is shown in demonstration mode.
        </p>
        <Link className="button" style={{ marginTop: 20 }} href="/jobs">
          Explore sample opportunities
        </Link>
      </div>
    </DashboardLayout>
  );
}
export function Stats({
  items,
}: {
  items: { label: string; value: number | string }[];
}) {
  return (
    <div className="stats">
      {items.map((i) => (
        <div className="stat" key={i.label}>
          <span>{i.label}</span>
          <strong>{i.value}</strong>
        </div>
      ))}
    </div>
  );
}
