import Link from "next/link";
import { getDesigns, listDesigns, type Sort } from "@/lib/db/queries";
import { searchAvailable, searchIds } from "@/lib/similar";
import { DesignCard } from "@/components/design-card";

export const dynamic = "force-dynamic";

const SORTS: { id: Sort; label: string }[] = [
  { id: "new", label: "Newest" },
  { id: "score", label: "Highest score" },
  { id: "likes", label: "Most liked" },
];

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; muse?: string; q?: string }>;
}) {
  const { sort, muse, q } = await searchParams;
  const active = (SORTS.find((s) => s.id === sort)?.id ?? "new") as Sort;
  const museOnly = muse === "1";
  const query = (q ?? "").trim();
  const searching = query.length >= 2;
  const designs = searching
    ? await getDesigns(await searchIds(query, 20))
    : await listDesigns(active, 60, { museOnly });
  const showSearch = searchAvailable();

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
        <div className="flex flex-wrap items-center gap-2">
          {showSearch && (
            <form method="GET" action="/explore" className="flex gap-2" role="search">
              <input type="hidden" name="sort" value={active} />
              {museOnly && <input type="hidden" name="muse" value="1" />}
              <input
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Search designs…"
                aria-label="Search designs"
                className="w-44 rounded-lg border border-line bg-card px-3 py-1.5 text-sm outline-none placeholder:text-muted focus:border-accent"
              />
            </form>
          )}
          <div className="flex gap-2">
            {SORTS.map((s) => (
              <Link
                key={s.id}
                href={`/explore?sort=${s.id}${museOnly ? "&muse=1" : ""}`}
                className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                  active === s.id ? "border-accent text-accent" : "border-line text-muted hover:text-foreground"
                }`}
              >
                {s.label}
              </Link>
            ))}
          </div>
          <div className="flex gap-2">
            <Link
              href={`/explore?sort=${active}`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                !museOnly ? "border-accent text-accent" : "border-line text-muted hover:text-foreground"
              }`}
            >
              All
            </Link>
            <Link
              href={`/explore?sort=${active}&muse=1`}
              className={`rounded-lg border px-3 py-1.5 text-sm transition-colors ${
                museOnly ? "border-accent text-accent" : "border-line text-muted hover:text-foreground"
              }`}
            >
              Muse gadgets
            </Link>
          </div>
        </div>
      </header>

      {searching && (
        <p className="text-sm text-muted">
          {designs.length} result{designs.length === 1 ? "" : "s"} for “{query}” —{" "}
          <Link href={`/explore?sort=${active}${museOnly ? "&muse=1" : ""}`} className="text-accent hover:underline">
            clear search
          </Link>
        </p>
      )}

      {designs.length === 0 ? (
        <p className="rounded-xl border border-line bg-card p-8 text-center text-muted">
          {searching ? (
            <>
              Nothing matches “{query}” —{" "}
              <Link href={`/explore?sort=${active}${museOnly ? "&muse=1" : ""}`} className="text-accent hover:underline">
                browse everything
              </Link>{" "}
              or{" "}
              <Link href="/generate" className="text-accent hover:underline">
                generate it
              </Link>
              .
            </>
          ) : museOnly ? (
            <>
              No Muse gadget designs yet —{" "}
              <Link href="/generate" className="text-accent hover:underline">
                start from a template
              </Link>{" "}
              and target a supported board.
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
          {designs.map((d) => (
            <DesignCard key={d.id} design={d} />
          ))}
        </div>
      )}
    </div>
  );
}
