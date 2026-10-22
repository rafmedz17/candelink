import Link from "next/link";
import { notFound } from "next/navigation";
import { Header, Footer, PageTitle } from "@/components/site";
import { ApplyForm, ActionForm } from "@/components/forms";
import { SaveButton } from "@/components/save-button";
import { getJob } from "@/lib/data";
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { job } = await getJob((await params).id);
  return {
    title: job
      ? `${job.title} at ${job.company} | CANDELINK`
      : "Opportunity not found | CANDELINK",
  };
}
export default async function JobDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { job, demo } = await getJob((await params).id);
  if (!job) notFound();
  return (
    <>
      <Header />
      <main id="main-content" className="page-bg">
        <div className="container">
          <Link href="/jobs" className="back-link">
            ← Back to opportunities
          </Link>
          <PageTitle
            eyebrow={demo ? "SAMPLE OPPORTUNITY" : "YOUR NEXT CHAPTER"}
            title={job.title}
            description={`${job.company} · ${job.location}`}
          />
          <div className="detail-layout">
            <div>
              <article className="panel">
                <div
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <h2>About this opportunity</h2>
                  <SaveButton id={job.id} initial={job.saved} />
                </div>
                <p>{job.description}</p>
                {"responsibilities" in job && (
                  <>
                    <h3>Responsibilities</h3>
                    <p style={{ whiteSpace: "pre-line" }}>
                      {String(job.responsibilities)}
                    </p>
                    <h3>Qualifications</h3>
                    <p style={{ whiteSpace: "pre-line" }}>
                      {String(job.qualifications)}
                    </p>
                  </>
                )}
                <div className="tags">
                  <span>{job.employment_type}</span>
                  <span>{job.arrangement}</span>
                  <span>{job.category}</span>
                </div>
              </article>
              <section className="panel">
                <h2>Make your next move</h2>
                <ApplyForm id={job.id} sample={demo} />
              </section>
              {!demo && (
                <details className="panel">
                  <summary>Report this listing</summary>
                  <ActionForm
                    kind="report"
                    hidden={{ subject_type: "job", subject_id: job.id }}
                    fields={[
                      {
                        name: "reason",
                        label: "What concerns you about this listing?",
                        type: "textarea",
                        required: true,
                      },
                    ]}
                    submit="Send report"
                  />
                </details>
              )}
            </div>
            <aside>
              <div className="panel">
                <h2>At a glance</h2>
                <h3>Monthly salary</h3>
                <p>
                  {job.salary_min
                    ? `₱${job.salary_min.toLocaleString()} – ₱${job.salary_max?.toLocaleString()}`
                    : "Not disclosed"}
                </p>
                <h3>Work location</h3>
                <p>
                  {job.location} · {job.arrangement}
                </p>
                <h3>Employment</h3>
                <p>{job.employment_type}</p>
                {job.deadline && (
                  <>
                    <h3>Apply before</h3>
                    <p>{job.deadline}</p>
                  </>
                )}
                {job.business_id && (
                  <Link
                    className="text-link"
                    style={{ marginTop: 22 }}
                    href={`/businesses/${job.business_id}`}
                  >
                    Meet the business ↗
                  </Link>
                )}
              </div>
              <div className="panel">
                <h3>Keep your search safe</h3>
                <p>
                  Legitimate employers never ask you to pay to apply. Keep your
                  personal information private.
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
