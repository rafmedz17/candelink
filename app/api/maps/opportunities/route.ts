import { z } from "zod";
import { supabase } from "@/lib/supabase/server";

const boundsSchema = z
  .object({
    south: z.coerce.number().min(-90).max(90),
    north: z.coerce.number().min(-90).max(90),
    west: z.coerce.number().min(-180).max(180),
    east: z.coerce.number().min(-180).max(180),
    keyword: z.string().max(150).default(""),
    page_number: z.coerce.number().int().min(1).max(1000).default(1),
  })
  .refine((v) => v.south < v.north && v.west < v.east);
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const parsed = boundsSchema.safeParse(Object.fromEntries(params));
  if (!parsed.success)
    return Response.json(
      { error: "Choose a valid map area." },
      { status: 400, headers },
    );
  try {
    const db = await supabase();
    if (db) {
      const { data, error } = await db.rpc("map_opportunities", parsed.data);
      if (!error && data) return Response.json(data, { headers });
    }
  } catch {
    /* Show a recoverable public state without exposing database errors. */
  }
  return Response.json(
    { error: "Opportunities could not be loaded. Please try again shortly." },
    { status: 503, headers },
  );
}
