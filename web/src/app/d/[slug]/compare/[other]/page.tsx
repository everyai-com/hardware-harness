import Link from "next/link";
import { notFound } from "next/navigation";
import { getDesign } from "@/lib/db/queries";
import type { EvaluationReport, Finding } from "@/lib/harness/score";
import { compareReports } from "@/lib/compare";
import { ScoreBadge } from "@/components/design-card";
import { usd2 } from "@/components/format";

export const dynamic = "force-dynamic";

function delta(n: number, unit = ""): string {
  const sign = n > 0 ? "+" : "";
  return `${sign}${n}${unit}`;
}

function deltaClass(n: number, invert = false): string {
  if (n === 0) return "text-muted";
  const good = invert ? n < 0 : n > 0;
  return good ? "text-pass" : "text-fail";
}

function FindingDeltaList({ title, items, empty }: { title: string; items: Finding[]; empty: string }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">
        {title} <span className="font-mono text-muted">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-2 space-y-2">
          {items.map((f, i) => (
            <li key={i} className="rounded-lg border border-line px-3 py-2 text-sm">
              <span className="font-mono text-xs text-accent">[{f.ruleId}]</span>{" "}
              <span className="text-muted">({f.subject})</span> {f.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default async function ComparePage({
  params,
}: {
  params: Promise<{ slug: string; other: string }>;
}) {
  const { slug, other } = await params;
  if (slug === other) notFound();
  const [a, b] = await Promise.all([getDesign(slug), getDesign(other)]);
  if (!a || !b) notFound();

  const reportA = JSON.parse(a.scoreJson) as EvaluationReport;
  const reportB = JSON.parse(b.scoreJson) as EvaluationReport;
  const d = compareReports(reportA, reportB);
  const better = d.scoreDelta > 0 ? b : d.scoreDelta < 0 ? a : null;

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <p className="font-mono text-xs uppercase tracking-widest text-muted">version compare</p>
        <div className="flex flex-wrap items-center gap-3">
          <Link href={`/d/${a.id}`} className="text-xl font-bold hover:text-accent">
            {a.title}
          </Link>
          <span className="text-muted">→</span>
          <Link href={`/d/${b.id}`} className="text-xl font-bold hover:text-accent">
            {b.title}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <ScoreBadge total={a.scoreTotal} gates={a.gatesPassed} />
          <ScoreBadge total={b.scoreTotal} gates={b.gatesPassed} />
        </div>
        <p className="max-w-3xl text-muted">
          {better
            ? `${better.title} scores ${Math.abs(d.scoreDelta).toFixed(2)} higher — ${d.newlyPassing.length} gate${d.newlyPassing.length === 1 ? "" : "s"} fixed, ${d.newlyFailing.length} broken, ${d.removed.length} finding${d.removed.length === 1 ? "" : "s"} gone, ${d.added.length} new.`
            : `Same score (${a.scoreTotal.toFixed(2)}) — the revision moved things around without moving the number. ${d.removed.length} findings gone, ${d.added.length} new.`}
        </p>
      </header>

      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-5">
        {[
          { k: "Score Δ", v: delta(d.scoreDelta), c: deltaClass(d.scoreDelta) },
          { k: "Gates", v: `${d.gatesA}→${d.gatesB}/${d.gatesTotal}`, c: deltaClass(d.gatesB - d.gatesA) },
          { k: "Parts Δ", v: delta(d.partsDelta), c: deltaClass(d.partsDelta) },
          { k: "Assembly Δ", v: delta(d.assemblyDelta, " min"), c: deltaClass(d.assemblyDelta, true) },
          { k: "Blocks Δ", v: delta(d.blockDelta), c: deltaClass(d.blockDelta, true) },
        ].map((i) => (
          <div key={i.k} className="bg-card px-3 py-3 text-center">
            <p className={`font-mono text-lg font-semibold ${i.c}`}>{i.v}</p>
            <p className="text-[11px] uppercase tracking-wide text-muted">{i.k}</p>
          </div>
        ))}
      </div>

      {d.costs.length > 0 && (
        <section className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold">Unit cost, old vs new</h2>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[480px] text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
                  <th className="py-2 pr-4">Qty</th>
                  <th className="py-2 pr-4">Before</th>
                  <th className="py-2 pr-4">After</th>
                  <th className="py-2">Margin before → after</th>
                </tr>
              </thead>
              <tbody className="font-mono">
                {d.costs.map((c) => (
                  <tr key={c.quantity} className="border-b border-line/50 last:border-0">
                    <td className="py-2 pr-4">{c.quantity}</td>
                    <td className="py-2 pr-4">{c.aUnit !== null ? usd2(c.aUnit) : "—"}</td>
                    <td className="py-2 pr-4">{c.bUnit !== null ? usd2(c.bUnit) : "—"}</td>
                    <td className="py-2 text-muted">
                      {c.aMargin !== null ? `${c.aMargin}%` : "—"} → {c.bMargin !== null ? `${c.bMargin}%` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-card p-5">
        <h2 className="mb-4 font-semibold">What changed in the findings</h2>
        <div className="space-y-5">
          <FindingDeltaList title="Fixed in the new version" items={d.removed} empty="Nothing was fixed." />
          <FindingDeltaList title="New in this version" items={d.added} empty="Nothing new broke." />
        </div>
      </section>

      <p className="text-sm text-muted">
        <Link href={`/d/${b.id}`} className="text-accent hover:underline">
          Open {b.title}
        </Link>{" "}
        to refine it further, or{" "}
        <Link href={`/d/${b.id}/compare/${a.id}`} className="text-accent hover:underline">
          flip the direction
        </Link>
        .
      </p>
    </div>
  );
}
