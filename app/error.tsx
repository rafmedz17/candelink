"use client";
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main id="main-content" className="container section">
      <div className="empty-state">
        <h2>We couldn’t load this connection.</h2>
        <p>Please try again in a moment. Your information is safe.</p>
        <button className="button" onClick={reset}>
          Try again
        </button>
      </div>
    </main>
  );
}
