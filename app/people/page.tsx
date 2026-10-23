import Image from "next/image";
import Link from "next/link";
import { MapPin, Search, UsersRound } from "lucide-react";
import { Header, Footer, PageTitle } from "@/components/site";
import { supabase } from "@/lib/supabase/server";

type Person = {
  id: string;
  full_name: string;
  headline: string;
  location: string;
  avatar_path: string | null;
};

export default async function People({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().slice(0, 100) : "";
  const page = Math.min(
    1000,
    Math.max(1, Math.floor(Number(params.page) || 1)),
  );
  const db = await supabase();
  let people: Person[] = [];
  let total = 0;
  let unavailable = !db;
  if (db && q.length >= 2) {
    const { data, error } = await db.rpc("search_people", {
      keyword: q,
      page_number: page,
    });
    unavailable = Boolean(error);
    if (!error && data) {
      people = data.people as Person[];
      total = data.total as number;
    }
  }
  const pageHref = (next: number) =>
    `/people?${new URLSearchParams({ q, page: String(next) })}`;
  return (
    <>
      <Header />
      <main id="main-content" className="page-bg people-page">
        <div className="container">
          <PageTitle
            eyebrow="YOUR LOCAL PROFESSIONAL COMMUNITY"
            title="Find people. Make connections."
            description="Search public profiles by name, professional headline, or skills."
          />
          <form
            action="/people"
            className="hero-search page-search"
            role="search"
            aria-label="Search public profiles"
          >
            <Search size={20} aria-hidden="true" />
            <input
              name="q"
              defaultValue={q}
              aria-label="Name or skill"
              placeholder="Search a name or skill"
              minLength={2}
              maxLength={100}
              required
            />
            <button className="button">Search profiles</button>
          </form>
          <p className="people-privacy-note">
            Only profiles made public by their owners appear here.
          </p>
          {unavailable ? (
            <div className="empty-state" role="status">
              <h2>People search is currently unavailable</h2>
              <p>Please try again in a moment.</p>
            </div>
          ) : q.length < 2 ? (
            <div className="empty-state">
              <UsersRound size={32} aria-hidden="true" />
              <h2>Who would you like to find?</h2>
              <p>
                Enter at least two characters to search your local community.
              </p>
            </div>
          ) : people.length ? (
            <>
              <p className="people-result-count">
                {total} public {total === 1 ? "profile" : "profiles"} found for
                “{q}”
              </p>
              <div className="people-grid">
                {people.map((person) => (
                  <Link
                    className="panel person-card"
                    key={person.id}
                    href={`/profiles/${person.id}`}
                  >
                    <div className="person-avatar">
                      {person.avatar_path ? (
                        <Image
                          src={
                            db!.storage
                              .from("avatars")
                              .getPublicUrl(person.avatar_path).data.publicUrl
                          }
                          alt=""
                          width={64}
                          height={64}
                          unoptimized
                        />
                      ) : (
                        <span aria-hidden="true">
                          {(person.full_name || "C").slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </div>
                    <h2>{person.full_name || "Community member"}</h2>
                    {person.headline && <p>{person.headline}</p>}
                    {person.location && (
                      <span className="person-location">
                        <MapPin size={14} aria-hidden="true" />
                        {person.location}
                      </span>
                    )}
                    <span className="text-link">
                      View profile <span aria-hidden="true">↗</span>
                    </span>
                  </Link>
                ))}
              </div>
              {total > 12 && (
                <nav className="pagination" aria-label="People results pages">
                  {page > 1 && <Link href={pageHref(page - 1)}>Previous</Link>}
                  <span>Page {page}</span>
                  {page * 12 < total && (
                    <Link href={pageHref(page + 1)}>Next</Link>
                  )}
                </nav>
              )}
            </>
          ) : (
            <div className="empty-state">
              <h2>No profiles found</h2>
              <p>
                Try another name or skill. Private profiles will not appear in
                search.
              </p>
              <Link className="button outline" href="/people">
                Start a new search
              </Link>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
