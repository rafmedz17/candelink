import Link from "next/link";
import { Store, ArrowUpRight } from "lucide-react";
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
        .select("id,name,category,address,description")
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
      <main id="main-content" className="page-bg">
        <div className="container">
          <PageTitle
            eyebrow="ROOTED HERE. GROWING TOGETHER."
            title="Meet your local business community."
            description="Discover the people and teams making Candelaria thrive."
          />
          <form
            className="hero-search"
            style={{ width: "100%", marginTop: 0, marginBottom: 30 }}
          >
            <input
              style={{ flex: 1 }}
              aria-label="Search businesses"
              name="q"
              placeholder="Search business name or category"
              defaultValue={q}
            />
            <button className="button">Find businesses</button>
          </form>
          <div className="jobs-grid">
            {businesses.map((b, i) => (
              <Link href={`/businesses/${b.id}`} key={b.id} className="panel">
                <span className={`company-logo color-${i}`}>
                  <Store size={23} />
                </span>
                <h2 style={{ marginTop: 20, fontSize: 21 }}>{b.name}</h2>
                <span className="badge">{b.category}</span>
                <p style={{ marginTop: 15 }}>{b.description}</p>
                <span className="text-link" style={{ marginTop: 20 }}>
                  Meet the business <ArrowUpRight size={16} />
                </span>
              </Link>
            ))}
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
