import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Nav } from "@/components/Nav";

export const metadata: Metadata = {
  title: { default: "Aangan Studio phone agent", template: "%s · Aangan Studio" },
  description: "Aangan Studio phone agent: call list, verify queue and pipeline numbers.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip">Skip to content</a>
        <div className="wrap">
          <Nav />
          <main id="main">{children}</main>
        </div>
      </body>
    </html>
  );
}
