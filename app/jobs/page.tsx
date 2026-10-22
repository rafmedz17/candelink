import Link from "next/link";
import { Search } from "lucide-react";
import { Header, Footer, PageTitle, JobCard } from "@/components/site";
import { searchJobs } from "@/lib/data";
export default async function Jobs({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  const { jobs: filtered, total, demo, page } = await searchJobs(p);
  const url = (n: number) =>
    `/jobs?${new URLSearchParams({ ...p, page: String(n) })}`;
  return (
    <>
      <Header />
      <main id="main-content" className="page-bg">
        <div className="container">
          <PageTitle
            eyebrow="FIND YOUR PLACE. CLOSE TO HOME."
            title="A world of opportunity, locally."
            description="Discover meaningful work with businesses in Candelaria and beyond."
          />
          <form
            action="/jobs"
            className="hero-search"
            style={{ width: "100%", marginTop: 0 }}
          >
            <Search size={20} />
            <input
              style={{ flex: 1 }}
              name="q"
              defaultValue={p.q}
              aria-label="Search jobs"
              placeholder="Search by job title, company, or keyword"
            />
            <button className="button">Search opportunities</button>
          </form>
          <div className="discovery">
            <form className="filter-panel" action="/jobs">
              <h3>Refine your search</h3>
              <input type="hidden" name="q" value={p.q || ""} />
              <label>
                Employment type
                <select name="type" defaultValue={p.type || ""}>
                  <option value="">All job types</option>
                  {["Full-time", "Part-time", "Contract", "Internship"].map(
                    (v) => (
                      <option key={v}>{v}</option>
                    ),
                  )}
                </select>
              </label>
              <label>
                Work arrangement
                <select name="arrangement" defaultValue={p.arrangement || ""}>
                  <option value="">All arrangements</option>
                  {["On-site", "Hybrid", "Remote"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </label>
              <label>
                Location
                <input
                  className="field"
                  name="location"
                  defaultValue={p.location}
                  placeholder="e.g. Poblacion"
                />
              </label>
              <label>
                Sort by
                <select name="sort" defaultValue={p.sort || "newest"}>
                  <option value="newest">Most recent</option>
                  <option value="salary">Highest salary</option>
                </select>
              </label>
              <button className="button">Apply filters</button>
              <Link href="/jobs" className="text-link">
                Clear all filters
              </Link>
            </form>
            <div>
              <div className="results-head">
                <span>
                  {total} {demo ? "sample opportunities" : "opportunities"}
                </span>
                <span>Made for your next chapter</span>
              </div>
              {total ? (
                <div className="jobs-grid">
                  {filtered.map((j) => (
                    <JobCard key={j.id} job={j} demo={demo} />
                  ))}
                </div>
              ) : (
                <div className="empty-state">
                  <h2>No opportunities found</h2>
                  <p>Try a different keyword or broaden your filters.</p>
                  <Link className="button outline" href="/jobs">
                    Reset search
                  </Link>
                </div>
              )}
              {total > 8 && (
                <nav className="pagination" aria-label="Results pages">
                  {page > 1 && <Link href={url(page - 1)}>← Previous</Link>}
                  <span>Page {page}</span>
                  {page * 8 < total && <Link href={url(page + 1)}>Next →</Link>}
                </nav>
              )}
              {demo && (
                <p className="sample-note">
                  Demonstration content. These are not active vacancies.
                </p>
              )}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
