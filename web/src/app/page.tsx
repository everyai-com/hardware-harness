import Link from "next/link";
import { listDesigns, listKits, countDesigns, buildCountsFor } from "@/lib/db/queries";
import { DesignCard } from "@/components/design-card";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [designs, kits, total] = await Promise.all([listDesigns("score", 3), listKits(), countDesigns()]);
  const receipts = await buildCountsFor(designs.map((d) => d.id));

  return (
    <div className="space-y-14">
      <section className="space-y-5 pt-6">
        <p className="font-mono text-xs uppercase tracking-widest text-accent">
          open source · blueprint alternative · luxobench inside
        </p>
        <h1 className="max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">
          Design hardware with AI.
          <br />
          <span className="text-muted">Score it before you build it.</span>
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          Describe a thing, get a buildable design — BOM, wiring, assembly guide, and a landed cost
          table nobody else publishes. Every design is scored by the LuxoBench harness: DFM rules,
          ten build gates, and the invisible lines (tooling, duty, certification) that generated
          BOMs always leave out.
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href="/generate"
            className="rounded-lg bg-accent px-5 py-2.5 font-semibold text-background hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Generate a design →
          </Link>
          <Link
            href="/explore"
            className="text-sm text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            or see what&apos;s possible ({total} designs) →
          </Link>
          <Link
            href="/builds"
            className="text-sm text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            receipts: what things really cost →
          </Link>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {[
          {
            t: "Generate",
            d: "Prompt → design spec → instant scorecard. Free, powered by Workers AI, open source end to end.",
            href: "/generate",
          },
          {
            t: "Remix",
            d: "Every design is public and forkable like a Midjourney gallery — see what's possible, remix it, publish yours.",
            href: "/explore",
          },
          {
            t: "Build",
            d: "Kits from open-source hardware projects — the parts of the thing, not the thing, with the buyer supplying the labour.",
            href: "/kits",
          },
        ].map((c) => (
          <Link
            key={c.t}
            href={c.href}
            className="rounded-xl border border-line bg-card p-5 transition-colors hover:border-accent"
          >
            <h2 className="font-semibold">{c.t}</h2>
            <p className="mt-2 text-sm text-muted">{c.d}</p>
          </Link>
        ))}
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Top-scored designs</h2>
          <Link href="/leaderboard" className="text-sm text-muted hover:text-foreground">
            leaderboard →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {designs.map((d) => (
            <DesignCard key={d.id} design={d} receipts={receipts.get(d.id) ?? 0} />
          ))}
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-xl font-semibold">Open-source kits</h2>
          <Link href="/kits" className="text-sm text-muted hover:text-foreground">
            all kits →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {kits.slice(0, 4).map((k) => (
            <Link
              key={k.id}
              href={`/kits/${k.id}`}
              className="rounded-xl border border-line bg-card p-5 transition-colors hover:border-accent"
            >
              <h3 className="font-semibold leading-snug">{k.name}</h3>
              <p className="mt-2 line-clamp-3 text-sm text-muted">{k.tagline}</p>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
