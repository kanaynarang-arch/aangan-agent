"use client";

import Link from "next/link";
import { Icon } from "@/components/Icon";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="card empty" role="alert">
      <Icon name="alert" />
      <strong>We couldn&apos;t load this page</strong>
      <p>Something went wrong on our side, and no data was changed. This is usually a short hiccup.</p>
      <div className="btns" style={{ justifyContent: "center" }}>
        <button type="button" className="b primary" onClick={() => reset()}>Try again</button>
        <Link className="b" href="/">Back to all calls</Link>
      </div>
    </div>
  );
}
