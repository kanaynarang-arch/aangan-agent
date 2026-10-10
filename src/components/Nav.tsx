"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Brand() {
  return (
    <Link href="/" className="brand">
      <svg className="mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="currentColor" opacity=".12" />
        <path d="M19 49V31a13 13 0 0 1 26 0v18" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        <path d="M13 49h38" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
      </svg>
      <span>Aangan Studio<small>Phone agent</small></span>
    </Link>
  );
}

function Links() {
  const path = usePathname();
  const src = useSearchParams().get("source");
  const q = src ? `?source=${encodeURIComponent(src)}` : "";
  const onPipeline = path.startsWith("/pipeline");
  return (
    <nav aria-label="Views">
      <Link href={`/${q}`} aria-current={!onPipeline ? "page" : undefined}>Designer view</Link>
      <Link href={`/pipeline${q}`} aria-current={onPipeline ? "page" : undefined}>Pipeline</Link>
    </nav>
  );
}

export function Nav() {
  return (
    <header className="top">
      <Brand />
      <Suspense fallback={<nav aria-label="Views"><Link href="/">Designer view</Link><Link href="/pipeline">Pipeline</Link></nav>}>
        <Links />
      </Suspense>
    </header>
  );
}
