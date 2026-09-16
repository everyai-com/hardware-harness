import { parseStoredJson } from "@/lib/db/queries";
import type { OutcomeRow } from "@/lib/db/queries";
import { receiptFrom, isVerifiedBuild, receiptSummary, missingForVerification } from "@/lib/receipts";
import { calibrateFromOutcomes } from "@/lib/harness/score";
import type { EstimateVsActual } from "@/lib/harness/score";
import { BuildReceiptForm } from "@/components/build-receipt";

const KIND_BADGE: Record<string, string> = {
  build: "bg-pass/15 text-pass",
  quote: "bg-accent/15 text-accent",
  test: "bg-fail/10 text-fail",
  note: "bg-line text-muted",
};

/**
 * The score -> build -> ACTUALS log. Estimates are claims; these are receipts.
 *
 * A build outcome carrying measured numbers is rendered differently from one that
 * is only an opinion, because those are different kinds of evidence and conflating
 * them is how a gallery turns into marketing.
 */
export function OutcomeLog({
  outcomes,
  designId,
  estimatedCostUsd,
  estimatedMinutes,
}: {
  outcomes: OutcomeRow[];
  designId: string;
  /** Harness qty-1 build estimate — the prediction the receipts check. */
  estimatedCostUsd: number;
  /** Harness assembly estimate, minutes. */
  estimatedMinutes: number;
}) {
  const builds = outcomes.filter((o) => o.kind === "build");
  const verified = builds.map((o) => receiptFrom(parseStoredJson(o.dataJson))).filter(isVerifiedBuild).length;

  // Estimate-vs-actual calibration from the measured builds on this design.
  const pairs: EstimateVsActual[] = builds.flatMap((o) => {
    const r = receiptFrom(parseStoredJson(o.dataJson));
    if (r.costPaidUsd === undefined && r.assemblyMinutes === undefined) return [];
    return [
      {
        estimatedCostUsd,
        estimatedMinutes,
        costRatio: r.costPaidUsd !== undefined && estimatedCostUsd > 0 ? r.costPaidUsd / estimatedCostUsd : undefined,
        timeRatio:
          r.assemblyMinutes !== undefined && estimatedMinutes > 0 ? r.assemblyMinutes / estimatedMinutes : undefined,
        withinCostTolerance: true,
        withinTimeTolerance: true,
      },
    ];
  });
  const calibration = pairs.length > 0 ? calibrateFromOutcomes(pairs) : null;

  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Outcome log</h2>
        {verified > 0 && (
          <span className="rounded-md bg-pass/15 px-2 py-0.5 font-mono text-xs font-semibold text-pass">
            {verified} verified build{verified === 1 ? "" : "s"}
          </span>
        )}
      </div>
      <p className="mt-1 text-sm text-muted">
        Reality recorded against this design — builds, live quotes, test results. Every measurement
        makes the harness estimates sharper for everyone.
      </p>
      {calibration && (
        <p className="mt-3 rounded-lg border border-accent/30 bg-accent/5 px-4 py-2 text-sm">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-accent">
            Calibration · {calibration.confidence} confidence
          </span>
          <span className="block text-muted">{calibration.note}</span>
        </p>
      )}

      <BuildReceiptForm designId={designId} />

      {outcomes.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-line px-4 py-3 text-sm text-muted">
          No outcomes recorded yet. The first person to build this design and post the actuals owns
          the data point.
        </p>
      ) : (
        <ul className="mt-3 space-y-2">
          {outcomes.map((o) => {
            const receipt = receiptFrom(parseStoredJson(o.dataJson));
            const verifiedBuild = o.kind === "build" && isVerifiedBuild(receipt);
            const numbers = receiptSummary(receipt);
            const missing = o.kind === "build" ? missingForVerification(receipt) : [];

            return (
              <li key={o.id} className="rounded-lg border border-line px-3 py-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold ${
                      KIND_BADGE[o.kind] ?? KIND_BADGE.note
                    }`}
                  >
                    {o.kind}
                  </span>
                  {verifiedBuild && (
                    <span className="shrink-0 rounded bg-pass/20 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-pass">
                      VERIFIED
                    </span>
                  )}
                  <p className="min-w-0 flex-1 text-sm">{o.summary}</p>
                </div>

                {numbers && <p className="mt-1 font-mono text-xs text-accent">{numbers}</p>}

                {receipt.failed && (
                  <p className="mt-1 text-xs text-fail">
                    <span className="font-semibold">Went wrong:</span> {receipt.failed}
                  </p>
                )}

                {receipt.proofUrl && (
                  <a
                    href={receipt.proofUrl}
                    target="_blank"
                    rel="nofollow noopener noreferrer"
                    className="mt-1 inline-block font-mono text-[11px] text-accent hover:underline"
                  >
                    evidence ↗
                  </a>
                )}

                {o.kind === "build" && !verifiedBuild && missing.length > 0 && (
                  <p className="mt-1 text-[11px] text-muted">
                    Not verified yet — missing {missing.join(", ")}.
                  </p>
                )}

                <p className="mt-1 font-mono text-[11px] text-muted">
                  {o.author} · {o.createdAt.slice(0, 10)}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
