import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { getDesign, listRemixes, recordView, hasVoted, listOutcomes, parseStoredJson } from "@/lib/db/queries";
import { voterHashFromHeaders } from "@/lib/voter";
import { getEnv } from "@/lib/cf";
import { getQuote } from "@/lib/quotes";
import type { EvaluationReport, ProductSpec } from "@/lib/harness/score";
import { ScoreBadge } from "@/components/design-card";
import { LikeButton } from "@/components/like-button";
import { Gates, Metrics, Scorecard, CostTable, Findings } from "@/components/report-view";
import { SpecView } from "@/components/spec-view";
import { OutcomeLog } from "@/components/outcome-log";

export const dynamic = "force-dynamic";

/** One D1 read per request, shared by generateMetadata and the page. */
const designBySlug = cache(getDesign);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const design = await designBySlug(slug);
  if (!design) return { title: "Not found — LUXO" };

  const report = parseStoredJson<EvaluationReport>(design.scoreJson);
  const blocks = report?.metrics.blockCount;
  const title = `${design.title} — ${design.scoreTotal.toFixed(2)}/5 ${design.gatesPassed ? "PASS" : "FAIL"} — LUXO`;
  const description = design.gatesPassed
    ? "Passed every LuxoBench build gate. Scored by the harness: DFM, landed cost, assembly, firmware."
    : blocks !== undefined
      ? `Failed the build gates with ${blocks} blocking finding${blocks === 1 ? "" : "s"}. Scored by the harness: DFM, landed cost, assembly, firmware.`
      : "Scored by the LuxoBench harness: DFM, landed cost, assembly, firmware.";

  return {
    title,
    description,
    alternates: { canonical: `/d/${slug}` },
    openGraph: {
      type: "article",
      title,
      description,
      url: `/d/${slug}`,
    },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function DesignPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const design = await designBySlug(slug);
  if (!design) notFound();

  const report = parseStoredJson<EvaluationReport>(design.scoreJson);
  const spec = parseStoredJson<ProductSpec>(design.specJson);
  // A corrupt row is a server-side problem, and the error boundary says so. Rendering
  // an empty scorecard would quietly claim the design scored nothing.
  if (!report || !spec) {
    throw new Error(`design "${slug}" has an unreadable stored spec or report`);
  }

  const [remixes, h] = await Promise.all([listRemixes(slug), headers()]);
  const vh = await voterHashFromHeaders(h);
  const [voted, outcomes] = await Promise.all([hasVoted(slug, vh), listOutcomes(slug)]);

  // Count a view once per visitor per hour, so bots and reloads don't inflate it.
  let views = design.views;
  const viewKey = `v:${slug}:${vh}`;
  if (!(await getEnv().KV.get(viewKey))) {
    await getEnv().KV.put(viewKey, "1", { expirationTtl: 60 * 60 });
    await recordView(slug);
    views += 1;
  }

  const original = design.remixOf ? await designBySlug(design.remixOf) : undefined;

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
            {views} views
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
      <SpecView spec={spec} quotes={quotes} />
      <OutcomeLog outcomes={outcomes} designId={design.id} />

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
