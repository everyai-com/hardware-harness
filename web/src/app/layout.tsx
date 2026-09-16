import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { siteOrigin } from "@/lib/site";
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
  metadataBase: new URL(siteOrigin()),
  title: {
    default: "LUXO — design hardware with AI, score it before you build",
    template: "%s",
  },
  description:
    "Open-source Blueprint alternative: generate hardware designs with AI, score them with the LuxoBench harness (DFM, landed cost, build gates), remix what's possible, and browse open-source kits.",
  applicationName: "LUXO",
  openGraph: {
    type: "website",
    siteName: "LUXO",
    title: "LUXO — design hardware with AI, score it before you build",
    description:
      "Prompt → hardware design → a build gate verdict and a landed cost table nobody else publishes. Open source, MIT, self-hostable.",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "LUXO — design hardware with AI, score it before you build",
    description: "Open hardware, honestly scored. DFM rules, build gates and real landed cost.",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0b",
  colorScheme: "dark",
};

const NAV = [
  { href: "/generate", label: "Generate" },
  { href: "/explore", label: "Explore" },
  { href: "/compare", label: "Compare" },
  { href: "/parts", label: "Parts" },
  { href: "/builds", label: "Receipts" },
  { href: "/kits", label: "Kits" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/reference", label: "Reference" },
  { href: "/api-docs", label: "API" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-accent focus:px-4 focus:py-2 focus:font-semibold focus:text-background"
        >
          Skip to content
        </a>
        <header className="border-b border-line">
          <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
            <Link href="/" className="font-mono text-lg font-bold tracking-tight focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
              LUXO<span className="text-accent">_</span>
            </Link>
            <nav aria-label="Main" className="flex flex-wrap gap-4 text-sm text-muted">
              {NAV.map((n) => (
                <Link
                  key={n.href}
                  href={n.href}
                  className="rounded transition-colors hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
                >
                  {n.label}
                </Link>
              ))}
            </nav>
            <div aria-hidden="true" className="ml-auto hidden text-xs text-muted sm:block font-mono">
              free rules · paid receipts · open source
            </div>
          </div>
        </header>
        <main id="content" className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">
          {children}
        </main>
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
