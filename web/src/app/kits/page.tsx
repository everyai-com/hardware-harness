import Link from "next/link";
import { listKits } from "@/lib/db/queries";

export const dynamic = "force-dynamic";

export default async function KitsPage() {
  const kits = await listKits();

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Kits</h1>
        <p className="max-w-2xl text-muted">
          Open-source hardware you can actually get — Hugging Face for physical things. Every entry
          publishes its source; most sell the prebuilt kit. This is the Petoi model: open everything,
          sell the verified parts. LUXO kits (when they exist) will be subassemblies — the parts of
          the thing, not the thing — because kits don&apos;t dodge certification and subassemblies
          do.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {kits.map((k) => (
          <Link
            key={k.id}
            href={`/kits/${k.id}`}
            className={`rounded-xl border bg-card p-6 transition-colors hover:border-accent ${
              k.featured ? "border-accent/50" : "border-line"
            }`}
          >
            <div className="flex items-baseline justify-between gap-3">
              <h2 className="text-lg font-semibold">{k.name}</h2>
              {k.featured && (
                <span className="rounded bg-accent/15 px-2 py-0.5 font-mono text-xs text-accent">flagship</span>
              )}
            </div>
            <p className="mt-2 text-sm">{k.tagline}</p>
            <p className="mt-3 font-mono text-xs text-muted">{k.license ?? "open source"} · {k.costNote}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
