import { Header, Footer, PageTitle } from "@/components/site";
import { OpportunityMap } from "@/components/opportunity-map";

export default async function Maps({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const lat =
    typeof params.lat === "string" && params.lat !== ""
      ? Number(params.lat)
      : NaN;
  const lng =
    typeof params.lng === "string" && params.lng !== ""
      ? Number(params.lng)
      : NaN;
  const initialPosition =
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -85 &&
    lat <= 85 &&
    lng >= -180 &&
    lng <= 180
      ? { latitude: lat, longitude: lng }
      : undefined;
  return (
    <>
      <Header />
      <main id="main-content" className="page-bg maps-page">
        <div className="container">
          <PageTitle
            eyebrow="FIND WORK CLOSE TO HOME"
            title="Explore opportunities on the map."
            description="Discover open jobs at local businesses. Pins mark business locations shared by their owners."
          />
          <OpportunityMap initialPosition={initialPosition} />
        </div>
      </main>
      <Footer />
    </>
  );
}
