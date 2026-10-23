"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import type { Result } from "./actions";

export async function markConversationRead(
  connection: string,
  lastMessage: string,
): Promise<Result> {
  if (
    !z.uuid().safeParse(connection).success ||
    !z.uuid().safeParse(lastMessage).success
  )
    return { ok: false, message: "Invalid conversation." };
  try {
    const db = await supabase();
    if (!db) return { ok: false, message: "Messaging is unavailable." };
    // The RPC validates the authenticated participant and the message's conversation.
    const { error } = await db.rpc("mark_conversation_read", {
      connection_id: connection,
      last_message_id: lastMessage,
    });
    return {
      ok: !error,
      message: error ? "Read status could not be updated." : "Messages read.",
    };
  } catch {
    return { ok: false, message: "Read status could not be updated." };
  }
}

export async function friendAction(
  target: string,
  decision: string,
): Promise<Result> {
  const parsed = z
    .object({
      target: z.uuid(),
      decision: z.enum(["request", "accept", "decline", "cancel", "remove"]),
    })
    .safeParse({ target, decision });
  if (!parsed.success) return { ok: false, message: "Invalid friend request." };
  try {
    const db = await supabase();
    if (!db) return { ok: false, message: "Friends are not configured yet." };
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user) return { ok: false, message: "Log in to connect with people." };
    const { error } = await db.rpc("friend_action", {
      target_user: target,
      decision,
    });
    if (error)
      return {
        ok: false,
        message: error.message.includes("wait before")
          ? "Please wait 24 hours before sending another request."
          : error.message.includes("Daily action")
            ? "You've reached today's request limit. Try again tomorrow."
            : "The request could not be updated. Refresh and try again.",
      };
    revalidatePath("/friends");
    revalidatePath("/messages");
    revalidatePath(`/profiles/${target}`);
    return {
      ok: true,
      message: (
        {
          request: "Friend request sent.",
          accept: "Friend request accepted. You can now message each other.",
          decline: "Request declined.",
          cancel: "Request canceled.",
          remove: "Friend removed. New messages are disabled.",
        } as Record<string, string>
      )[decision],
    };
  } catch {
    return {
      ok: false,
      message: "Couldn't update the request. Check your connection.",
    };
  }
}

export async function sendMessage(
  connection: string,
  id: string,
  body: string,
): Promise<Result> {
  const parsed = z
    .object({
      connection: z.uuid(),
      id: z.uuid(),
      body: z.string().trim().min(1).max(4000),
    })
    .safeParse({ connection, id, body });
  if (!parsed.success)
    return { ok: false, message: "Write a message of 1–4,000 characters." };
  try {
    const db = await supabase();
    if (!db) return { ok: false, message: "Messaging is not configured yet." };
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return { ok: false, message: "Please log in to send a message." };
    const { error } = await db.rpc("send_direct_message", {
      connection_id: connection,
      message_id: id,
      content: parsed.data.body,
    });
    if (error)
      return {
        ok: false,
        message: error.message.includes("Daily action")
          ? "You've reached today's message limit."
          : "Message not sent. Check that you are still friends, then try again.",
      };
    revalidatePath("/messages");
    return { ok: true, message: "Message sent." };
  } catch {
    return {
      ok: false,
      message: "Message not sent. Check your connection and retry.",
    };
  }
}
