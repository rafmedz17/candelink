"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import {
  ArrowUpRight,
  LoaderCircle,
  Search,
  BriefcaseBusiness,
} from "lucide-react";

type JobSuggestion = {
  id: string;
  title: string;
  company: string;
  location: string;
};
type SearchResult = {
  query: string;
  jobs: JobSuggestion[];
  error: boolean;
};

export function HeroJobSearch() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<SearchResult | null>(null);
  const keyword = query.trim();
  const ready = keyword.length >= 1;
  const current = result?.query === keyword ? result : null;
  const jobs = current?.jobs ?? [];
  const expanded = open && keyword.length > 0;
  const loading = expanded && ready && !current;
  const resultsHref = `/jobs?q=${encodeURIComponent(keyword)}`;

  useEffect(() => {
    if (!open || !ready) return;
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/jobs/suggestions?q=${encodeURIComponent(keyword)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error("Search unavailable");
        const data = (await response.json()) as { jobs: JobSuggestion[] };
        if (!cancelled) {
          setResult({
            query: keyword,
            jobs: data.jobs,
            error: false,
          });
        }
      } catch {
        if (!cancelled) setResult({ query: keyword, jobs: [], error: true });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [keyword, open, ready]);

  useEffect(() => {
    function dismiss(event: PointerEvent) {
      if (!root.current?.contains(event.target as Node)) {
        setOpen(false);
        setActive(-1);
      }
    }
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  function close() {
    setOpen(false);
    setActive(-1);
  }

  return (
    <div
      ref={root}
      className="hero-job-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <form
        action="/jobs"
        role="search"
        aria-label="Find jobs"
        className="hero-search"
        onSubmit={close}
      >
        <Search size={21} aria-hidden="true" />
        <input
          name="q"
          role="combobox"
          aria-label="Job title, keyword, or company"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={
            expanded && jobs[active] ? `${listId}-${active}` : undefined
          }
          placeholder="Job title, keyword, or company"
          autoComplete="off"
          maxLength={100}
          minLength={1}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setOpen(true);
            setActive(-1);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              event.preventDefault();
              close();
            } else if (event.key === "ArrowDown" || event.key === "ArrowUp") {
              event.preventDefault();
              setOpen(true);
              if (!jobs.length) return;
              const next =
                event.key === "ArrowDown"
                  ? (active + 1) % jobs.length
                  : active <= 0
                    ? jobs.length - 1
                    : active - 1;
              setActive(next);
              document
                .getElementById(`${listId}-${next}`)
                ?.scrollIntoView({ block: "nearest" });
            } else if (event.key === "Enter" && expanded && jobs[active]) {
              event.preventDefault();
              close();
              setQuery("");
              router.push(`/jobs/${jobs[active].id}`);
            }
          }}
        />
        <button type="submit" className="button" aria-label="Find jobs">
          Find jobs
          {loading ? (
            <LoaderCircle
              size={18}
              className="search-spinner"
              aria-hidden="true"
            />
          ) : (
            <ArrowUpRight size={17} aria-hidden="true" />
          )}
        </button>
      </form>
      {expanded && (
        <div className="people-suggestions">
          <div className="people-suggestions-label">Jobs</div>
          <div
            id={listId}
            role="listbox"
            aria-label="Suggested jobs"
            aria-busy={loading}
          >
            {jobs.map((job, index) => (
              <Link
                key={job.id}
                id={`${listId}-${index}`}
                href={`/jobs/${job.id}`}
                role="option"
                aria-selected={index === active}
                tabIndex={-1}
                className="people-suggestion"
                onMouseEnter={() => setActive(index)}
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => {
                  close();
                  setQuery("");
                }}
              >
                <span className="search-job-avatar">
                  <BriefcaseBusiness size={20} aria-hidden="true" />
                </span>
                <span className="search-job-copy">
                  <strong>{job.title}</strong>
                  <span>
                    {[job.company, job.location].filter(Boolean).join(" - ")}
                  </span>
                </span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            ))}
          </div>
          {(!ready || loading || current?.error || !jobs.length) && (
            <p className="people-suggestions-status" role="status">
              {!ready
                ? "Type a job title, keyword, or company."
                : loading
                  ? "Finding jobs…"
                  : current?.error
                    ? "Search is unavailable right now. Please try again."
                    : "No matching jobs. Try another keyword."}
            </p>
          )}
          {ready && (
            <Link
              href={resultsHref}
              className="people-search-all"
              onClick={close}
            >
              See all results <ArrowUpRight size={15} aria-hidden="true" />
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
