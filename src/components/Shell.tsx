"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { ArchMark, Icon } from "./Icon";

function Brand() {
  return (
    <Link href="/" className="brand" aria-label="Aangan Studio, home">
      <ArchMark className="mark" />
      <span><b>Aangan Studio</b><small>Phone agent</small></span>
    </Link>
  );
}

function useHrefs() {
  const path = usePathname();
  const src = useSearchParams().get("source");
  const q = src ? `?source=${encodeURIComponent(src)}` : "";
  return { onPipeline: path.startsWith("/pipeline"), designer: `/${q}`, pipeline: `/pipeline${q}` };
}

function SideLinks({ waiting }: { waiting: number }) {
  const h = useHrefs();
  return (
    <nav className="navlist" aria-label="Views">
      <Link className="navlink" href={h.designer} aria-current={!h.onPipeline ? "page" : undefined}>
        <Icon name="inbox" />Designer view{waiting > 0 && <span className="count" title={`${waiting} waiting for a designer or a callback`}>{waiting}</span>}
      </Link>
      <Link className="navlink" href={h.pipeline} aria-current={h.onPipeline ? "page" : undefined}>
        <Icon name="chart" />Pipeline
      </Link>
    </nav>
  );
}

function TabLinks({ waiting }: { waiting: number }) {
  const h = useHrefs();
  return (
    <nav className="tabbar" aria-label="Views">
      <Link href={h.designer} aria-current={!h.onPipeline ? "page" : undefined}>
        <Icon name="inbox" />Designers{waiting > 0 && <span className="count">{waiting}</span>}
      </Link>
      <Link href={h.pipeline} aria-current={h.onPipeline ? "page" : undefined}>
        <Icon name="chart" />Pipeline
      </Link>
    </nav>
  );
}

/** Sidebar on wide screens; a top bar and a bottom tab bar on phones. */
export function Shell({ waiting, children }: { waiting: number; children: React.ReactNode }) {
  return (
    <div className="app">
      <aside className="side">
        <Brand />
        <Suspense fallback={<nav className="navlist" aria-label="Views"><Link className="navlink" href="/">Designer view</Link><Link className="navlink" href="/pipeline">Pipeline</Link></nav>}>
          <SideLinks waiting={waiting} />
        </Suspense>
        <div className="grow" />
        <div className="live-note">
          <span className="pulse" aria-hidden="true" />
          <span><b>Answering, day and night</b>Every call is picked up at any hour. Phone calls only for now.</span>
        </div>
      </aside>
      <div className="main-col">
        <header className="topbar"><Brand /></header>
        <main id="main" className="page">{children}</main>
        <Suspense fallback={null}><TabLinks waiting={waiting} /></Suspense>
      </div>
    </div>
  );
}
