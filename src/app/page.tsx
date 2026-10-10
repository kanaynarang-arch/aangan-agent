import type { Metadata } from "next";
import Link from "next/link";
import { filterCounts, listCalls, TIER_OPTIONS, type ListFilter, type TierOption } from "@/lib/queries";
import { TierBadge, SourceChips, duration, href, parseSource, when } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Designer view" };

const TABS: { key: ListFilter; label: string }[] = [
  { key: "all", label: "All calls" },
  { key: "verify", label: "Verify queue" },
  { key: "urgent", label: "Urgent and callbacks" },
  { key: "handed", label: "Handed to designers" },
];
const TIER_LABEL: Record<TierOption, string> = { green: "Green", amber: "Amber", red: "Red", escalate: "Escalate", dropped: "Dropped" };

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function DesignerView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const source = parseSource(sp.source) ?? "all";
  const filter = (TABS.find((t) => t.key === one(sp.filter))?.key ?? "all") as ListFilter;
  const tier = TIER_OPTIONS.find((t) => t === one(sp.tier));
  const q = (one(sp.q) ?? "").trim().slice(0, 80);
  const filtering = Boolean(q || tier || filter !== "all");

  const [calls, counts] = await Promise.all([listCalls(filter, source, { q, tier }), filterCounts(source)]);
  // Filters that must survive every link and form on this page.
  const keep = { source: parseSource(sp.source) ? source : undefined, q: q || undefined, tier };
  const clearHref = href("/", { source: keep.source });

  return (
    <>
      <h1>Designer view</h1>
      <p className="sub">Every call the agent has handled, with what was asked and what happened next.</p>

      <SourceChips base="/" source={source} keep={{ filter: filter === "all" ? undefined : filter, q: keep.q, tier }} />

      <nav className="chips" aria-label="Call lists">
        <span className="chiplabel">List</span>
        {TABS.map((t) => (
          <Link key={t.key} href={href("/", { ...keep, filter: t.key === "all" ? undefined : t.key })} className="chip" aria-current={filter === t.key ? "true" : undefined}>
            {t.label}<b>{counts[t.key]}</b>
          </Link>
        ))}
      </nav>

      {filter !== "verify" && counts.verify > 0 && (
        <p className="callout" role="note">
          <span>{counts.verify} lead{counts.verify === 1 ? " is" : "s are"} waiting for a designer.</span>
          <Link href={href("/", { source: keep.source, filter: "verify" })}>Open the verify queue →</Link>
        </p>
      )}

      <form className="filters" role="search" action="/" method="get">
        {keep.source && <input type="hidden" name="source" value={keep.source} />}
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <div className="field grow">
          <label htmlFor="q">Search name, phone or location</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="For example Priya, 90000, Kothrud" autoComplete="off" />
        </div>
        <div className="field" style={{ minWidth: 150 }}>
          <label htmlFor="tier">Tier</label>
          <select id="tier" name="tier" defaultValue={tier ?? ""}>
            <option value="">All tiers</option>
            {TIER_OPTIONS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
          </select>
        </div>
        <button type="submit" className="b primary">Search</button>
        {filtering && <Link className="linkbtn" href={clearHref}>Clear filters</Link>}
      </form>

      <p className="note" aria-live="polite">
        {calls.length === 0 ? "No calls to show." : `Showing ${calls.length} call${calls.length === 1 ? "" : "s"}${calls.length === 200 ? " (the most recent 200)" : ""}.`}
      </p>

      <div className="panel tablewrap">
        {calls.length === 0 ? (
          <div className="empty">
            {filtering ? (
              <>
                <strong>No calls match</strong>
                <p>Try a different search or tier, or <Link className="linkbtn" href={clearHref}>clear filters</Link>.</p>
              </>
            ) : (
              <>
                <strong>No calls yet</strong>
                <p>Calls appear here a minute or two after they end.</p>
              </>
            )}
          </div>
        ) : (
          <table className="calls">
            <thead>
              <tr><th scope="col">When</th><th scope="col">Caller</th><th scope="col">Tier</th><th scope="col">Status</th><th scope="col">Project</th><th scope="col" className="nowrap">Duration</th></tr>
            </thead>
            <tbody>
              {calls.map((c) => (
                <tr key={c.id} className={`row tier-${c.tier ?? "pending"}`}>
                  <td data-label="When" className="small num">{when(c.started_at)}</td>
                  <td data-label="Caller" className="primary">
                    <Link className="rowlink" href={`/calls/${c.id}`}>{c.fields?.name ?? c.caller_phone ?? "Unknown caller"}</Link>
                    <div className="tags">
                      <span className={`tag${c.source === "live" ? " live" : ""}`}>{c.source === "live" ? "Live" : `Test${c.fixture_id ? ` ${c.fixture_id}` : ""}`}</span>
                      {c.flags?.asked_about_price && <span className="tag flag">Asked price</span>}
                      {c.flags?.handle_with_care && <span className="tag flag">Handle with care</span>}
                      {c.flags?.repeat_caller && <span className="tag">Repeat caller</span>}
                    </div>
                    {c.caller_phone && <div className="muted small num">{c.caller_phone}</div>}
                  </td>
                  <td data-label="Tier"><TierBadge tier={c.tier} /></td>
                  <td data-label="Status" className="small">
                    {c.status === "failed" ? "Processing failed" : c.status !== "processed" ? "Processing" : c.outcome}
                    {c.review_status === "pending" && <div>Waiting for a designer</div>}
                    {c.consultation_booked && <div className="muted">Consultation booked</div>}
                  </td>
                  <td data-label="Project" className="small">{[c.fields?.scope, c.fields?.location].filter(Boolean).join(" · ") || <span className="muted">Not captured</span>}</td>
                  <td data-label="Duration" className="small num nowrap">{duration(c.duration_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
