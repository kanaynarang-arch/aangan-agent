export default function Loading() {
  return (
    <div role="status" aria-live="polite" aria-label="Loading">
      <header className="pagehead"><div><p className="eyebrow">Aangan Studio</p><h1>Loading…</h1><p className="lede">Getting the latest calls.</p></div></header>
      <div className="skeleton" style={{ width: "100%", height: 96, borderRadius: 18 }} />
      <div className="skeleton" style={{ width: "100%", height: 96, borderRadius: 18 }} />
      <div className="skeleton" style={{ width: "100%", height: 96, borderRadius: 18 }} />
    </div>
  );
}
