"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle, Send, UserPlus } from "lucide-react";
import {
  friendAction,
  sendMessage,
  markConversationRead,
  startMessageRequest,
  respondMessageRequest,
} from "@/app/social-actions";
import { notifyActivityChanged } from "./activity-badge";
import type { Result } from "@/app/actions";
import type { DirectMessage } from "@/lib/social";
import { createMessageId } from "@/lib/social";

export function FriendActions({
  targetId,
  status,
  incoming = false,
  connectionId,
  active = true,
}: {
  targetId: string;
  status?: string;
  incoming?: boolean;
  connectionId?: string;
  active?: boolean;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  async function act(decision: string) {
    if (
      decision === "remove" &&
      !window.confirm(
        "Remove this friend? Your conversation history will be kept. Messaging remains available if you separately accepted a message request.",
      )
    )
      return;
    setPending(true);
    try {
      const r = await friendAction(targetId, decision);
      setResult(r);
      if (r.ok) {
        notifyActivityChanged();
        router.refresh();
      }
    } catch {
      setResult({
        ok: false,
        message: "Couldn't update the request. Please try again.",
      });
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="friend-actions">
      {status !== "accepted" && active && (
        <MessageRequestButton targetId={targetId} />
      )}
      {status === "accepted" ? (
        <>
          <Link
            className="button"
            href={`/messages?conversation=${connectionId}`}
          >
            <MessageCircle size={17} aria-hidden="true" />
            Message
          </Link>
          <button
            className="button outline"
            disabled={pending}
            onClick={() => act("remove")}
          >
            Remove friend
          </button>
        </>
      ) : status === "pending" ? (
        incoming ? (
          <>
            <button
              className="button"
              disabled={pending || !active}
              onClick={() => act("accept")}
            >
              Accept request
            </button>
            <button
              className="button outline"
              disabled={pending}
              onClick={() => act("decline")}
            >
              Decline
            </button>
          </>
        ) : (
          <>
            <span className="badge">Request sent</span>
            <button
              className="button outline"
              disabled={pending}
              onClick={() => act("cancel")}
            >
              Cancel request
            </button>
          </>
        )
      ) : active ? (
        <button
          className="button"
          disabled={pending}
          onClick={() => act("request")}
        >
          <UserPlus size={17} aria-hidden="true" />
          {pending ? "Sending…" : "Add friend"}
        </button>
      ) : (
        <p>Account unavailable.</p>
      )}
      {result && (
        <p
          className={`form-message ${result.ok ? "" : "error"}`}
          role={result.ok ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
    </div>
  );
}

export function InboxRefresh() {
  const router = useRouter();
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 10000);
    return () => clearInterval(timer);
  }, [router]);
  return (
    <button
      className="button outline small"
      onClick={() => router.refresh()}
      type="button"
    >
      Refresh
    </button>
  );
}

export function MessageThread({
  messages,
  userId,
  connectionId,
}: {
  messages: DirectMessage[];
  userId: string;
  connectionId?: string;
}) {
  const router = useRouter();
  const thread = useRef<HTMLDivElement>(null);
  const readMarker = useRef<HTMLDivElement>(null);
  const lastRead = useRef("");
  const latest = messages.at(-1)?.id;
  useEffect(() => {
    if (thread.current) thread.current.scrollTop = thread.current.scrollHeight;
  }, [latest]);
  useEffect(() => {
    if (!connectionId || !latest || !readMarker.current) return;
    const key = `${connectionId}:${latest}`;
    let visible = false;
    let pending = false;
    let disposed = false;
    async function recordRead() {
      if (
        !visible ||
        pending ||
        lastRead.current === key ||
        document.visibilityState !== "visible"
      )
        return;
      pending = true;
      try {
        const result = await markConversationRead(connectionId!, latest!);
        if (result.ok && !disposed) {
          lastRead.current = key;
          notifyActivityChanged();
          router.refresh();
        }
      } catch {
        // Keep the unread badge and retry while the message remains visible.
      } finally {
        pending = false;
      }
    }
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      void recordRead();
    });
    observer.observe(readMarker.current);
    document.addEventListener("visibilitychange", recordRead);
    const retry = setInterval(recordRead, 10000);
    return () => {
      disposed = true;
      observer.disconnect();
      document.removeEventListener("visibilitychange", recordRead);
      clearInterval(retry);
    };
  }, [connectionId, latest, router]);
  return (
    <div
      className="message-thread"
      ref={thread}
      tabIndex={0}
      role="region"
      aria-label="Conversation messages"
    >
      {!messages.length && (
        <div className="conversation-empty">
          <MessageCircle size={28} aria-hidden="true" />
          <h3>Start the conversation</h3>
          <p>Say hello to your new connection.</p>
        </div>
      )}
      {messages.map((m) => (
        <div
          className={`message-bubble ${m.sender_id === userId ? "outgoing" : "incoming"}`}
          key={m.id}
        >
          <span className="message-author">
            {m.sender_id === userId ? "You" : "Community member"}
          </span>
          <p>{m.body}</p>
          <time dateTime={m.created_at}>
            {new Date(m.created_at).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
        </div>
      ))}
      <div
        ref={readMarker}
        className="message-read-marker"
        aria-hidden="true"
      />
    </div>
  );
}

export function MessageComposer({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const nonce = useRef<string | null>(null);
  return (
    <form
      className="message-composer"
      onSubmit={async (e) => {
        e.preventDefault();
        if (pending || !body.trim()) return;
        setPending(true);
        try {
          nonce.current ??= createMessageId();
          const r = await sendMessage(connectionId, nonce.current, body);
          setResult(r);
          if (r.ok) {
            setBody("");
            nonce.current = null;
            router.refresh();
          }
        } catch {
          setResult({
            ok: false,
            message: "Message not sent. Check your connection and retry.",
          });
        } finally {
          setPending(false);
        }
      }}
    >
      <label htmlFor="message-body">Your message</label>
      <textarea
        id="message-body"
        value={body}
        onChange={(e) => {
          setBody(e.target.value);
          nonce.current = null;
        }}
        disabled={pending}
        maxLength={4000}
        required
        placeholder="Write a message…"
        rows={2}
      />
      <div>
        <small>{body.length.toLocaleString()}/4,000 characters</small>
        <button
          className="button"
          aria-label={pending ? "Sending message" : "Send message"}
          disabled={pending || !body.trim()}
        >
          <Send size={16} aria-hidden="true" />
          {pending ? "Sending…" : "Send"}
        </button>
      </div>
      {result && (
        <p
          className={`form-message ${result.ok ? "" : "error"}`}
          role={result.ok ? "status" : "alert"}
        >
          {result.message}
        </p>
      )}
    </form>
  );
}

export function MessageRequestButton({ targetId }: { targetId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  return (
    <>
      <button
        className="button outline"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          try {
            const r = await startMessageRequest(targetId);
            setResult(r);
            if (r.url) router.push(r.url);
          } catch {
            setResult({
              ok: false,
              message: "Check your connection and try again.",
            });
          } finally {
            setPending(false);
          }
        }}
      >
        <MessageCircle size={17} aria-hidden="true" />
        {pending ? "Opening…" : "Message"}
      </button>
      {result && !result.ok && (
        <p className="form-message error" role="alert">
          {result.message}
        </p>
      )}
    </>
  );
}

export function MessageRequestActions({
  connectionId,
}: {
  connectionId: string;
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  async function respond(decision: string) {
    setPending(true);
    try {
      const r = await respondMessageRequest(connectionId, decision);
      setResult(r);
      if (r.ok) {
        notifyActivityChanged();
        if (r.url) router.push(r.url);
        router.refresh();
      }
    } catch {
      setResult({ ok: false, message: "Check your connection and try again." });
    } finally {
      setPending(false);
    }
  }
  return (
    <div className="message-request-notice">
      <p>
        Accept this message request to reply. This does not add the sender as a
        friend.
      </p>
      <div className="friend-actions">
        <button
          className="button"
          disabled={pending}
          onClick={() => respond("accept")}
        >
          Accept message request
        </button>
        <button
          className="button outline"
          disabled={pending}
          onClick={() => respond("decline")}
        >
          Decline message request
        </button>
      </div>
      {result && !result.ok && (
        <p className="form-message error" role="alert">
          {result.message}
        </p>
      )}
    </div>
  );
}
