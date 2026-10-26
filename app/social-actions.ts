"use server";

import { z } from "zod";
import { revalidatePath } from "next/cache";
import { supabase } from "@/lib/supabase/server";
import type { Result } from "./actions";

export async function blockUser(
  target: string,
  decision: string,
): Promise<Result> {
  if (
    !z.uuid().safeParse(target).success ||
    !["block", "unblock"].includes(decision)
  )
    return { ok: false, message: "Invalid block action." };
  try {
    const db = await supabase();
    if (!db) return { ok: false, message: "Account services are unavailable." };
    const { error } = await db.rpc("block_action", {
      target_user: target,
      decision,
    });
    if (error)
      return {
        ok: false,
        message: "Couldn't update this block. Refresh and try again.",
      };
    revalidatePath("/friends");
    revalidatePath("/messages");
    revalidatePath(`/profiles/${target}`);
    return {
      ok: true,
      message:
        decision === "block"
          ? "Person blocked. New messages and friend requests are disabled."
          : "Person unblocked. Your previous friendship is not restored.",
    };
  } catch {
    return { ok: false, message: "Check your connection and try again." };
  }
}

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
        message: error.message.includes("Daily action")
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
          remove: "Friend removed.",
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
          : error.message.includes("request")
            ? "Wait for the recipient to accept your message request before sending more."
            : "Message not sent. Refresh the conversation and try again.",
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

export async function startMessageRequest(target: string): Promise<Result> {
  if (!z.uuid().safeParse(target).success)
    return { ok: false, message: "Invalid recipient." };
  try {
    const db = await supabase();
    if (!db) return { ok: false, message: "Messaging is not configured yet." };
    const { data, error } = await db.rpc("start_message_request", {
      target_user: target,
    });
    if (error || !data)
      return {
        ok: false,
        message: error?.message.includes("Daily action")
          ? "You've reached today's message request limit. Try again tomorrow."
          : "This conversation could not be opened. Refresh and try again.",
      };
    revalidatePath("/messages");
    return {
      ok: true,
      message: "Conversation opened.",
      url: `/messages?conversation=${data}`,
    };
  } catch {
    return { ok: false, message: "Check your connection and try again." };
  }
}

export async function respondMessageRequest(
  connection: string,
  decision: string,
): Promise<Result> {
  if (
    !z.uuid().safeParse(connection).success ||
    !["accept", "decline"].includes(decision)
  )
    return { ok: false, message: "Invalid message request." };
  try {
    const db = await supabase();
    if (!db) return { ok: false, message: "Messaging is not configured yet." };
    const { error } = await db.rpc("respond_message_request", {
      connection_id: connection,
      decision,
    });
    if (error)
      return {
        ok: false,
        message: "This request could not be updated. Refresh and try again.",
      };
    revalidatePath("/messages");
    return {
      ok: true,
      message:
        decision === "accept"
          ? "Message request accepted."
          : "Message request declined.",
      url:
        decision === "accept"
          ? `/messages?conversation=${connection}`
          : "/messages?tab=requests",
    };
  } catch {
    return { ok: false, message: "Check your connection and try again." };
  }
}
