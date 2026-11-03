import { redirect } from "next/navigation";
import { getViewer } from "./viewer";
export async function requireAccount(role?: string) {
  const { db, user, profile } = await getViewer();
  if (!db) return null;
  if (!user) redirect("/login");
  if (!profile || profile.suspended)
    redirect("/login?error=account-unavailable");
  if (role && profile.role !== role)
    redirect(
      profile.role === "admin"
        ? "/admin"
        : profile.role === "business_owner"
          ? "/business/dashboard"
          : "/dashboard",
    );
  return { db, user, profile };
}
