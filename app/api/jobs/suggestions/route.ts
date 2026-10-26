import { searchJobs } from "@/lib/data";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(request: Request) {
  const keyword = (new URL(request.url).searchParams.get("q") ?? "")
    .trim()
    .slice(0, 100);
  if (!keyword) return Response.json({ jobs: [] }, { headers });
  try {
    const { jobs } = await searchJobs({ q: keyword });
    return Response.json(
      {
        jobs: jobs
          .slice(0, 6)
          .map(({ id, title, company, location }) => ({
            id,
            title,
            company,
            location,
          })),
      },
      { headers },
    );
  } catch {
    return Response.json(
      { error: "Job search is currently unavailable." },
      { status: 503, headers },
    );
  }
}
