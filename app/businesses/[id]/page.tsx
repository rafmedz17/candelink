import { BusinessProfileHero } from "@/components/business-profile-hero";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header, Footer, JobCard } from "@/components/site";
import { ActionForm } from "@/components/forms";
import { samples } from "@/lib/business-samples";
import { supabase } from "@/lib/supabase/server";
import { getJobs } from "@/lib/data";
import { BusinessFollowButton } from "@/components/business-follow-button";
export default async function BusinessDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await supabase();
  const { data: b } = db
    ? await db
        .from("businesses")
        .select(
          "id,name,category,address,description,operating_details,logo_path,cover_paths",
        )
        .eq("id", id)
        .eq("verification_status", "verified")
        .single()
    : { data: samples.find((b) => b.id === id) };
  if (!b) notFound();
  const user = db ? (await db.auth.getUser()).data.user : null;
  const { data: viewer } = user
    ? await db!
        .from("profiles")
        .select("role,suspended")
        .eq("id", user.id)
        .maybeSingle()
    : { data: null };
  const followState =
    viewer?.role === "jobseeker" && !viewer.suspended
      ? await db!.rpc("business_follow_state", { bid: id })
      : null;
  const { jobs, demo } = await getJobs(100, db ? id : undefined);
  const listings = jobs.filter((j) =>
    db ? j.business_id === id : j.company === b.name,
  );
  return (
    <>
      <Header />
      <main id="main-content" className="page-bg business-detail-page">
        <div className="container">
          <BusinessProfileHero
            actions={
              db &&
              (!user ||
                (viewer?.role === "jobseeker" && !viewer.suspended)) && (
                <BusinessFollowButton
                  key={id}
                  businessId={id}
                  loggedIn={Boolean(user)}
                  following={Boolean(followState?.data)}
                  unavailable={Boolean(followState?.error)}
                />
              )
            }
            name={b.name}
            category={db ? b.category : "FICTIONAL SAMPLE BUSINESS"}
            address={b.address}
            logo={
              "logo_path" in b && typeof b.logo_path === "string"
                ? b.logo_path
                : null
            }
            photos={
              "cover_paths" in b && Array.isArray(b.cover_paths)
                ? b.cover_paths
                : []
            }
          />
          <div className="panel business-intro">
            <h2>A little about us</h2>
            <p>{b.description}</p>
            {"operating_details" in b && (
              <p>{String(b.operating_details || "")}</p>
            )}
          </div>
          <h2 className="listing-section-title">
            Opportunities with this team
          </h2>
          <div className="jobs-grid">
            {listings.map((j) => (
              <JobCard key={j.id} job={j} demo={demo} />
            ))}
          </div>
          {!listings.length && (
            <div className="empty-state business-empty-state">
              <h2>No open roles right now</h2>
              <p>
                This team does not have a published opportunity at the moment.
              </p>
              <Link className="button outline" href="/businesses">
                Explore other local businesses
              </Link>
            </div>
          )}
          {db && (
            <details className="panel" style={{ marginTop: 30 }}>
              <summary>Report this business</summary>
              <ActionForm
                kind="report"
                hidden={{ subject_type: "business", subject_id: id }}
                fields={[
                  {
                    name: "reason",
                    label: "Reason",
                    type: "textarea",
                    required: true,
                  },
                ]}
                submit="Submit report"
              />
            </details>
          )}
        </div>
      </main>
      <Footer />
    </>
  );
}
