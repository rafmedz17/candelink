"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArrowUpRight, LoaderCircle, Search, UserRound } from "lucide-react";

type Person = {
  id: string;
  full_name: string;
  headline: string;
  avatar_url: string | null;
};
type SearchResult = {
  query: string;
  people: Person[];
  error: boolean;
};

export function PeopleSearch({ currentUserId }: { currentUserId?: string }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const listId = useId();
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [result, setResult] = useState<SearchResult | null>(null);
  const keyword = query.trim();
  const ready = keyword.length >= 2;
  const current = result?.query === keyword ? result : null;
  const people = current?.people ?? [];
  const expanded = open && keyword.length > 0;
  const loading = expanded && ready && !current;
  const resultsHref = `/people?q=${encodeURIComponent(keyword)}`;

  useEffect(() => {
    if (!open || !ready) return;
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(async () => {
      try {
        const response = await fetch(
          `/api/people/suggestions?q=${encodeURIComponent(keyword)}`,
          { signal: controller.signal, cache: "no-store" },
        );
        if (!response.ok) throw new Error("Search unavailable");
        const data = (await response.json()) as { people: Person[] };
        if (!cancelled) {
          setResult({
            query: keyword,
            people: data.people.filter((person) => person.id !== currentUserId),
            error: false,
          });
        }
      } catch {
        if (!cancelled) setResult({ query: keyword, people: [], error: true });
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timeout);
      controller.abort();
    };
  }, [keyword, open, ready, currentUserId]);

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
      className="nav-people-search"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close();
      }}
    >
      <form
        action="/people"
        role="search"
        aria-label="Find people"
        className="people-search-form"
        onSubmit={close}
      >
        <input
          name="q"
          role="combobox"
          aria-label="Search people"
          aria-autocomplete="list"
          aria-expanded={expanded}
          aria-controls={expanded ? listId : undefined}
          aria-activedescendant={
            expanded && people[active] ? `${listId}-${active}` : undefined
          }
          placeholder="Search people…"
          autoComplete="off"
          maxLength={100}
          minLength={2}
          required
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
              if (!people.length) return;
              const next =
                event.key === "ArrowDown"
                  ? (active + 1) % people.length
                  : active <= 0
                    ? people.length - 1
                    : active - 1;
              setActive(next);
              document
                .getElementById(`${listId}-${next}`)
                ?.scrollIntoView({ block: "nearest" });
            } else if (event.key === "Enter" && expanded && people[active]) {
              event.preventDefault();
              close();
              setQuery("");
              router.push(`/profiles/${people[active].id}`);
            }
          }}
        />
        <button type="submit" aria-label="Find people">
          {loading ? (
            <LoaderCircle
              size={18}
              className="search-spinner"
              aria-hidden="true"
            />
          ) : (
            <Search size={18} aria-hidden="true" />
          )}
        </button>
      </form>
      {expanded && (
        <div className="people-suggestions">
          <div className="people-suggestions-label">People</div>
          <div
            id={listId}
            role="listbox"
            aria-label="Suggested people"
            aria-busy={loading}
          >
            {people.map((person, index) => (
              <Link
                key={person.id}
                id={`${listId}-${index}`}
                href={`/profiles/${person.id}`}
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
                <span className="search-person-avatar">
                  {person.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element -- Public avatars use the project's configured Storage URL.
                    <img src={person.avatar_url} alt="" />
                  ) : (
                    <UserRound size={20} aria-hidden="true" />
                  )}
                </span>
                <span className="search-person-copy">
                  <strong>{person.full_name || "Community member"}</strong>
                  <span>{person.headline || "Candelink member"}</span>
                </span>
                <ArrowUpRight size={15} aria-hidden="true" />
              </Link>
            ))}
          </div>
          {(!ready || loading || current?.error || !people.length) && (
            <p className="people-suggestions-status" role="status">
              {!ready
                ? "Type at least 2 characters to find someone."
                : loading
                  ? "Finding people…"
                  : current?.error
                    ? "Search is unavailable right now. Please try again."
                    : "No matching public profiles. Try another name."}
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
