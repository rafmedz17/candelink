import Link from "next/link";
import { Header, Footer } from "@/components/site";
export default function NotFound() {
  return (
    <>
      <Header />
      <main id="main-content" className="container section">
        <div className="empty-state">
          <div className="eyebrow">404 · A LITTLE OFF THE MAP</div>
          <h2 style={{ marginTop: 15 }}>This connection could not be found.</h2>
          <p>
            The page may have moved, or the opportunity is no longer available.
          </p>
          <Link className="button" href="/jobs">
            Discover opportunities
          </Link>
        </div>
      </main>
      <Footer />
    </>
  );
}
