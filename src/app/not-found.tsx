import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="empty">
      <strong>We can&apos;t find that call</strong>
      <p>The link may be old, or the call may have been removed.</p>
      <Link className="b primary" href="/">Back to all calls</Link>
    </div>
  );
}
