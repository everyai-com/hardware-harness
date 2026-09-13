import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "LUXO — design hardware with AI, score it before you build",
  description:
    "Open-source Blueprint alternative: generate hardware designs with AI, score them with the LuxoBench harness (DFM, landed cost, build gates), remix what's possible, and browse open-source kits.",
};

const NAV = [
  { href: "/generate", label: "Generate" },
  { href: "/explore", label: "Explore" },
  { href: "/kits", label: "Kits" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/reference", label: "Reference" },
  { href: "/api-docs", label: "API" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-mono text-lg font-bold tracking-tight">
              LUXO<span className="text-accent">_</span>
            </Link>
            <nav className="flex flex-wrap gap-4 text-sm text-muted">
              {NAV.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-foreground transition-colors">
                  {n.label}
                </Link>
              ))}
            </nav>
            <div className="ml-auto hidden text-xs text-muted sm:block font-mono">
              free rules · paid receipts · open source
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-line">
          <div className="mx-auto flex max-w-6xl flex-wrap gap-4 px-4 py-6 text-xs text-muted">
            <span>LUXO — open hardware, honestly scored.</span>
            <span className="font-mono">every score is ±40% until someone builds it</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
