import { cache } from "react";
import { supabase } from "./supabase/server";

// Deduplicate reads within one server render only; never share sessions across requests.
export const getViewer = cache(async () => {
  const db = await supabase();
  if (!db) return { db: null, user: null, profile: null };
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { db, user: null, profile: null };
  const { data: profile } = await db
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();
  return { db, user, profile };
});
