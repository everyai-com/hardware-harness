import Link from "next/link";
import type { Metadata } from "next";
import { pageDesigns, parseSort, buildCountsFor, PAGE_SIZE } from "@/lib/db/queries";
import type { Sort } from "@/lib/db/queries";
import { DesignCard } from "@/components/design-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Explore — every design, honestly scored",
  description:
    "The public gallery: AI-generated hardware designs scored by the LuxoBench harness, including the ones that failed the build gates.",
  alternates: { canonical: "/explore" },
};

const SORTS: { id: Sort; label: string }[] = [
  { id: "new", label: "Newest" },
  { id: "score", label: "Highest score" },
  { id: "likes", label: "Most liked" },
];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; page?: string; q?: string; gates?: string }>;
}) {
  const { sort, page, q, gates } = await searchParams;
  const active = parseSort(sort ?? null);
  const current = Math.max(Number(page ?? "1") || 1, 1);
  const query = q?.slice(0, 120) ?? "";
  const gatesFilter = gates === "pass" || gates === "fail" ? gates : undefined;
  const result = await pageDesigns(active, current, PAGE_SIZE, { q: query || undefined, gates: gatesFilter });
  const receipts = await buildCountsFor(result.designs.map((d) => d.id));

  const extra = `${query ? `&q=${encodeURIComponent(query)}` : ""}${gatesFilter ? `&gates=${gatesFilter}` : ""}`;
  const pageHref = (p: number) => `/explore?sort=${active}&page=${p}${extra}`;
  const sortHref = (s: string) => `/explore?sort=${s}${extra}`;

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold">Explore</h1>
          <p className="max-w-2xl text-muted">
            Every generated design is public — the Midjourney gallery move. See what&apos;s possible,
            check its scorecard, then remix it into something better. Scores are honest: most designs
            fail the gates, and that is the point.
          </p>
        </div>
        <nav aria-label="Sort designs" className="flex gap-2">
          {SORTS.map((s) => (
            <Link
              key={s.id}
              href={sortHref(s.id)}
              aria-current={active === s.id ? "page" : undefined}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                active === s.id ? "border-accent text-accent" : "border-line text-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </nav>
      </header>

      <form method="get" action="/explore" className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="sort" value={active} />
        {gatesFilter && <input type="hidden" name="gates" value={gatesFilter} />}
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted">Search designs</span>
          <input
            type="text"
            name="q"
            defaultValue={query}
            placeholder="lamp · keypad · ESP32…"
            className="w-64 rounded-lg border border-line bg-card px-3 py-1.5 text-sm outline-none placeholder:text-muted focus:border-accent"
          />
        </label>
        <button
          type="submit"
          className="rounded-lg border border-line px-4 py-1.5 text-sm text-muted transition-colors hover:border-accent hover:text-accent"
        >
          Search
        </button>
        <nav aria-label="Filter by gates" className="flex gap-2">
          <Link
            href={sortHref(active)}
            aria-current={!gatesFilter ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm ${!gatesFilter ? "border-accent text-accent" : "border-line text-muted hover:text-foreground"}`}
          >
            All
          </Link>
          <Link
            href={`${sortHref(active)}&gates=pass`}
            aria-current={gatesFilter === "pass" ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm ${gatesFilter === "pass" ? "border-accent text-accent" : "border-line text-muted hover:text-foreground"}`}
          >
            Passed ✓
          </Link>
          <Link
            href={`${sortHref(active)}&gates=fail`}
            aria-current={gatesFilter === "fail" ? "page" : undefined}
            className={`rounded-lg border px-3 py-1.5 text-sm ${gatesFilter === "fail" ? "border-accent text-accent" : "border-line text-muted hover:text-foreground"}`}
          >
            Failed ✗
          </Link>
        </nav>
      </form>

      <p className="font-mono text-xs text-muted">
        {result.total} design{result.total === 1 ? "" : "s"}
        {query ? ` matching "${query}"` : ""}
        {gatesFilter ? ` · gates ${gatesFilter}` : ""} · page {result.page} of{" "}
        {Math.max(Math.ceil(result.total / result.pageSize), 1)}
      </p>

      {result.designs.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-8 text-center text-muted">
          {query || gatesFilter ? (
            <>
              Nothing matches —{" "}
              <Link href="/explore" className="text-accent hover:underline">
                clear the search
              </Link>{" "}
              or{" "}
              <Link href="/generate" className="text-accent hover:underline">
                generate it
              </Link>
              .
            </>
          ) : (
            <>
              Nothing here yet —{" "}
              <Link href="/generate" className="text-accent hover:underline">
                generate the first design
              </Link>
              .
            </>
          )}
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {result.designs.map((d) => (
            <DesignCard key={d.id} design={d} receipts={receipts.get(d.id) ?? 0} />
          ))}
        </div>
      )}

      {(result.page > 1 || result.hasMore) && (
        <nav aria-label="Pagination" className="flex items-center justify-between">
          {result.page > 1 ? (
            <Link
              href={pageHref(result.page - 1)}
              rel="prev"
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              ← Newer
            </Link>
          ) : (
            <span />
          )}
          {result.hasMore && (
            <Link
              href={pageHref(result.page + 1)}
              rel="next"
              className="rounded-lg border border-line px-3 py-1.5 text-sm text-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Older →
            </Link>
          )}
        </nav>
      )}
    </div>
  );
}
