import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getDesign, listRemixes, recordView, hasVoted } from "@/lib/db/queries";
import { voterHashFromHeaders } from "@/lib/voter";
import type { EvaluationReport, ProductSpec } from "@/lib/harness/score";
import { ScoreBadge } from "@/components/design-card";
import { LikeButton } from "@/components/like-button";
import { Gates, Metrics, Scorecard, CostTable, Findings } from "@/components/report-view";
import { SpecView } from "@/components/spec-view";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const design = await getDesign(slug);
  if (!design) return { title: "Not found — LUXO" };
  return {
    title: `${design.title} — ${design.scoreTotal.toFixed(2)}/5 ${design.gatesPassed ? "PASS" : "FAIL"} — LUXO`,
    description: design.gatesPassed
      ? `Passed all LuxoBench build gates. Scored by the harness: DFM, landed cost, assembly.`
      : `Failed ${JSON.parse(design.scoreJson).metrics.blockCount} build gates. Scored by the harness: DFM, landed cost, assembly.`,
  };
}

export default async function DesignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const design = await getDesign(slug);
  if (!design) notFound();

  await recordView(slug);
  const [remixes, h] = await Promise.all([listRemixes(slug), headers()]);
  const voted = await hasVoted(slug, await voterHashFromHeaders(h));

  const report = JSON.parse(design.scoreJson) as EvaluationReport;
  const spec = JSON.parse(design.specJson) as ProductSpec;
  const original = design.remixOf ? await getDesign(design.remixOf) : undefined;

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <ScoreBadge total={design.scoreTotal} gates={design.gatesPassed} className="text-sm" />
          <span className="text-sm text-muted">
            by {design.producedBy ?? design.author} · {new Date(design.createdAt).toISOString().slice(0, 10)} ·{" "}
            {design.views + 1} views
          </span>
        </div>
        <h1 className="text-3xl font-bold">{design.title}</h1>
        {design.prompt && <p className="max-w-3xl text-muted">“{design.prompt}”</p>}
        <div className="flex flex-wrap items-center gap-3">
          <LikeButton designId={design.id} initialLikes={design.likes} initiallyVoted={voted} />
          <Link
            href={`/generate?remix=${design.id}`}
            className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
          >
            Remix this design
          </Link>
          <a
            href={`/api/designs/${design.id}`}
            className="font-mono text-sm text-muted hover:text-foreground"
          >
            spec.json ↓
          </a>
        </div>
      </header>

      <Metrics report={report} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Gates report={report} />
        <Scorecard report={report} />
      </div>

      <CostTable report={report} />
      <Findings report={report} />
      <SpecView spec={spec} />

      {(original || remixes.length > 0) && (
        <section className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold">Lineage</h2>
          {original && (
            <p className="mt-2 text-sm text-muted">
              Remixed from{" "}
              <Link href={`/d/${original.id}`} className="text-accent hover:underline">
                {original.title}
              </Link>{" "}
              ({original.scoreTotal.toFixed(2)}/5)
            </p>
          )}
          {remixes.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {remixes.map((r) => (
                <li key={r.id}>
                  <Link href={`/d/${r.id}`} className="text-accent hover:underline">
                    {r.title}
                  </Link>{" "}
                  <span className="font-mono text-xs text-muted">{r.scoreTotal.toFixed(2)}/5</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="rounded-xl border border-line bg-card p-4 text-xs text-muted">
        Scores are rubric estimates from the LuxoBench harness (±40% on cost). Geometry here is
        declared by the design, not parsed from CAD — a spec author can claim clean walls. The only
        cure for that is a physical build: receipts over claims.
      </p>
    </div>
  );
}
