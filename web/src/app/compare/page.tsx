import type { Metadata } from "next";
import Link from "next/link";
import { getDesign, parseStoredJson } from "@/lib/db/queries";
import { diffSpecs, type ProductSpec, type EvaluationReport } from "@/lib/harness/score";
import { ScoreBadge } from "@/components/design-card";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Compare designs — what changed, structurally",
  description:
    "Side-by-side hardware design comparison: score delta, gates fixed or broken, parts added/removed/changed, and cost deltas. The what-changed behind every remix.",
  alternates: { canonical: "/compare" },
};

function Picker({ a, b }: { a: string; b: string }) {
  return (
    <form method="get" action="/compare" className="flex flex-wrap items-end gap-3">
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">Before (design id)</span>
        <input
          type="text"
          name="a"
          defaultValue={a}
          placeholder="lamp-astra"
          className="w-52 rounded-lg border border-line bg-card px-3 py-2 font-mono text-sm outline-none placeholder:text-muted focus:border-accent"
        />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        <span className="text-muted">After (design id)</span>
        <input
          type="text"
          name="b"
          defaultValue={b}
          placeholder="lamp-fable"
          className="w-52 rounded-lg border border-line bg-card px-3 py-2 font-mono text-sm outline-none placeholder:text-muted focus:border-accent"
        />
      </label>
      <button
        type="submit"
        className="rounded-lg bg-accent px-5 py-2 font-semibold text-background transition-opacity hover:opacity-90"
      >
        Compare
      </button>
    </form>
  );
}

export default async function ComparePage({
  searchParams,
}: {
  searchParams: Promise<{ a?: string; b?: string }>;
}) {
  const { a = "", b = "" } = await searchParams;
  const [rowA, rowB] = await Promise.all([
    a ? getDesign(a) : undefined,
    b ? getDesign(b) : undefined,
  ]);

  const specA = rowA ? parseStoredJson<ProductSpec>(rowA.specJson) : null;
  const specB = rowB ? parseStoredJson<ProductSpec>(rowB.specJson) : null;
  const reportA = rowA ? parseStoredJson<EvaluationReport>(rowA.scoreJson) : null;
  const reportB = rowB ? parseStoredJson<EvaluationReport>(rowB.scoreJson) : null;
  const diff = specA && specB ? diffSpecs(specA, specB) : null;

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Compare</h1>
        <p className="max-w-2xl text-muted">
          Every design is remixable — this is the what-changed. Same engine as the scorecard, run on
          both specs: score delta, gates fixed or broken, parts moved, cost moved.
        </p>
      </header>

      <Picker a={a} b={b} />

      {!a || !b ? (
        <p className="rounded-xl border border-dashed border-line p-8 text-center text-muted">
          Pick two designs to compare — or open any design and hit{" "}
          <span className="font-mono text-accent">compare ⇄</span>.
        </p>
      ) : !rowA || !rowB || !specA || !specB || !reportA || !reportB || !diff ? (
        <p className="rounded-xl border border-fail/40 bg-fail/10 p-8 text-center text-fail">
          {!rowA ? `No design "${a}".` : ""} {!rowB ? `No design "${b}".` : ""} Check the ids in{" "}
          <Link href="/explore" className="underline">
            explore
          </Link>
          .
        </p>
      ) : (
        <>
          <p className="rounded-xl border border-accent/30 bg-accent/5 px-4 py-3">{diff.summary}</p>

          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { row: rowA, report: reportA, label: "Before" },
              { row: rowB, report: reportB, label: "After" },
            ].map(({ row, report, label }) => (
              <Link
                key={label}
                href={`/d/${row.id}`}
                className="rounded-xl border border-line bg-card p-5 transition-colors hover:border-accent"
              >
                <p className="font-mono text-[11px] uppercase tracking-wide text-muted">{label}</p>
                <h2 className="mt-1 font-semibold leading-snug">{row.title}</h2>
                <div className="mt-3">
                  <ScoreBadge total={row.scoreTotal} gates={row.gatesPassed} />
                </div>
                <dl className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs text-muted">
                  <div>
                    <dt className="uppercase">Parts</dt>
                    <dd className="text-base text-foreground">{report.metrics.partCount}</dd>
                  </div>
                  <div>
                    <dt className="uppercase">Blocks</dt>
                    <dd className="text-base text-foreground">{report.metrics.blockCount}</dd>
                  </div>
                  <div>
                    <dt className="uppercase">Assembly</dt>
                    <dd className="text-base text-foreground">{report.metrics.assemblyMinutes}m</dd>
                  </div>
                </dl>
              </Link>
            ))}
          </div>

          <section className="rounded-xl border border-line bg-card p-5">
            <h2 className="font-semibold">Score &amp; gates</h2>
            <p className="mt-2 font-mono text-sm">
              {diff.before.score.toFixed(2)} → {diff.after.score.toFixed(2)} (
              <span className={diff.scoreDelta >= 0 ? "text-pass" : "text-fail"}>
                {diff.scoreDelta >= 0 ? "+" : ""}
                {diff.scoreDelta.toFixed(2)}
              </span>
              )
            </p>
            {diff.gatesFlipped.length === 0 ? (
              <p className="mt-2 text-sm text-muted">No gates flipped.</p>
            ) : (
              <ul className="mt-2 space-y-1 text-sm">
                {diff.gatesFlipped.map((g) => (
                  <li key={g.id}>
                    <span
                      className={`font-mono text-xs font-bold ${g.direction === "fixed" ? "text-pass" : "text-fail"}`}
                    >
                      {g.direction === "fixed" ? "FIXED" : "BROKE"}
                    </span>{" "}
                    <span className="font-mono text-xs text-muted">{g.id}</span> {g.label}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-line bg-card p-5">
            <h2 className="font-semibold">Parts</h2>
            {diff.partsAdded.length + diff.partsRemoved.length + diff.partsChanged.length === 0 ? (
              <p className="mt-2 text-sm text-muted">Identical BOMs.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {diff.partsAdded.map((p) => (
                  <li key={`+${p.id}`}>
                    <span className="font-mono font-bold text-pass">+</span> {p.label}{" "}
                    <span className="font-mono text-xs text-muted">({p.changes.join("; ")})</span>
                  </li>
                ))}
                {diff.partsRemoved.map((p) => (
                  <li key={`-${p.id}`}>
                    <span className="font-mono font-bold text-fail">−</span> {p.label}
                  </li>
                ))}
                {diff.partsChanged.map((p) => (
                  <li key={`~${p.id}`}>
                    <span className="font-mono font-bold text-accent">~</span> {p.label}{" "}
                    <span className="font-mono text-xs text-muted">{p.changes.join("; ")}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="rounded-xl border border-line bg-card p-5">
            <h2 className="font-semibold">Build-one cost</h2>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full min-w-[420px] font-mono text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                    <th className="py-2 pr-4">Qty</th>
                    <th className="py-2 pr-4">Before</th>
                    <th className="py-2 pr-4">After</th>
                    <th className="py-2">Delta</th>
                  </tr>
                </thead>
                <tbody>
                  {diff.costDeltas.map((c) => (
                    <tr key={c.quantity} className="border-b border-line/50">
                      <td className="py-2 pr-4">{c.quantity}</td>
                      <td className="py-2 pr-4">${c.beforeUsd.toFixed(2)}</td>
                      <td className="py-2 pr-4">${c.afterUsd.toFixed(2)}</td>
                      <td className={`py-2 ${c.deltaUsd <= 0 ? "text-pass" : "text-fail"}`}>
                        {c.deltaUsd >= 0 ? "+" : ""}${c.deltaUsd.toFixed(2)}
                        {c.deltaPct !== undefined ? ` (${c.deltaPct}%)` : ""}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
