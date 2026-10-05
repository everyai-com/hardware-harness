import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getDesign, getDesigns, listRemixes, recordView, hasVoted, listOutcomes } from "@/lib/db/queries";
import { voterHashFromHeaders } from "@/lib/voter";
import { getEnv } from "@/lib/cf";
import { getQuote } from "@/lib/quotes";
import { findSimilarIds, searchTextFor } from "@/lib/similar";
import type { EvaluationReport, ProductSpec } from "@/lib/harness/score";
import { DesignCard, ScoreBadge } from "@/components/design-card";
import { LikeButton } from "@/components/like-button";
import { RefineForm } from "@/components/refine-form";
import { VerdictBar } from "@/components/verdict-bar";
import { verdictFor } from "@/lib/verdict";
import { Gates, Metrics, Scorecard, CostTable, Findings } from "@/components/report-view";
import { SpecView } from "@/components/spec-view";
import { OutcomeLog } from "@/components/outcome-log";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const design = await getDesign(slug);
  if (!design) return { title: "Not found — Blinky" };
  return {
    title: `${design.title} — ${design.scoreTotal.toFixed(2)}/5 ${design.gatesPassed ? "PASS" : "FAIL"} — Blinky`,
    description: design.gatesPassed
      ? `Passed all BlinkyBench build gates. Scored by the harness: DFM, landed cost, assembly.`
      : `Failed ${JSON.parse(design.scoreJson).metrics.blockCount} build gates. Scored by the harness: DFM, landed cost, assembly.`,
  };
}

export default async function DesignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const design = await getDesign(slug);
  if (!design) notFound();

  const [remixes, h] = await Promise.all([listRemixes(slug), headers()]);
  const vh = await voterHashFromHeaders(h);
  const [voted, outcomes] = await Promise.all([hasVoted(slug, vh), listOutcomes(slug)]);

  // Count a view once per visitor per hour, so bots and reloads don't inflate it.
  const viewKey = `v:${slug}:${vh}`;
  if (!(await getEnv().KV.get(viewKey))) {
    await getEnv().KV.put(viewKey, "1", { expirationTtl: 60 * 60 });
    await recordView(slug);
  }

  const report = JSON.parse(design.scoreJson) as EvaluationReport;
  const spec = JSON.parse(design.specJson) as ProductSpec;
  const verdict = verdictFor(report);
  const original = design.remixOf ? await getDesign(design.remixOf) : undefined;
  const similarIds = await findSimilarIds(searchTextFor(spec), slug, 4);
  const similar = await getDesigns(similarIds);

  // Best-effort live quotes for the first few catalog parts with MPNs.
  const mpns = spec.parts
    .filter((p) => p.kind === "catalog" && p.source?.mpn)
    .map((p) => p.source!.mpn!)
    .slice(0, 6);
  const quotes = mpns.length
    ? new Map(await Promise.all(mpns.map(async (mpn) => [mpn, await getQuote(mpn)] as const)))
    : undefined;

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
        <p className="max-w-3xl text-muted">
          <span className="font-semibold text-foreground">{verdict.headline}</span> {verdict.detail}
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <LikeButton designId={design.id} initialLikes={design.likes} initiallyVoted={voted} />
          <Link
            href={`/generate?remix=${design.id}`}
            className="rounded-lg border border-accent/50 px-3 py-1.5 text-sm text-accent hover:bg-accent/10"
          >
            Remix this design
          </Link>
          <a
            href={`/api/designs/${design.id}/artifact?file=spec&download=1`}
            className="font-mono text-sm text-muted hover:text-foreground"
          >
            spec.json ↓
          </a>
          <a
            href={`/api/designs/${design.id}/artifact?file=report&download=1`}
            className="font-mono text-sm text-muted hover:text-foreground"
          >
            report.json ↓
          </a>
        </div>
      </header>

      <VerdictBar
        designId={design.id}
        title={design.title}
        scoreTotal={design.scoreTotal}
        gatesPassed={design.gatesPassed}
        report={report}
      />

      <RefineForm designId={design.id} turnstileSiteKey={getEnv().TURNSTILE_SITE_KEY ?? null} />

      <Metrics report={report} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Gates report={report} />
        <Scorecard report={report} />
      </div>

      <CostTable report={report} />
      <Findings report={report} />
      <SpecView spec={spec} quotes={quotes} designId={design.id} />
      <OutcomeLog designId={design.id} outcomes={outcomes} />

      {similar.length > 0 && (
        <section className="space-y-4">
          <h2 className="text-xl font-semibold">Similar designs</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {similar.map((d) => (
              <DesignCard key={d.id} design={d} />
            ))}
          </div>
        </section>
      )}

      {(original || remixes.length > 0) && (
        <section className="rounded-xl border border-line bg-card p-5">
          <h2 className="font-semibold">Lineage</h2>
          {original && (
            <p className="mt-2 text-sm text-muted">
              Remixed from{" "}
              <Link href={`/d/${original.id}`} className="text-accent hover:underline">
                {original.title}
              </Link>{" "}
              ({original.scoreTotal.toFixed(2)}/5) ·{" "}
              <Link href={`/d/${original.id}/compare/${design.id}`} className="text-accent hover:underline">
                compare versions
              </Link>
            </p>
          )}
          {remixes.length > 0 && (
            <ul className="mt-2 space-y-1 text-sm">
              {remixes.map((r) => (
                <li key={r.id}>
                  <Link href={`/d/${r.id}`} className="text-accent hover:underline">
                    {r.title}
                  </Link>{" "}
                  <span className="font-mono text-xs text-muted">{r.scoreTotal.toFixed(2)}/5</span> ·{" "}
                  <Link href={`/d/${design.id}/compare/${r.id}`} className="text-accent hover:underline">
                    compare
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      <p className="rounded-xl border border-line bg-card p-4 text-xs text-muted">
        Scores are rubric estimates from the BlinkyBench harness (±40% on cost). Geometry here is
        declared by the design, not parsed from CAD — a spec author can claim clean walls. The only
        cure for that is a physical build: receipts over claims.
      </p>
    </div>
  );
}
