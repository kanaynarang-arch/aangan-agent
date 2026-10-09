import Link from "next/link";
import { filterCounts, listCalls, type ListFilter } from "@/lib/queries";
import { TierBadge, SourceChips, parseSource, when } from "@/components/ui";

export const dynamic = "force-dynamic";

const TABS: { key: ListFilter; label: string }[] = [
  { key: "all", label: "All calls" },
  { key: "verify", label: "Verify queue" },
  { key: "urgent", label: "Urgent and callbacks" },
  { key: "handed", label: "Handed to designers" },
];

export default async function DesignerView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const source = parseSource(sp.source);
  const filter = (TABS.find((t) => t.key === sp.filter)?.key ?? "all") as ListFilter;
  const [calls, counts] = await Promise.all([listCalls(filter, source), filterCounts(source)]);

  return (
    <>
      <h1>Designer view</h1>
      <p className="sub">Every call the agent has handled, with what was asked and what happened next.</p>
      <SourceChips base={`/?filter=${filter}`} source={source} />
      <div className="chips">
        {TABS.map((t) => (
          <Link key={t.key} href={`/?filter=${t.key}&source=${source}`} className={`chip ${filter === t.key ? "on" : ""}`}>
            {t.label}<b>{counts[t.key]}</b>
          </Link>
        ))}
      </div>
      <div className="panel scroll" style={{ padding: 0 }}>
        <table>
          <thead>
            <tr><th>When</th><th>Caller</th><th>Tier</th><th>Status</th><th>Project</th><th>Duration</th></tr>
          </thead>
          <tbody>
            {calls.length === 0 && (
              <tr><td colSpan={6} className="muted" style={{ padding: 24 }}>No calls here yet.</td></tr>
            )}
            {calls.map((c) => (
              <tr key={c.id} className="row">
                <td className="small">{when(c.started_at)}</td>
                <td>
                  <Link className="rowlink" href={`/calls/${c.id}`}>{c.fields?.name ?? c.caller_phone ?? "Unknown caller"}</Link>
                  {c.source === "test" && <span className="tag">test{c.fixture_id ? ` ${c.fixture_id}` : ""}</span>}
                  {c.flags?.asked_about_price && <span className="tag flag">asked price</span>}
                  {c.flags?.handle_with_care && <span className="tag flag">handle with care</span>}
                  {c.flags?.repeat_caller && <span className="tag">repeat</span>}
                  <div className="muted small">{c.caller_phone ?? ""}</div>
                </td>
                <td><TierBadge tier={c.tier} /></td>
                <td>
                  {c.status === "failed" ? "Processing failed" : c.status !== "processed" ? "Processing" : c.outcome}
                  {c.review_status === "pending" && <div className="small" style={{ color: "var(--amber)" }}>Waiting for designer</div>}
                  {c.consultation_booked && <div className="small muted">Consultation booked</div>}
                </td>
                <td className="small">{[c.fields?.scope, c.fields?.location].filter(Boolean).join(" · ") || <span className="muted">-</span>}</td>
                <td className="small">{Math.floor(c.duration_seconds / 60)}m {c.duration_seconds % 60}s</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
