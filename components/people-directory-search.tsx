"use client";
import { useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

export function PeopleDirectorySearch({ query }: { query: string }) {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composing = useRef(false);
  const [pending, startTransition] = useTransition();
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );
  useEffect(() => {
    if (
      input.current &&
      document.activeElement !== input.current &&
      !timer.current
    )
      input.current.value = query;
  }, [query]);
  function search(value: string, immediate = false) {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (composing.current) return;
    const update = () => {
      timer.current = null;
      const q = value.trim().slice(0, 100);
      startTransition(() =>
        router.replace(
          q ? `/people?${new URLSearchParams({ q })}` : "/people",
          { scroll: false },
        ),
      );
    };
    if (immediate || !value.trim()) update();
    else timer.current = setTimeout(update, 300);
  }
  return (
    <>
      <form
        action="/people"
        className="hero-search page-search"
        role="search"
        aria-label="Search public profiles"
        onSubmit={(event) => {
          event.preventDefault();
          search(input.current?.value || "", true);
        }}
      >
        <Search size={20} aria-hidden="true" />
        <input
          ref={input}
          name="q"
          defaultValue={query}
          aria-label="Name or skill"
          placeholder="Search a name or skill"
          maxLength={100}
          onChange={(event) => search(event.currentTarget.value)}
          onCompositionStart={() => {
            composing.current = true;
            if (timer.current) clearTimeout(timer.current);
          }}
          onCompositionEnd={(event) => {
            composing.current = false;
            search(event.currentTarget.value);
          }}
        />
        <button className="button">Search profiles</button>
      </form>
      {pending && (
        <p className="people-search-progress" role="status">
          Updating profiles…
        </p>
      )}
    </>
  );
}
