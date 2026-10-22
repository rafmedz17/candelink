import Link from "next/link";
import {
  LayoutDashboard,
  UserRound,
  Bookmark,
  BriefcaseBusiness,
  Bell,
  Store,
  ShieldCheck,
  LogOut,
  Flag,
} from "lucide-react";
import { Header, Footer, PageTitle } from "./site";
import { logout } from "@/app/actions";
export function DashboardLayout({
  children,
  role = "jobseeker",
  active = "overview",
}: {
  children: React.ReactNode;
  role?: string;
  active?: string;
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
          ["overview", "Overview", LayoutDashboard],
          ["profile", "My profile", UserRound],
          ["applications", "Applications", BriefcaseBusiness],
          ["saved", "Saved jobs", Bookmark],
          ["notifications", "Notifications", Bell],
        ]
      : role === "admin"
        ? [
            ["overview", "Platform overview", LayoutDashboard],
            ["businesses", "Verification queue", ShieldCheck],
            ["users", "User management", UserRound],
            ["jobs", "Job management", BriefcaseBusiness],
            ["reports", "Reports", Flag],
            ["audit", "Audit logs", ShieldCheck],
          ]
        : [
            ["overview", "Hiring overview", LayoutDashboard],
            ["profile", "Business profile", Store],
            ["jobs", "Manage jobs", BriefcaseBusiness],
            ["applicants", "Applicants", UserRound],
            ["notifications", "Notifications", Bell],
          ];
  return (
    <>
      <Header />
      <main id="main-content" className="page-bg">
        <div className="container dashboard-shell">
          <aside className="dashboard-nav" aria-label="Dashboard navigation">
            {links.map(([key, label, Icon]) => {
              const I = Icon as typeof LayoutDashboard;
              return (
                <Link
                  key={String(key)}
                  href={`${base}?tab=${key}`}
                  className={active === key ? "active" : ""}
                >
                  <I size={18} />
                  {String(label)}
                </Link>
              );
            })}
            <form action={logout}>
              <button>
                <LogOut size={18} /> Log out
              </button>
            </form>
          </aside>
          <div>{children}</div>
        </div>
      </main>
      <Footer />
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
