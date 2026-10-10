"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Brand() {
  return (
    <Link href="/" className="brand">
      <svg className="mark" viewBox="0 0 64 64" aria-hidden="true">
        <rect width="64" height="64" rx="14" fill="currentColor" opacity=".12" />
        <path d="M32 12 14 52h9l3.6-9h10.8l3.6 9h9L32 12Zm0 15.5L36.6 37h-9.2L32 27.5Z" fill="currentColor" />
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
