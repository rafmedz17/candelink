import { supabase } from "@/lib/supabase/server";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const checkedAt = new Date().toISOString();
  try {
    const db = await supabase();
    if (!db)
      return Response.json({ error: "Unavailable" }, { status: 503, headers });
    const {
      data: { user },
    } = await db.auth.getUser();
    if (!user)
      return Response.json(
        { error: "Log in required" },
        { status: 401, headers },
      );
    const { data, error } = await db.rpc("account_activity");
    if (!error && data) {
      const since = new URL(request.url).searchParams.get("since");
      let incoming: {
        id: string;
        friendship_id: string;
        created_at: string;
      }[] = [];
      if (since && Number.isFinite(Date.parse(since))) {
        // Bounded lookback catches delayed transactions; the client deduplicates IDs.
        const after = new Date(
          Math.max(Date.parse(since) - 30000, Date.now() - 300000),
        ).toISOString();
        const batch = await db
          .from("direct_messages")
          .select("id,friendship_id,created_at")
          .neq("sender_id", user.id)
          .gte("created_at", after)
          .order("created_at", { ascending: false })
          .limit(50);
        if (batch.error)
          return Response.json(
            { error: "Unavailable" },
            { status: 503, headers },
          );
        incoming = batch.data || [];
      }
      return Response.json(
        {
          messages: Number(data.messages),
          friends: Number(data.friends),
          notifications: Number(data.notifications),
          user_id: user.id,
          checked_at: checkedAt,
          incoming_messages: incoming,
        },
        { headers },
      );
    }
  } catch {
    // Never expose authentication or database errors in navigation badges.
  }
  return Response.json({ error: "Unavailable" }, { status: 503, headers });
}
