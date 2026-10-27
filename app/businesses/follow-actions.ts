"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import type { Result } from "@/app/actions";
export async function followBusiness(
  id: string,
  following: boolean,
): Promise<Result> {
  if (!z.uuid().safeParse(id).success || typeof following !== "boolean")
    return { ok: false, message: "Invalid business." };
  try {
    const db = await supabase();
    if (!db)
      return { ok: false, message: "Following is currently unavailable." };
    const { data: auth } = await db.auth.getUser();
    if (!auth.user)
      return {
        ok: false,
        message: "Log in as a jobseeker to follow businesses.",
      };
    const { error } = await db.rpc("follow_business", { bid: id, following });
    if (error)
      return {
        ok: false,
        message: error.message.includes("Jobseeker")
          ? "Only active jobseekers can follow businesses."
          : error.message.includes("Daily action")
            ? "You've reached today's follow limit. Try again tomorrow."
            : "Couldn't update this follow. Please try again.",
      };
    revalidatePath(`/businesses/${id}`);
    return {
      ok: true,
      message: following
        ? "Following! You'll be notified when this business publishes a new job."
        : "Unfollowed. You won't receive new job alerts from this business.",
    };
  } catch {
    return { ok: false, message: "Check your connection and try again." };
  }
}
