import type { Metadata } from "next";
import Link from "next/link";
import { Icon } from "@/components/Icon";

export const metadata: Metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <div className="card empty">
      <Icon name="search" />
      <strong>We can&apos;t find that call</strong>
      <p>The link may be old, or the call may have been removed.</p>
      <Link className="b primary" href="/">Back to all calls</Link>
    </div>
  );
}
