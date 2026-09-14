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
  searchParams: Promise<{ sort?: string; page?: string }>;
}) {
  const { sort, page } = await searchParams;
  const active = parseSort(sort ?? null);
  const current = Math.max(Number(page ?? "1") || 1, 1);
  const result = await pageDesigns(active, current, PAGE_SIZE);
  const receipts = await buildCountsFor(result.designs.map((d) => d.id));

  const pageHref = (p: number) => `/explore?sort=${active}&page=${p}`;

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
              href={`/explore?sort=${s.id}`}
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

      <p className="font-mono text-xs text-muted">
        {result.total} design{result.total === 1 ? "" : "s"} · page {result.page} of{" "}
        {Math.max(Math.ceil(result.total / result.pageSize), 1)}
      </p>

      {result.designs.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-8 text-center text-muted">
          Nothing here yet —{" "}
          <Link href="/generate" className="text-accent hover:underline">
            generate the first design
          </Link>
          .
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
