import { supabase } from "@/lib/supabase/server";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const keyword = (new URL(request.url).searchParams.get("q") ?? "")
    .trim()
    .slice(0, 100);
  if (keyword.length < 2) return Response.json({ people: [] }, { headers });

  try {
    const db = await supabase();
    if (db) {
      const { data: auth } = await db.auth.getUser();
      const { data, error } = await db.rpc("search_people", {
        keyword,
        page_number: 1,
      });
      if (!error && Array.isArray(data?.people)) {
        type PublicPerson = {
          id: string;
          full_name: string;
          headline: string;
          avatar_path: string | null;
        };
        const people = (data.people as PublicPerson[])
          .filter((person) => person.id !== auth.user?.id)
          .slice(0, 6)
          .map((person) => ({
            id: person.id,
            full_name: person.full_name,
            headline: person.headline,
            avatar_url: person.avatar_path
              ? db.storage.from("avatars").getPublicUrl(person.avatar_path).data
                  .publicUrl
              : null,
          }));
        return Response.json({ people }, { headers });
      }
    }
  } catch {
    // Show a recoverable state without exposing database or authentication errors.
  }
  return Response.json(
    { error: "People search is currently unavailable." },
    { status: 503, headers },
  );
}
