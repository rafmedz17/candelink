"use client";

import { useSyncExternalStore } from "react";
import { UnreadBadge } from "./unread-badge";
import { showToast } from "@/lib/toasts";

type Counts = { messages: number; friends: number; notifications: number };
let counts: Counts | null = null;
const listeners = new Set<() => void>();
let stop: (() => void) | undefined;

// One request per tab updates every badge, even when both menus are present.
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (!stop) {
    let disposed = false;
    let pending = false;
    let requested = false;
    const controller = new AbortController();
    let since: string | null = null;
    let baseline: string | null = null;
    let account: string | null = null;
    const seen = new Set<string>();
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      if (pending) {
        requested = true;
        return;
      }
      pending = true;
      try {
        const response = await fetch(
          `/api/account/activity${since ? `?since=${encodeURIComponent(since)}` : ""}`,
          {
            cache: "no-store",
            signal: controller.signal,
          },
        );
        const next = response.ok ? await response.json() : null;
        if (disposed) return;
        if (next?.user_id && next?.checked_at) {
          if (account !== next.user_id) {
            account = next.user_id;
            baseline = next.checked_at;
            seen.clear();
          } else if (Array.isArray(next.incoming_messages)) {
            const conversations = new Map<string, number>();
            for (const message of [...next.incoming_messages].reverse()) {
              if (
                !message.id ||
                !message.friendship_id ||
                seen.has(message.id) ||
                !baseline ||
                message.created_at < baseline
              )
                continue;
              seen.add(message.id);
              const current = new URL(location.href);
              if (
                current.pathname === "/messages" &&
                current.searchParams.get("conversation") ===
                  message.friendship_id
              )
                continue;
              conversations.set(
                message.friendship_id,
                (conversations.get(message.friendship_id) || 0) + 1,
              );
            }
            for (const [id, total] of conversations)
              showToast(
                total > 1
                  ? `You have ${total} new messages.`
                  : "You have a new message.",
                "message",
                `/messages?conversation=${id}`,
              );
            if (seen.size > 1000) {
              const keep = [...seen].slice(-500);
              seen.clear();
              keep.forEach((id) => seen.add(id));
            }
          }
          since = next.checked_at;
        }
        counts =
          next &&
          [next.messages, next.friends, next.notifications].every(
            (value) => Number.isSafeInteger(value) && value >= 0,
          )
            ? next
            : null;
        listeners.forEach((notify) => notify());
      } catch {
        // Keep the last known counts during a temporary connection failure.
      } finally {
        pending = false;
        if (requested && !disposed) {
          requested = false;
          void refresh();
        }
      }
    }
    void refresh();
    const timer = setInterval(refresh, 5000);
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("candelink:activity", refresh);
    stop = () => {
      disposed = true;
      controller.abort();
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("candelink:activity", refresh);
      counts = null;
      stop = undefined;
    };
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) stop?.();
  };
}
const snapshot = () => counts;
const serverSnapshot = () => null;

export function notifyActivityChanged() {
  window.dispatchEvent(new Event("candelink:activity"));
}

export function ActivityBadge({
  kind,
  className,
}: {
  kind: keyof Counts | "all";
  className?: string;
}) {
  const current = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  if (!current) return null;
  const count =
    kind === "all"
      ? current.messages + current.friends + current.notifications
      : current[kind];
  const label = {
    messages: "unread messages",
    friends: "pending friend requests",
    notifications: "unread notifications",
    all: "new updates",
  }[kind];
  return <UnreadBadge count={count} label={label} className={className} />;
}
