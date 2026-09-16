import type { EvaluationReport } from "@/lib/harness/score";

/**
 * Cost chart — the number nobody publishes, drawn so it cannot be missed.
 *
 * One row per quantity: build-one cost vs sell-one cost (compliance loaded),
 * with the gross-margin badge. Below it, the lead-time strip: the critical
 * path in days against the 5/10/20/35/55-day scoring bands. Pure SVG, no
 * dependencies, server-component safe.
 */

function marginClass(pct: number | undefined): string {
  if (pct === undefined) return "text-muted";
  if (pct >= 25) return "text-pass";
  if (pct > 0) return "text-accent";
  return "text-fail";
}

export function CostChart({ report }: { report: EvaluationReport }) {
  const rows = report.cost.quantities;
  const max = Math.max(...rows.map((q) => q.unitUsd), 0.01);
  return (
    <section aria-label="Cost across quantities" className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Cost curve</h2>
        <p className="font-mono text-[11px] text-muted">±{report.cost.uncertaintyPct}% · certification is a cost of selling</p>
      </div>
      <div className="mt-4 space-y-3">
        {rows.map((q) => (
          <div key={q.quantity}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-mono text-muted">qty {q.quantity}</span>
              <span className="font-mono text-xs">
                build ${q.personalBuildUsd.toFixed(2)} · sell ${q.unitUsd.toFixed(2)} ·{" "}
                <span className={marginClass(q.grossMarginPct)}>
                  {q.grossMarginPct !== undefined ? `${q.grossMarginPct}% margin` : "no retail set"}
                </span>
              </span>
            </div>
            <div
              className="mt-1 flex h-2.5 gap-1 overflow-hidden"
              role="img"
              aria-label={`Quantity ${q.quantity}: build $${q.personalBuildUsd.toFixed(2)}, sell $${q.unitUsd.toFixed(2)}`}
            >
              <div className="rounded-full bg-accent/80" style={{ width: `${(q.personalBuildUsd / max) * 100}%` }} />
              <div
                className="rounded-full bg-fail/60"
                style={{ width: `${(Math.max(q.unitUsd - q.personalBuildUsd, 0) / max) * 100}%` }}
                title="Compliance load"
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px] text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2 w-4 rounded-full bg-accent/80" /> build one
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden="true" className="inline-block h-2 w-4 rounded-full bg-fail/60" /> compliance load
        </span>
      </div>
    </section>
  );
}

const LEAD_BANDS = [
  { max: 5, label: "5d" },
  { max: 10, label: "10d" },
  { max: 20, label: "20d" },
  { max: 35, label: "35d" },
  { max: 55, label: "55d+" },
];

export function LeadTimeStrip({ report }: { report: EvaluationReport }) {
  const days = report.metrics.criticalPathDays;
  const band = LEAD_BANDS.findIndex((b) => days <= b.max);
  const filled = band === -1 ? LEAD_BANDS.length : band + 1;
  return (
    <section aria-label="Lead time" className="rounded-xl border border-line bg-card p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Lead time</h2>
        <p className="font-mono text-sm">
          {days}d <span className="text-xs text-muted">critical path</span>
        </p>
      </div>
      <div
        className="mt-3 flex gap-1"
        role="img"
        aria-label={`Critical path ${days} days, band ${filled} of ${LEAD_BANDS.length}`}
      >
        {LEAD_BANDS.map((b, i) => (
          <div key={b.label} className="flex-1">
            <div className={`h-2 rounded-full ${i < filled ? "bg-accent" : "bg-line"}`} />
            <p className="mt-1 text-center font-mono text-[10px] text-muted">{b.label}</p>
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">
        Scored against the slowest single part — that is what a customer experiences.
      </p>
    </section>
  );
}
