export default function Loading() {
  return (
    <main id="main-content" className="container section" aria-label="Loading">
      <div className="skeleton" style={{ height: 70, marginBottom: 30 }} />
      <div className="jobs-grid">
        {[1, 2, 3].map((i) => (
          <div className="skeleton" key={i} />
        ))}
      </div>
    </main>
  );
}
