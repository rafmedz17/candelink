import { supabase } from "./supabase/server";
import { sampleJobs, type Job } from "./sample";
import { samples } from "./business-samples";
export async function featuredBusinesses() {
  const db = await supabase();
  if (!db) return samples;
  const { data, error } = await db
    .from("businesses")
    .select("id,name,category,address,description")
    .eq("verification_status", "verified")
    .order("created_at", { ascending: false })
    .limit(3);
  if (error) throw new Error("Businesses could not be loaded.");
  return data || [];
}
export async function getJobs(limit = 6, businessId?: string) {
  const db = await supabase();
  if (!db) return { jobs: sampleJobs, demo: true };
  let query = db
    .from("jobs")
    .select("*, businesses(name)")
    .eq("status", "published")
    .order("created_at", { ascending: false })
    .limit(limit);
  if (businessId) query = query.eq("business_id", businessId);
  const { data, error } = await query;
  if (error)
    throw new Error(
      "Opportunities could not be loaded. Please try again shortly.",
    );
  return {
    jobs: await withBookmarks(
      (data || []).map((j) => ({
        ...j,
        company: j.businesses?.name || "Local business",
      })) as Job[],
    ),
    demo: false,
  };
}
export async function getJob(id: string) {
  const db = await supabase();
  if (!db) return { job: sampleJobs.find((j) => j.id === id), demo: true };
  const { data, error } = await db
    .from("jobs")
    .select("*,businesses(name)")
    .eq("id", id)
    .eq("status", "published")
    .maybeSingle();
  if (error) return { job: undefined, demo: false };
  return {
    job: data
      ? (
          await withBookmarks([
            { ...data, company: data.businesses?.name } as Job,
          ])
        )[0]
      : undefined,
    demo: false,
  };
}
export async function searchJobs(p: Record<string, string>) {
  const page = Math.max(1, Math.floor(Number(p.page) || 1));
  const db = await supabase();
  if (db) {
    const { data, error } = await db.rpc("search_jobs", {
      keyword: p.q || "",
      employment: p.type || "",
      work_mode: p.arrangement || "",
      place: p.location || "",
      sort_by: p.sort || "newest",
      page_number: page,
    });
    if (error) throw new Error("Search is temporarily unavailable.");
    return {
      jobs: await withBookmarks(data.jobs as Job[]),
      total: data.total as number,
      demo: false,
      page,
    };
  }
  const q = (p.q || "").toLowerCase();
  const all = sampleJobs.filter(
    (j) =>
      (!q ||
        `${j.title} ${j.company} ${j.description} ${j.location}`
          .toLowerCase()
          .includes(q)) &&
      (!p.type || j.employment_type === p.type) &&
      (!p.arrangement || j.arrangement === p.arrangement) &&
      (!p.location ||
        j.location.toLowerCase().includes(p.location.toLowerCase())),
  );
  if (p.sort === "salary")
    all.sort((a, b) => (b.salary_max || 0) - (a.salary_max || 0));
  return {
    jobs: all.slice((page - 1) * 8, page * 8),
    total: all.length,
    demo: true,
    page,
  };
}
async function withBookmarks(jobs: Job[]) {
  const db = await supabase();
  if (!db || !jobs.length) return jobs;
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return jobs;
  const { data } = await db
    .from("saved_jobs")
    .select("job_id")
    .eq("user_id", user.id)
    .in(
      "job_id",
      jobs.map((j) => j.id),
    );
  const saved = new Set(data?.map((s) => s.job_id));
  return jobs.map((j) => ({ ...j, saved: saved.has(j.id) }));
}
