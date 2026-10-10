import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { Shell } from "@/components/Shell";
import { navCounts } from "@/lib/queries";

const fraunces = Fraunces({ subsets: ["latin"], variable: "--font-fraunces", display: "swap" });
const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Aangan Studio phone agent", template: "%s · Aangan Studio" },
  description: "Aangan Studio phone agent: call list, verify queue and pipeline numbers.",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const { waiting } = await navCounts();
  return (
    <html lang="en" className={`${fraunces.variable} ${inter.variable}`}>
      <body>
        <a href="#main" className="skip">Skip to content</a>
        <Shell waiting={waiting}>{children}</Shell>
      </body>
    </html>
  );
}
