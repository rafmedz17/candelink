import { supabase } from "@/lib/supabase/server";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
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
    if (!error && data)
      return Response.json(
        {
          messages: Number(data.messages),
          friends: Number(data.friends),
          notifications: Number(data.notifications),
        },
        { headers },
      );
  } catch {
    // Never expose authentication or database errors in navigation badges.
  }
  return Response.json({ error: "Unavailable" }, { status: 503, headers });
}
