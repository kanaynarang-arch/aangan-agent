"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Inner() {
  const path = usePathname();
  const src = useSearchParams().get("source");
  const q = src ? `?source=${src}` : "";
  const designer = path === "/" || path.startsWith("/calls");
  return (
    <header className="top">
      <div className="brand">Aangan Studio<small>Phone agent</small></div>
      <nav>
        <Link href={`/${q}`} className={designer ? "on" : ""}>Designer view</Link>
        <Link href={`/pipeline${q}`} className={path.startsWith("/pipeline") ? "on" : ""}>Pipeline</Link>
      </nav>
      <div className="spacer" />
    </header>
  );
}

export function Nav() {
  return (
    <Suspense fallback={<header className="top"><div className="brand">Aangan Studio</div></header>}>
      <Inner />
    </Suspense>
  );
}
