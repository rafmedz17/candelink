import Image from "next/image";
import Link from "next/link";
import { MapPin } from "lucide-react";
import { PeopleDirectorySearch } from "@/components/people-directory-search";
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
  if (db) {
    const [{ data: auth }, { data, error }] = await Promise.all([
      db.auth.getUser(),
      db.rpc("search_people", {
        keyword: q,
        page_number: page,
      }),
    ]);
    unavailable = Boolean(error);
    if (!error && data) {
      const matches = data.people as Person[];
      // Also protect the page while hosted projects await the search migration.
      people = matches.filter((person) => person.id !== auth.user?.id);
      total = Math.max(
        0,
        (data.total as number) - (matches.length - people.length),
      );
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
          <PeopleDirectorySearch query={q} />
          <p className="people-privacy-note">
            Only profiles made public by their owners appear here. Your own
            profile is hidden when you’re logged in.
          </p>
          {unavailable ? (
            <div className="empty-state" role="status">
              <h2>People search is currently unavailable</h2>
              <p>Please try again in a moment.</p>
            </div>
          ) : people.length ? (
            <>
              <p className="people-result-count">
                {total} public {total === 1 ? "profile" : "profiles"}
                {q ? ` found for "${q}"` : " available"}
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
