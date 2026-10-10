export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      <h1>Loading…</h1>
      <p className="sub">Getting the latest calls.</p>
      <div className="skeleton" style={{ width: "100%" }} />
      <div className="skeleton" style={{ width: "92%" }} />
      <div className="skeleton" style={{ width: "96%" }} />
      <div className="skeleton" style={{ width: "70%" }} />
    </div>
  );
}
