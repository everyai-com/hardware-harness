import Link from "next/link";
import { listDesigns, type Sort } from "@/lib/db/queries";
import { DesignCard } from "@/components/design-card";

export const dynamic = "force-dynamic";

const SORTS: { id: Sort; label: string }[] = [
  { id: "new", label: "Newest" },
  { id: "score", label: "Highest score" },
  { id: "likes", label: "Most liked" },
];

export default async function ExplorePage({ searchParams }: { searchParams: Promise<{ sort?: string }> }) {
  const { sort } = await searchParams;
  const active = (SORTS.find((s) => s.id === sort)?.id ?? "new") as Sort;
  const designs = await listDesigns(active);

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
        <div className="flex gap-2">
          {SORTS.map((s) => (
            <Link
              key={s.id}
              href={`/explore?sort=${s.id}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                active === s.id ? "border-accent text-accent" : "border-line text-muted hover:text-foreground"
              }`}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </header>

      {designs.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-8 text-center text-muted">
          Nothing here yet —{" "}
          <Link href="/generate" className="text-accent hover:underline">
            generate the first design
          </Link>
          .
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((d) => (
            <DesignCard key={d.id} design={d} />
          ))}
        </div>
      )}
    </div>
  );
}
