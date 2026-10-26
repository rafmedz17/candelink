"use server";
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import type { Result } from "@/app/actions";

export async function contactAdmin(
  messageId: string,
  content: string,
): Promise<Result> {
  if (
    !z.uuid().safeParse(messageId).success ||
    !content.trim() ||
    content.trim().length > 4000
  )
    return {
      ok: false,
      message: "Enter a message between 1 and 4000 characters.",
    };
  try {
    const db = await supabase();
    if (!db)
      return { ok: false, message: "Messaging is currently unavailable." };
    const { data: auth } = await db.auth.getUser();
    if (!auth.user)
      return {
        ok: false,
        message: "Please log in before contacting the team.",
      };
    const { data, error } = await db.rpc("contact_admin", {
      message_id: messageId,
      content,
    });
    if (error)
      return {
        ok: false,
        message: error.message.includes("Admin unavailable")
          ? "No administrator is available to receive messages right now. Please try again later."
          : error.message.includes("Daily action")
            ? "You've reached today's contact limit. Please try again tomorrow."
            : "Your message could not be sent. Please try again.",
      };
    revalidatePath("/messages");
    return {
      ok: true,
      message: "Your message has been sent to the admin.",
      url: `/messages?conversation=${data}`,
    };
  } catch {
    return {
      ok: false,
      message:
        "Check your connection and try again. Your message has not been cleared.",
    };
  }
}
