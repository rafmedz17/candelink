import Link from "next/link";
import { Search } from "lucide-react";
import { Header, Footer, PageTitle, JobCard } from "@/components/site";
import { searchJobs } from "@/lib/data";
import { JobFilters } from "@/components/job-filters";
export default async function Jobs({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const p = await searchParams;
  const { jobs: filtered, total, demo, page } = await searchJobs(p);
  const url = (n: number) =>
    `/jobs?${new URLSearchParams({ ...p, page: String(n) })}`;
  const activeFilters = [
    { key: "type", label: p.type },
    { key: "arrangement", label: p.arrangement },
    { key: "location", label: p.location },
  ].filter((filter) => Boolean(filter.label));
  const withoutFilter = (key: string) => {
    const query = new URLSearchParams(p);
    query.delete(key);
    query.delete("page");
    return `/jobs?${query}`;
  };
  return (
    <>
      <Header />
      <main id="main-content" className="page-bg jobs-page">
        <div className="container">
          <PageTitle
            eyebrow="FIND YOUR PLACE. CLOSE TO HOME."
            title="A world of opportunity, locally."
            description="Discover meaningful work with businesses in Candelaria and beyond."
          />
          <Link className="text-link map-browse-link" href="/maps">
            Explore opportunities on the map ↗
          </Link>
          <form action="/jobs" className="hero-search page-search">
            {["type", "arrangement", "location", "sort"].map((name) =>
              p[name] ? (
                <input key={name} type="hidden" name={name} value={p[name]} />
              ) : null,
            )}
            <Search size={20} />
            <input
              name="q"
              defaultValue={p.q}
              aria-label="Search jobs"
              placeholder="Search by job title, company, or keyword"
            />
            <button className="button">Search opportunities</button>
          </form>
          <div className="discovery">
            <JobFilters activeCount={activeFilters.length}>
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
            </JobFilters>
            <div className="jobs-results">
              {activeFilters.length > 0 && (
                <div className="active-filters" aria-label="Active filters">
                  {activeFilters.map((filter) => (
                    <Link
                      key={filter.key}
                      href={withoutFilter(filter.key)}
                      aria-label={`Remove ${filter.label} filter`}
                    >
                      {filter.label}
                      <span aria-hidden="true">×</span>
                    </Link>
                  ))}
                </div>
              )}
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
