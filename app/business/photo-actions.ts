"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import type { Result } from "@/app/actions";

export async function businessPhoto(data: FormData): Promise<Result> {
  try {
    const bid = data.get("business_id");
    if (!z.uuid().safeParse(bid).success)
      return { ok: false, message: "Invalid business." };
    const db = await supabase();
    if (!db) return { ok: false, message: "Storage is unavailable." };
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { ok: false, message: "Please log in." };
    const { data: member } = await db
      .from("business_members")
      .select("business_id")
      .eq("business_id", bid)
      .eq("user_id", user.id)
      .maybeSingle();
    if (!member)
      return { ok: false, message: "Business membership is required." };
    let path: string;
    const removing = data.get("remove") === "true";
    if (removing) {
      const value = data.get("path");
      if (typeof value !== "string" || !value || value.length > 500)
        return { ok: false, message: "Invalid photo." };
      path = value;
    } else {
      const file = data.get("file");
      if (!(file instanceof File) || !file.size || file.size > 5 * 1024 * 1024)
        return { ok: false, message: "Choose a JPEG or PNG photo up to 5 MB." };
      const bytes = new Uint8Array(await file.arrayBuffer());
      const jpeg =
        file.type === "image/jpeg" && bytes[0] === 255 && bytes[1] === 216;
      const png =
        file.type === "image/png" &&
        [137, 80, 78, 71, 13, 10, 26, 10].every(
          (byte, index) => bytes[index] === byte,
        );
      if (!jpeg && !png)
        return { ok: false, message: "Upload a valid JPEG or PNG photo." };
      path = `${user.id}/${crypto.randomUUID()}.${jpeg ? "jpg" : "png"}`;
      const { error } = await db.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (error)
        return { ok: false, message: "Photo upload failed. Please try again." };
    }
    const { error } = await db.rpc("business_photo", {
      bid,
      image_path: path,
      remove_photo: removing,
    });
    if (error) {
      if (!removing) await db.storage.from("avatars").remove([path]);
      return {
        ok: false,
        message: error.message.includes("six")
          ? "You can add up to six background photos."
          : "Photo could not be saved. Check that the business images migration is applied.",
      };
    }
    // Detach only on removal: a shared business may still use the file elsewhere.
    revalidatePath(`/businesses/${bid}`);
    revalidatePath("/business/dashboard");
    return {
      ok: true,
      message: removing
        ? "Background photo removed."
        : "Background photo added.",
    };
  } catch {
    return { ok: false, message: "Check your connection and try again." };
  }
}
