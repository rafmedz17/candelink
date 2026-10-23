"use client";

import { useSyncExternalStore } from "react";
import { UnreadBadge } from "./unread-badge";

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
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      if (pending) {
        requested = true;
        return;
      }
      pending = true;
      try {
        const response = await fetch("/api/account/activity", {
          cache: "no-store",
          signal: controller.signal,
        });
        const next = response.ok ? await response.json() : null;
        if (disposed) return;
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
    const timer = setInterval(refresh, 10000);
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
