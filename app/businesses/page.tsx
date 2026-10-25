import Link from "next/link";
import Image from "next/image";
import { Store, ArrowUpRight, MapPin, Search } from "lucide-react";
import { Header, Footer, PageTitle } from "@/components/site";
import { samples } from "@/lib/business-samples";
import { supabase } from "@/lib/supabase/server";
export default async function Businesses({
  searchParams,
}: {
  searchParams: Promise<Record<string, string>>;
}) {
  const db = await supabase();
  const q = (await searchParams).q || "";
  const { data, error } = db
    ? await db
        .from("businesses")
        .select("id,name,category,address,description,logo_path,cover_paths")
        .eq("verification_status", "verified")
        .order("name")
    : { data: samples, error: null };
  if (error) throw new Error("Could not load businesses.");
  const businesses = (data || []).filter((b) =>
    `${b.name} ${b.category}`.toLowerCase().includes(q.toLowerCase()),
  );
  return (
    <>
      <Header />
      <main id="main-content" className="page-bg businesses-page">
        <div className="container">
          <PageTitle
            eyebrow="ROOTED HERE. GROWING TOGETHER."
            title="Meet your local business community."
            description="Discover the people and teams making Candelaria thrive."
          />
          <form className="hero-search page-search">
            <Search size={20} aria-hidden="true" />
            <input
              aria-label="Search businesses"
              name="q"
              placeholder="Search business name or category"
              defaultValue={q}
            />
            <button className="button">Find businesses</button>
          </form>
          <div className="jobs-grid">
            {businesses.map((b, i) => {
              const logo =
                "logo_path" in b && typeof b.logo_path === "string"
                  ? b.logo_path
                  : null;
              const cover =
                "cover_paths" in b && Array.isArray(b.cover_paths)
                  ? b.cover_paths[0]
                  : null;
              const photoUrl = (path: string) =>
                `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/avatars/${path}`;
              return (
                <Link
                  href={`/businesses/${b.id}`}
                  key={b.id}
                  className={`panel business-directory-card ${cover ? "has-background" : ""}`}
                >
                  {cover && (
                    <span
                      className="business-directory-cover"
                      aria-hidden="true"
                    >
                      <Image
                        src={photoUrl(cover)}
                        alt=""
                        fill
                        unoptimized
                        sizes="(max-width: 600px) 100vw, 33vw"
                      />
                    </span>
                  )}
                  <span
                    className={`company-logo color-${i} ${logo ? "business-directory-logo" : ""}`}
                  >
                    {logo ? (
                      <Image
                        src={photoUrl(logo)}
                        alt={`${b.name} logo`}
                        width={56}
                        height={56}
                        unoptimized
                      />
                    ) : (
                      <Store size={23} />
                    )}
                  </span>
                  <h2>{b.name}</h2>
                  <div className="tags">
                    <span>{b.category}</span>
                  </div>
                  <span className="business-location">
                    <MapPin size={15} aria-hidden="true" /> {b.address}
                  </span>
                  <p>{b.description}</p>
                  <span className="text-link">
                    Meet the business <ArrowUpRight size={16} />
                  </span>
                </Link>
              );
            })}
          </div>
          {!businesses.length && (
            <div className="empty-state">
              <h2>No businesses found</h2>
              <p>Try another search. New connections are on their way.</p>
            </div>
          )}
          {!db && (
            <p className="sample-note">
              All businesses shown are fictional sample profiles. No
              verification or endorsement is claimed.
            </p>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
