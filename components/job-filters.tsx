"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown, SlidersHorizontal } from "lucide-react";

export function JobFilters({
  children,
  activeCount,
}: {
  children: ReactNode;
  activeCount: number;
}) {
  const [open, setOpen] = useState(false);
  const contentId = useId();
  return (
    <section
      className={`job-filters ${open ? "is-open" : ""}`}
      aria-label="Job filters"
    >
      <button
        className="button outline filters-toggle"
        type="button"
        aria-expanded={open}
        aria-controls={contentId}
        onClick={() => setOpen(!open)}
      >
        <SlidersHorizontal size={18} aria-hidden="true" />
        Filters{activeCount > 0 ? ` (${activeCount})` : ""}
        <ChevronDown size={17} aria-hidden="true" />
      </button>
      <div id={contentId} className="filters-content">
        {children}
      </div>
    </section>
  );
}
