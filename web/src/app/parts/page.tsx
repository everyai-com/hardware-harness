import type { Metadata } from "next";
import { PART_CATALOGUE, lookupPart, catalogueStats } from "@/lib/harness/score";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Parts — the curated catalogue",
  description:
    "Real parts with consequences: typical qty-1 price, legitimate distributors, drop-in alternates, and counterfeit risk. The library that grounds generated BOMs in orderable lines.",
  alternates: { canonical: "/parts" },
};

const RISK_BADGE: Record<string, string> = {
  high: "bg-fail/15 text-fail",
  medium: "bg-accent/15 text-accent",
  low: "bg-pass/15 text-pass",
};

export default async function PartsPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const stats = catalogueStats();
  const results = q.trim() ? lookupPart(q, 50) : PART_CATALOGUE;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Parts</h1>
        <p className="max-w-2xl text-muted">
          {stats.parts} real parts in {stats.categories.length} categories — typical qty-1 price,
          legitimate channels, alternates, and which lines attract counterfeits. Prices are 2026
          distributor bands, not quotes: verify live before ordering.
        </p>
      </header>

      <form method="get" action="/parts" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Search MPN, name or category</span>
          <input
            type="text"
            name="q"
            defaultValue={q}
            placeholder="ESP32 · ultrasonic · regulator"
            className="w-72 rounded-lg border border-line bg-card px-3 py-2 font-mono text-sm outline-none placeholder:text-muted focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg bg-accent px-5 py-2 font-semibold text-background transition-opacity hover:opacity-90"
        >
          Search
        </button>
        {q.trim() && (
          <a href="/parts" className="rounded-lg border border-line px-4 py-2 text-sm text-muted hover:text-foreground">
            Clear
          </a>
        )}
      </form>

      <p className="font-mono text-xs text-muted">
        {results.length} part{results.length === 1 ? "" : "s"}
        {q.trim() ? ` matching "${q.trim()}"` : ""} · high counterfeit risk: {stats.highRisk.join(", ")}
      </p>

      {results.length === 0 ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
          No matches — try an MPN fragment, a category (sensor, regulator) or a part type (mcu).
        </p>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {results.map((p) => (
            <li key={p.mpn} className="rounded-xl border border-line bg-card p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-mono text-sm font-bold">{p.mpn}</p>
                  <p className="text-sm text-muted">{p.label}</p>
                </div>
                <span
                  className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${RISK_BADGE[p.counterfeitRisk]}`}
                >
                  {p.counterfeitRisk} risk
                </span>
              </div>
              <p className="mt-3 font-mono text-sm">
                ${p.typicalPriceUsd[0].toFixed(2)}–${p.typicalPriceUsd[1].toFixed(2)}{" "}
                <span className="text-xs text-muted">qty-1 · via {p.distributors.join(" / ")}</span>
              </p>
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-[11px] text-muted">
                {Object.entries(p.specs)
                  .slice(0, 4)
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between gap-2">
                      <dt>{k}</dt>
                      <dd className="truncate text-right text-foreground">{v}</dd>
                    </div>
                  ))}
              </dl>
              <p className="mt-2 text-xs text-muted">{p.note}</p>
              {p.alternates.length > 0 && (
                <p className="mt-1 font-mono text-[11px] text-muted">
                  alternates: <span className="text-accent">{p.alternates.join(", ")}</span>
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
