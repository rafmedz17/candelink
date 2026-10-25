"use server";

import { createClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { supabase } from "@/lib/supabase/server";
import type { Result } from "@/app/actions";

export async function deleteUser(target: string): Promise<Result> {
  if (!z.uuid().safeParse(target).success)
    return { ok: false, message: "Invalid account." };
  try {
    const db = await supabase();
    if (!db) return { ok: false, message: "Account services are unavailable." };
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { ok: false, message: "Please log in." };
    if (user.id === target)
      return { ok: false, message: "You cannot delete your own account." };
    const { data: actor, error: actorError } = await db
      .from("profiles")
      .select("role,suspended")
      .eq("id", user.id)
      .single();
    if (actorError || actor?.role !== "admin" || actor.suspended)
      return { ok: false, message: "Administrator access is required." };

    const secret =
      process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!secret)
      return {
        ok: false,
        message:
          "Set SUPABASE_SECRET_KEY on the server to enable account deletion.",
      };
    // This module runs only on the server. Never pass this client/key to a component.
    const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    const { error: prepareError } = await db.rpc("prepare_user_deletion", {
      target_user: target,
    });
    if (prepareError)
      return {
        ok: false,
        message:
          "Account deletion could not start. Check that the deletion migration is applied, then refresh and retry.",
      };
    const retryMessage =
      "The account is disabled, but deletion could not finish. Retry Delete user to finish removing it.";
    // All application uploads are stored directly under the account's UUID.
    // Delete through Storage's API so the actual objects are removed too.
    for (const bucket of ["avatars", "cvs"]) {
      for (;;) {
        const { data: files, error } = await admin.storage
          .from(bucket)
          .list(target, { limit: 100, offset: 0 });
        if (error || !files) return { ok: false, message: retryMessage };
        if (!files.length) break;
        if (files.some((file) => !file.id))
          return { ok: false, message: retryMessage };
        const { error: removeError } = await admin.storage
          .from(bucket)
          .remove(files.map((file) => `${target}/${file.name}`));
        if (removeError) return { ok: false, message: retryMessage };
      }
    }
    const { error: deleteError } = await admin.auth.admin.deleteUser(target);
    revalidatePath("/", "layout");
    if (deleteError) return { ok: false, message: retryMessage };
    return { ok: true, message: "User account permanently deleted." };
  } catch {
    revalidatePath("/admin");
    return {
      ok: false,
      message:
        "Deletion could not finish. Refresh the account status and retry.",
    };
  }
}
