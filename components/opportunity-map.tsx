"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapPin, RefreshCw, Search } from "lucide-react";
import { MapCanvas } from "./map-canvas";
import type { Coordinates, MapBounds, MappedOpportunity } from "@/lib/maps";

type Result = {
  opportunities: MappedOpportunity[];
  total: number;
  key: string;
  error?: string;
};
const EMPTY_OPPORTUNITIES: MappedOpportunity[] = [];
export function OpportunityMap({
  initialPosition,
}: {
  initialPosition?: Coordinates;
}) {
  const [bounds, setBounds] = useState<MapBounds | null>(null);
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [focus, setFocus] = useState<Coordinates | null>(null);
  const scrollToBusiness = useRef<string | null>(null);
  const keyword = query.trim().slice(0, 150);
  const key = JSON.stringify({ bounds, keyword, page, revision });
  const current = result?.key === key ? result : null;
  const opportunities = current?.opportunities ?? EMPTY_OPPORTUNITIES;
  const groups = useMemo(() => {
    const list = new Map<
      string,
      {
        id: string;
        label: string;
        latitude: number;
        longitude: number;
        jobs: MappedOpportunity[];
      }
    >();
    for (const job of opportunities) {
      const business = list.get(job.business_id);
      if (business) business.jobs.push(job);
      else
        list.set(job.business_id, {
          id: job.business_id,
          label: job.company,
          latitude: job.latitude,
          longitude: job.longitude,
          jobs: [job],
        });
    }
    return [...list.values()];
  }, [opportunities]);
  const pins = useMemo(
    () => groups.map((b) => ({ ...b, count: b.jobs.length })),
    [groups],
  );

  useEffect(() => {
    if (!bounds) return;
    const controller = new AbortController();
    let disposed = false;
    const timer = setTimeout(async () => {
      const params = new URLSearchParams({
        south: String(bounds.south),
        north: String(bounds.north),
        west: String(bounds.west),
        east: String(bounds.east),
        keyword,
        page_number: String(page),
      });
      try {
        const response = await fetch(`/api/maps/opportunities?${params}`, {
          signal: controller.signal,
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Map unavailable");
        const data = await response.json();
        if (!disposed) setResult({ ...data, key });
      } catch {
        if (!disposed)
          setResult({
            opportunities: [],
            total: 0,
            key,
            error: "Please try again shortly, or browse jobs as a list.",
          });
      }
    }, 350);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [bounds, keyword, page, key]);

  function choose(id: string) {
    setSelected(id);
    const business = groups.find((b) => b.id === id);
    if (business)
      setFocus({ latitude: business.latitude, longitude: business.longitude });
  }
  useEffect(() => {
    if (!current || !scrollToBusiness.current) return;
    const card = document.getElementById(
      `mapped-business-${scrollToBusiness.current}`,
    );
    if (card) {
      card.scrollIntoView({
        block: "nearest",
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "instant"
          : "smooth",
      });
      scrollToBusiness.current = null;
    }
  }, [current, selected]);
  return (
    <>
      <div className="map-discovery-toolbar">
        <label className="map-search">
          <Search size={19} aria-hidden="true" />
          <span className="sr-only">Search mapped opportunities</span>
          <input
            aria-label="Search mapped opportunities"
            placeholder="Job title or business name"
            value={query}
            maxLength={150}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
              setSelected(null);
            }}
          />
        </label>
        <button
          className="button outline small"
          onClick={() => setRevision((v) => v + 1)}
        >
          <RefreshCw size={16} aria-hidden="true" />
          Refresh map
        </button>
        <Link className="text-link" href="/jobs">
          Browse jobs as a list ↗
        </Link>
      </div>
      <div className="opportunity-map-layout">
        <div className="public-map-panel">
          <MapCanvas
            pins={pins}
            initialPosition={initialPosition}
            selectedId={selected}
            focusPoint={focus}
            onSelect={(id) => {
              scrollToBusiness.current = id;
              choose(id);
            }}
            onBoundsChange={(next) => {
              setBounds(next);
              setPage(1);
            }}
          />
          <p className="map-caption">
            Move or zoom the map to explore another area. Select a pin or
            business card to see its opportunities.
          </p>
        </div>
        <section
          className="map-results panel"
          aria-label="Opportunities in this map area"
          aria-busy={!current}
        >
          <div className="map-results-heading">
            <MapPin size={20} aria-hidden="true" />
            <h2>Opportunities nearby</h2>
          </div>
          {!current ? (
            <p role="status">Finding opportunities in this area…</p>
          ) : current.error ? (
            <div role="status">
              <h3>Map listings unavailable</h3>
              <p>{current.error}</p>
              <button
                className="button outline small"
                onClick={() => setRevision((v) => v + 1)}
              >
                Try again
              </button>
            </div>
          ) : !opportunities.length ? (
            <div className="map-no-results">
              <h3>No pinned opportunities in this area</h3>
              <p>
                Try moving the map, zooming out, or changing your search.
                Businesses appear here after adding a pin and publishing an open
                job.
              </p>
              <Link href="/jobs" className="text-link">
                Explore all jobs ↗
              </Link>
            </div>
          ) : (
            <>
              <p className="map-result-count">
                {current.total}{" "}
                {current.total === 1 ? "opportunity" : "opportunities"} in this
                area
                {current.total > 100
                  ? ` · Showing ${(page - 1) * 100 + 1}–${Math.min(page * 100, current.total)}`
                  : ""}
              </p>
              <div className="map-business-list">
                {groups.map((b) => (
                  <article
                    id={`mapped-business-${b.id}`}
                    key={b.id}
                    className={`map-business-card ${selected === b.id ? "selected" : ""}`}
                  >
                    <button
                      type="button"
                      className="map-business-select"
                      aria-pressed={selected === b.id}
                      onClick={() => choose(b.id)}
                    >
                      <span>
                        <strong>{b.label}</strong>
                        <small>{b.jobs[0].address}</small>
                      </span>
                      <span className="map-job-count">{b.jobs.length}</span>
                    </button>
                    <div className="map-business-jobs">
                      {b.jobs.map((job) => (
                        <Link key={job.id} href={`/jobs/${job.id}`}>
                          <strong>{job.title}</strong>
                          <span>
                            {job.employment_type} · {job.arrangement}
                          </span>
                        </Link>
                      ))}
                    </div>
                    <div className="map-business-links">
                      <Link href={`/businesses/${b.id}`}>
                        Business profile ↗
                      </Link>
                      <a
                        href={`https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=;${b.latitude},${b.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Directions ↗
                      </a>
                    </div>
                  </article>
                ))}
              </div>
              {current.total > 100 && (
                <nav className="pagination" aria-label="Map result pages">
                  <button
                    className="button outline small"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    Previous
                  </button>
                  <span>Page {page}</span>
                  <button
                    className="button outline small"
                    disabled={page * 100 >= current.total}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    Next
                  </button>
                </nav>
              )}
            </>
          )}
        </section>
      </div>
    </>
  );
}
