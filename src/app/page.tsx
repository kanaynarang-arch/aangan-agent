import type { Metadata } from "next";
import Link from "next/link";
import { filterCounts, listCalls, TIER_OPTIONS, type CallListItem, type ListFilter, type TierOption } from "@/lib/queries";
import { captureSummary } from "@/lib/capture";
import { ago, initials } from "@/lib/format";
import { Icon } from "@/components/Icon";
import { SourceSwitch, TierBadge, formatPhone, href, parseSource, telHref, whenFull } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Designer view" };

const TABS: { key: ListFilter; label: string }[] = [
  { key: "all", label: "Everything" },
  { key: "verify", label: "Needs a decision" },
  { key: "urgent", label: "Call back now" },
  { key: "handed", label: "Handed to designers" },
];
const TIER_LABEL: Record<TierOption, string> = { green: "Green", amber: "Amber", red: "Red", escalate: "Escalate", dropped: "Dropped" };
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

function statusText(c: CallListItem): string {
  if (c.status === "failed") return "Processing failed";
  if (c.status !== "processed") return "Being scored";
  if (c.review_status === "pending") return "Waiting for a designer";
  if (c.tier === "escalate") return "Urgent: call back within 15 minutes";
  if (c.tier === "dropped") return "Call back: no details captured";
  if (c.tier === "green") return c.consultation_booked ? "Consultation booked" : "Handed to a designer";
  return c.outcome ?? "Closed";
}

function LeadCard({ c }: { c: CallListItem }) {
  const f = c.fields;
  const live = c.source === "live";
  const tel = live ? telHref(c.caller_phone) : null;
  const urgent = c.tier === "escalate" || c.tier === "dropped";
  const cap = f && c.status === "processed" && (c.tier === "green" || c.tier === "amber" || c.tier === "red") ? captureSummary(f, c.caller_phone) : null;
  return (
    <li className={`lead t-${c.tier ?? "pending"}`}>
      <span className="avatar" aria-hidden="true">{initials(f?.name, c.caller_phone)}</span>
      <div>
        <div className="who">
          <Link className="name" href={`/calls/${c.id}`}>{f?.name ?? (c.caller_phone ? formatPhone(c.caller_phone) : "Unknown caller")}</Link>
          <span className="tags">
            <span className={`tag${live ? " live" : ""}`}>{live ? "Live" : `Test${c.fixture_id ? ` ${c.fixture_id}` : ""}`}</span>
            {c.outside_hours && <span className="tag" title="Came in outside 10am to 7pm, when the front desk is closed"><Icon name="moon" />After hours</span>}
            {c.flags?.asked_about_price && <span className="tag flag">Asked price</span>}
            {c.flags?.handle_with_care && <span className="tag flag">Handle with care</span>}
            {c.flags?.repeat_caller && <span className="tag">Repeat caller</span>}
          </span>
        </div>
        <p className="project">{f?.scope || <span className="muted">No project details captured</span>}</p>
        <div className="facts">
          {f?.location && <span><Icon name="pin" />{f.location}</span>}
          {f?.carpet_area_sqft ? <span><Icon name="ruler" />{f.carpet_area_sqft.toLocaleString("en-IN")} sq ft</span> : null}
          {c.caller_phone && (tel
            ? <span><Icon name="phone" /><a className="calllink" href={tel} aria-label={`Call ${formatPhone(c.caller_phone)}`}>{formatPhone(c.caller_phone)}</a></span>
            : <span><Icon name="phone" />{formatPhone(c.caller_phone)}</span>)}
          {cap && (
            <span className="mini-meter" title={`${cap.answered} of ${cap.total} questions already answered`}>
              <i><b style={{ width: `${(cap.answered / cap.total) * 100}%` }} /></i>{cap.answered} of {cap.total} answered
            </span>
          )}
        </div>
      </div>
      <div className="side-r">
        <TierBadge tier={c.tier} />
        <span className="status">{statusText(c)}</span>
        <span className="when num" title={whenFull(c.started_at)}>{ago(c.started_at)}</span>
        {urgent && tel && <span className="acts"><a className="b sm primary" href={tel}><Icon name="phone" />Call back</a></span>}
      </div>
    </li>
  );
}

const GROUPS: { key: string; title: string; blurb: string; test: (c: CallListItem) => boolean }[] = [
  { key: "callback", title: "Call back now", blurb: "An unhappy existing client, or a caller who dropped before giving any details.", test: (c) => c.tier === "escalate" || c.tier === "dropped" },
  { key: "decide", title: "Needs a decision", blurb: "Amber and red leads wait for you. Approve to hand off, or drop.", test: (c) => c.review_status === "pending" },
  { key: "handed", title: "Handed to designers", blurb: "Qualified leads with everything already asked.", test: (c) => c.tier === "green" },
];

export default async function DesignerView({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const source = parseSource(sp.source) ?? "all";
  const filter = (TABS.find((t) => t.key === one(sp.filter))?.key ?? "all") as ListFilter;
  const tier = TIER_OPTIONS.find((t) => t === one(sp.tier));
  const q = (one(sp.q) ?? "").trim().slice(0, 80);
  const filtering = Boolean(q || tier || filter !== "all");

  const [calls, counts] = await Promise.all([listCalls(filter, source, { q, tier }), filterCounts(source)]);
  const keep = { source: parseSource(sp.source) ? source : undefined, q: q || undefined, tier };
  const clearHref = href("/", { source: keep.source });

  // Everything view with no search: group by what the designer should do next. Otherwise a flat list.
  const placed = new Set<string>();
  const sections: { key: string; title: string; blurb: string; items: CallListItem[] }[] = filtering
    ? [{ key: "results", title: "Results", blurb: "", items: calls }]
    : [
        ...GROUPS.map((g) => ({ key: g.key, title: g.title, blurb: g.blurb, items: calls.filter((c) => { if (placed.has(c.id) || !g.test(c)) return false; placed.add(c.id); return true; }) })),
        { key: "closed", title: "Closed", blurb: "Closed politely, decided by a designer, or still being scored.", items: calls.filter((c) => !placed.has(c.id)) },
      ].filter((g) => g.items.length > 0);

  return (
    <>
      <header className="pagehead">
        <div>
          <p className="eyebrow">For designers</p>
          <h1>Your leads</h1>
          <p className="lede">Everything the agent asked, ready before your first call, with the ones that need you at the top.</p>
        </div>
        <SourceSwitch base="/" source={source} keep={{ filter: filter === "all" ? undefined : filter, q: keep.q, tier }} />
      </header>

      <nav className="chips" aria-label="Lists">
        {TABS.map((t) => (
          <Link key={t.key} href={href("/", { ...keep, filter: t.key === "all" ? undefined : t.key })} className="chip" aria-current={filter === t.key ? "true" : undefined}>
            {t.label}<b>{counts[t.key]}</b>
          </Link>
        ))}
      </nav>

      <form className="filters" role="search" action="/" method="get">
        {keep.source && <input type="hidden" name="source" value={keep.source} />}
        {filter !== "all" && <input type="hidden" name="filter" value={filter} />}
        <div className="field grow">
          <label htmlFor="q">Search by name, phone or location</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="Try Priya, 90000 or Kothrud" autoComplete="off" />
        </div>
        <div className="field" style={{ minWidth: 150 }}>
          <label htmlFor="tier">Tier</label>
          <select id="tier" name="tier" defaultValue={tier ?? ""}>
            <option value="">All tiers</option>
            {TIER_OPTIONS.map((t) => <option key={t} value={t}>{TIER_LABEL[t]}</option>)}
          </select>
        </div>
        <button type="submit" className="b primary"><Icon name="search" />Search</button>
        {filtering && <Link className="linkbtn" href={clearHref}>Clear filters</Link>}
      </form>

      <p className="note" aria-live="polite">{calls.length === 0 ? "No calls to show." : `${calls.length} call${calls.length === 1 ? "" : "s"}${calls.length === 200 ? " (the most recent 200)" : ""}`}</p>

      {calls.length === 0 ? (
        <div className="card empty">
          <Icon name={filtering ? "search" : "inboxzero"} />
          {filtering ? (
            <><strong>No calls match</strong><p>Try a different search or tier, or <Link className="linkbtn" href={clearHref}>clear filters</Link>.</p></>
          ) : (
            <><strong>Nothing here yet</strong><p>Calls appear a minute or two after they end.</p></>
          )}
        </div>
      ) : (
        sections.map((g) => (
          <section key={g.key} className="group" aria-labelledby={`g-${g.key}`}>
            <header>
              <h2 id={`g-${g.key}`}>{g.title}</h2>
              <span className="count">{g.items.length}</span>
              {g.blurb && <p>{g.blurb}</p>}
            </header>
            <ul className="leads" style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {g.items.map((c) => <LeadCard key={c.id} c={c} />)}
            </ul>
          </section>
        ))
      )}
    </>
  );
}
