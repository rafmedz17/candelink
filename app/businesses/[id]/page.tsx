import { notFound } from "next/navigation";
import { Header, Footer, PageTitle, JobCard } from "@/components/site";
import { ActionForm } from "@/components/forms";
import { samples } from "@/lib/business-samples";
import { supabase } from "@/lib/supabase/server";
import { getJobs } from "@/lib/data";
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
        .select("id,name,category,address,description,operating_details")
        .eq("id", id)
        .eq("verification_status", "verified")
        .single()
    : { data: samples.find((b) => b.id === id) };
  if (!b) notFound();
  const { jobs, demo } = await getJobs(100, db ? id : undefined);
  const listings = jobs.filter((j) =>
    db ? j.business_id === id : j.company === b.name,
  );
  return (
    <>
      <Header />
      <main id="main-content" className="page-bg">
        <div className="container">
          <PageTitle
            eyebrow={db ? b.category : "FICTIONAL SAMPLE BUSINESS"}
            title={b.name}
            description={`${b.category} Â· ${b.address}`}
          />
          <div className="panel">
            <h2>A little about us</h2>
            <p>{b.description}</p>
            {"operating_details" in b && (
              <p>{String(b.operating_details || "")}</p>
            )}
          </div>
          <h2 style={{ marginBlock: 25 }}>Opportunities with this team</h2>
          <div className="jobs-grid">
            {listings.map((j) => (
              <JobCard key={j.id} job={j} demo={demo} />
            ))}
          </div>
          {!listings.length && (
            <p>No published opportunities right now. Check back soon.</p>
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
