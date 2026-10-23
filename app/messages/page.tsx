import Link from "next/link";
import { z } from "zod";
import { requireAccount } from "@/lib/access";
import { DashboardLayout, SetupNeeded } from "@/components/dashboard";
import { PageTitle } from "@/components/site";
import {
  InboxRefresh,
  MessageComposer,
  MessageThread,
} from "@/components/social-controls";
import { SocialPeer } from "@/components/social-peer";
import { ConversationCard } from "@/components/conversation-card";
import { MessageCircle } from "lucide-react";
import type { Connection, DirectMessage } from "@/lib/social";

export default async function Messages({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const a = await requireAccount();
  if (!a) return <SetupNeeded />;
  const p = await searchParams;
  const page = Math.min(1000, Math.max(1, Math.floor(Number(p.page) || 1)));
  const { data, error } = await a.db.rpc("list_connections", {
    page_number: page,
  });
  const connections: Connection[] = (data?.connections || []).filter(
    (c: Connection) => c.status === "accepted" || c.last_message_at,
  );
  let selected: Connection | null = null;
  let messages: DirectMessage[] = [];
  let more = false;
  let threadError = false;
  if (p.conversation) {
    if (!z.uuid().safeParse(p.conversation).success) threadError = true;
    else {
      const detail = await a.db.rpc("connection_details", {
        connection_id: p.conversation,
      });
      selected = detail.data as Connection | null;
      if (detail.error || !selected) threadError = true;
      else if (p.before && !z.uuid().safeParse(p.before).success)
        threadError = true;
      else {
        const batch = await a.db.rpc("conversation_messages", {
          connection_id: selected.id,
          before_message: p.before || null,
        });
        threadError = Boolean(batch.error);
        messages = batch.data?.messages || [];
        more = Boolean(batch.data?.has_more);
      }
    }
  }
  return (
    <DashboardLayout role={a.profile.role} active="messages">
      <div
        className={`messages-workspace ${p.conversation ? "has-open-thread" : ""}`}
      >
        <PageTitle
          eyebrow="KEEP THE CONVERSATION GOING"
          title="Messages"
          description="Private conversations between you and your accepted friends."
        />
        <div className="social-toolbar">
          <Link className="text-link" href="/friends">
            Manage friends
          </Link>
          {!p.before && <InboxRefresh />}
        </div>
        {error ? (
          <div className="panel" role="status">
            <h2>Messages are currently unavailable</h2>
            <p>Please try again shortly.</p>
          </div>
        ) : (
          <div
            className={`inbox-layout ${p.conversation ? "has-conversation" : ""}`}
          >
            <aside
              className="panel conversation-list"
              aria-label="Conversations"
            >
              <h2>Your conversations</h2>
              {connections.length ? (
                connections.map((c) => (
                  <ConversationCard
                    key={c.id}
                    connection={c}
                    userId={a.user.id}
                    selected={selected?.id === c.id}
                    page={page}
                  />
                ))
              ) : (
                <p>
                  No conversations yet. Accept a friend request to start
                  messaging.
                </p>
              )}
              {data.total > 50 && (
                <nav className="pagination" aria-label="Conversation pages">
                  {page > 1 && (
                    <Link href={`/messages?page=${page - 1}`}>Previous</Link>
                  )}
                  <span>Page {page}</span>
                  {page * 50 < data.total && (
                    <Link href={`/messages?page=${page + 1}`}>Next</Link>
                  )}
                </nav>
              )}
            </aside>
            <section
              className="panel conversation-panel"
              aria-label="Selected conversation"
            >
              {threadError ? (
                <>
                  <h2>Conversation unavailable</h2>
                  <p>You can only open conversations you participate in.</p>
                  <Link className="text-link" href="/messages">
                    Back to messages
                  </Link>
                </>
              ) : selected ? (
                <>
                  <div className="conversation-header">
                    <Link
                      className="text-link conversation-back"
                      href="/messages"
                    >
                      ← All conversations
                    </Link>
                    <SocialPeer peer={selected.peer} />
                  </div>
                  <div className="history-controls">
                    {more && messages[0] && (
                      <Link
                        className="text-link"
                        href={`/messages?conversation=${selected.id}&before=${messages[0].id}&page=${page}`}
                      >
                        Older messages
                      </Link>
                    )}
                    {p.before && (
                      <Link
                        className="text-link"
                        href={`/messages?conversation=${selected.id}&page=${page}`}
                      >
                        Latest messages
                      </Link>
                    )}
                  </div>
                  <MessageThread
                    key={selected.id}
                    messages={messages}
                    userId={a.user.id}
                    connectionId={
                      !p.before && !threadError ? selected.id : undefined
                    }
                  />
                  {!p.before &&
                    (selected.status === "accepted" && selected.peer.active ? (
                      <MessageComposer
                        key={selected.id}
                        connectionId={selected.id}
                      />
                    ) : (
                      <p className="form-message">
                        New messages are unavailable. Messaging requires an
                        active friendship.
                      </p>
                    ))}
                </>
              ) : (
                <div className="conversation-empty">
                  <MessageCircle size={36} aria-hidden="true" />
                  <h2>Choose a conversation</h2>
                  <p>
                    Open a friend&apos;s conversation to read or send a message.
                  </p>
                  <Link className="button outline" href="/friends">
                    Go to friends
                  </Link>
                </div>
              )}
            </section>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
