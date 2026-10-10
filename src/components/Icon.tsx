import type { SVGProps } from "react";

/** A small hand-picked icon set (24px grid, 1.8 stroke). Decorative by default: pair with a text label. */
const PATHS: Record<string, string> = {
  inbox: "M3 13l2.5-7.2A2 2 0 0 1 7.4 4.5h9.2a2 2 0 0 1 1.9 1.3L21 13M3 13v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5M3 13h5l1.2 2.4h5.6L16 13h5",
  chart: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  phone: "M5 4h3.5l1.6 4-2 1.3a11 11 0 0 0 5.6 5.6L15 12.9l4 1.6V18a2 2 0 0 1-2 2A14 14 0 0 1 3 6a2 2 0 0 1 2-2z",
  clock: "M12 7v5l3 2M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z",
  moon: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z",
  check: "M5 12.5l4.2 4.2L19 7",
  alert: "M12 8v5m0 3.5h.01M10.3 4.2L2.6 18a2 2 0 0 0 1.7 3h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zm9 3l-4.3-4.3",
  copy: "M9 9h10a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2zM5 15H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v1",
  back: "M19 12H5m6-6l-6 6 6 6",
  pin: "M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21zm0-8.5a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  ruler: "M3 17L17 3l4 4L7 21l-4-4zm5-5l2 2m1-5l2 2m-7 1l2 2",
  home: "M3 11l9-7 9 7M5 10v10h5v-6h4v6h5V10",
  calendar: "M7 3v3m10-3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1z",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0",
  users: "M16 11a3 3 0 1 0 0-6M3 20a6 6 0 0 1 12 0M21 20a6 6 0 0 0-4-5.6M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
  arrow: "M5 12h14m-6-6l6 6-6 6",
  spark: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M18 6l-2.5 2.5m-7 7L6 18",
  inboxzero: "M5 13l2-6h10l2 6v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1v-5zm0 0h4l1 2h4l1-2h4",
};

export type IconName = keyof typeof PATHS;

export function Icon({ name, ...rest }: { name: IconName } & SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/** The arched doorway: Aangan means courtyard. */
export function ArchMark({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="var(--ink)" />
      <path d="M19 49V31a13 13 0 0 1 26 0v18" fill="none" stroke="var(--bg)" strokeWidth="5" strokeLinecap="round" />
      <path d="M13 49h38" stroke="var(--accent)" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}
