import Link from "next/link";
import { z } from "zod";
import { requireAccount } from "@/lib/access";
import { DashboardLayout, SetupNeeded } from "@/components/dashboard";
import { PageTitle } from "@/components/site";
import {
  InboxRefresh,
  MessageComposer,
  MessageThread,
  MessageRequestActions,
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
  const requests = p.tab === "requests";
  const tabQuery = requests ? "&tab=requests" : "";
  const inboxHref = requests ? "/messages?tab=requests" : "/messages";
  const page = Math.min(1000, Math.max(1, Math.floor(Number(p.page) || 1)));
  const { data, error } = await a.db.rpc("list_message_conversations", {
    page_number: page,
    requests,
  });
  if (error) {
    console.error(
      `Message inbox query failed: ${JSON.stringify({
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
      })}`,
    );
  }
  const connections: Connection[] = data?.connections || [];
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
          description="Chat with friends and review messages from people you haven't connected with yet."
        />
        <div className="social-toolbar">
          <nav className="message-inbox-tabs" aria-label="Message inboxes">
            <Link
              className="button outline"
              href="/messages"
              aria-current={!requests ? "page" : undefined}
            >
              Inbox
            </Link>
            <Link
              className="button outline"
              href="/messages?tab=requests"
              aria-current={requests ? "page" : undefined}
            >
              Message requests
              {data?.request_count > 0 ? ` (${data.request_count})` : ""}
            </Link>
          </nav>
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
              <h2>{requests ? "Message requests" : "Your conversations"}</h2>
              {connections.length ? (
                connections.map((c) => (
                  <ConversationCard
                    key={c.id}
                    connection={c}
                    userId={a.user.id}
                    selected={selected?.id === c.id}
                    page={page}
                    requests={requests}
                  />
                ))
              ) : (
                <p>
                  {requests
                    ? "No message requests right now."
                    : "No conversations yet. Find someone in people search to send a message."}
                </p>
              )}
              {data?.total > 50 && (
                <nav className="pagination" aria-label="Conversation pages">
                  {page > 1 && (
                    <Link href={`/messages?page=${page - 1}${tabQuery}`}>
                      Previous
                    </Link>
                  )}
                  <span>Page {page}</span>
                  {page * 50 < data.total && (
                    <Link href={`/messages?page=${page + 1}${tabQuery}`}>
                      Next
                    </Link>
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
                  <Link className="text-link" href={inboxHref}>
                    Back to messages
                  </Link>
                </>
              ) : selected ? (
                <>
                  <div className="conversation-header">
                    <Link
                      className="text-link conversation-back"
                      href={inboxHref}
                    >
                      ← All conversations
                    </Link>
                    <SocialPeer peer={selected.peer} />
                  </div>
                  <div className="history-controls">
                    {more && messages[0] && (
                      <Link
                        className="text-link"
                        href={`/messages?conversation=${selected.id}&before=${messages[0].id}&page=${page}${tabQuery}`}
                      >
                        Older messages
                      </Link>
                    )}
                    {p.before && (
                      <Link
                        className="text-link"
                        href={`/messages?conversation=${selected.id}&page=${page}${tabQuery}`}
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
                    (selected.peer.active &&
                    (selected.status === "accepted" ||
                      selected.message_status === "accepted" ||
                      (selected.message_status === "pending" &&
                        selected.message_requester_id === a.user.id &&
                        !selected.message_intro_id)) ? (
                      <>
                        {selected.status !== "accepted" &&
                          selected.message_status === "pending" && (
                            <p className="form-message">
                              Your first message will go to Message requests.
                              You can send more after it is accepted.
                            </p>
                          )}
                        <MessageComposer
                          key={selected.id}
                          connectionId={selected.id}
                        />
                      </>
                    ) : selected.peer.active &&
                      selected.status !== "accepted" &&
                      selected.message_status === "pending" &&
                      selected.message_requester_id !== a.user.id ? (
                      <MessageRequestActions
                        key={selected.id}
                        connectionId={selected.id}
                      />
                    ) : (
                      <p className="form-message">
                        {selected.message_status === "pending" &&
                        selected.peer.active
                          ? "Message request sent. You can send more after the recipient accepts."
                          : selected.message_status === "declined"
                            ? "This message request was declined. New messages are unavailable."
                            : "New messages are unavailable for this conversation."}
                      </p>
                    ))}
                </>
              ) : (
                <div className="conversation-empty">
                  <MessageCircle size={36} aria-hidden="true" />
                  <h2>Choose a conversation</h2>
                  <p>Select a conversation or find someone to message.</p>
                  <Link className="button outline" href="/people">
                    Find people
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
