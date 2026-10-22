import { redirect } from "next/navigation";
import { supabase } from "./supabase/server";
export async function requireAccount(role?: string) {
  const db = await supabase();
  if (!db) return null;
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();
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
