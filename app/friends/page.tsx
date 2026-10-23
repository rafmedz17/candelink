import Link from "next/link";
import { requireAccount } from "@/lib/access";
import { DashboardLayout, SetupNeeded } from "@/components/dashboard";
import { PageTitle } from "@/components/site";
import { FriendActions, InboxRefresh } from "@/components/social-controls";
import { SocialPeer } from "@/components/social-peer";
import type { Connection } from "@/lib/social";

export default async function Friends({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const a = await requireAccount();
  if (!a) return <SetupNeeded />;
  const params = await searchParams;
  const page = Math.min(
    1000,
    Math.max(1, Math.floor(Number(params.page) || 1)),
  );
  const { data, error } = await a.db.rpc("list_connections", {
    page_number: page,
  });
  const connections: Connection[] = data?.connections || [];
  const groups = [
    {
      title: "Friend requests",
      items: connections.filter(
        (c) => c.status === "pending" && c.recipient_id === a.user.id,
      ),
      empty: "No new friend requests.",
    },
    {
      title: "Your friends",
      items: connections.filter((c) => c.status === "accepted"),
      empty: "Find someone in people search and send your first request.",
    },
    {
      title: "Sent requests",
      items: connections.filter(
        (c) => c.status === "pending" && c.requester_id === a.user.id,
      ),
      empty: "No pending sent requests.",
    },
  ];
  return (
    <DashboardLayout role={a.profile.role} active="friends">
      <PageTitle
        eyebrow="GROW YOUR LOCAL CIRCLE"
        title="Friends & connections"
        description="Review requests, meet your friends, and start a private conversation."
      />
      <div className="social-toolbar">
        <Link className="button" href="/people">
          Find people
        </Link>
        <InboxRefresh />
      </div>
      {error ? (
        <div className="panel" role="status">
          <h2>Friends are currently unavailable</h2>
          <p>Please try again shortly.</p>
        </div>
      ) : (
        <>
          {groups.map((group) => (
            <section className="panel" key={group.title}>
              <h2>{group.title}</h2>
              {group.items.length ? (
                group.items.map((c) => (
                  <article className="connection-card" key={c.id}>
                    <SocialPeer peer={c.peer} />
                    <FriendActions
                      targetId={c.peer.id}
                      status={c.status}
                      incoming={c.recipient_id === a.user.id}
                      connectionId={c.id}
                      active={c.peer.active}
                    />
                  </article>
                ))
              ) : (
                <p>{group.empty}</p>
              )}
            </section>
          ))}
          {data.total > 50 && (
            <nav className="pagination" aria-label="Connections pages">
              {page > 1 && (
                <Link href={`/friends?page=${page - 1}`}>Previous</Link>
              )}
              <span>Page {page}</span>
              {page * 50 < data.total && (
                <Link href={`/friends?page=${page + 1}`}>Next</Link>
              )}
            </nav>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
