import Image from "next/image";
import Link from "next/link";
import type { Connection } from "@/lib/social";
import { UnreadBadge } from "./unread-badge";

export function ConversationCard({
  connection,
  userId,
  selected = false,
  page = 1,
}: {
  connection: Connection;
  userId: string;
  selected?: boolean;
  page?: number;
}) {
  const { peer, last_message: last, unread_count: unread = 0 } = connection;
  return (
    <Link
      href={`/messages?conversation=${connection.id}&page=${page}`}
      className={`conversation-card ${selected ? "selected" : ""} ${unread > 0 ? "has-unread" : ""}`}
      aria-current={selected ? "page" : undefined}
    >
      <span className="conversation-avatar">
        {peer.avatar_path ? (
          <Image
            src={`${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${peer.avatar_path}`}
            alt=""
            width={48}
            height={48}
            unoptimized
          />
        ) : (
          <span aria-hidden="true">
            {(peer.full_name || "C").slice(0, 1).toUpperCase()}
          </span>
        )}
      </span>
      <span className="conversation-card-copy">
        <strong>{peer.full_name || "Community member"}</strong>
        <span className="conversation-preview">
          {last
            ? `${last.sender_id === userId ? "You: " : ""}${last.body}`
            : "Say hello and start a conversation"}
        </span>
        {last && (
          <time dateTime={last.created_at}>
            {new Date(last.created_at).toLocaleString("en-PH", {
              timeZone: "Asia/Manila",
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </time>
        )}
      </span>
      <UnreadBadge
        count={unread}
        label="unread messages"
        className="conversation-unread"
      />
    </Link>
  );
}
