import type { EvaluationReport } from "@/lib/harness/score";
import { usd2 } from "./format";

function GateRow({ id, label, passed, detail }: { id: string; label: string; passed: boolean; detail: string }) {
  return (
    <li className="flex gap-3 py-2">
      <span
        className={`mt-0.5 shrink-0 rounded px-1.5 font-mono text-[11px] font-bold ${
          passed ? "bg-pass/15 text-pass" : "bg-fail/15 text-fail"
        }`}
      >
        {passed ? "PASS" : "FAIL"}
      </span>
      <div>
        <span className="font-mono text-xs text-muted">{id}</span>{" "}
        <span className="text-sm">{label}</span>
        <p className="text-sm text-muted">{detail}</p>
      </div>
    </li>
  );
}

export function Gates({ report }: { report: EvaluationReport }) {
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="mb-2 font-semibold">Build gates</h2>
      <p className="mb-3 text-sm text-muted">
        Pass/fail. Failing any one means the design cannot ship — no matter how good the rest looks.
      </p>
      <ul className="divide-y divide-line">
        {report.gates.results.map((g) => (
          <GateRow key={g.id} {...g} />
        ))}
      </ul>
    </section>
  );
}

export function Metrics({ report }: { report: EvaluationReport }) {
  const m = report.metrics;
  const items = [
    { k: "Parts", v: String(m.partCount) },
    { k: "Assembly", v: `${m.assemblyMinutes} min` },
    { k: "Lead time", v: `${m.criticalPathDays} d` },
    { k: "Blocking", v: String(m.blockCount) },
    { k: "Warnings", v: String(m.warnCount) },
    { k: "Feature errors", v: String(m.featurePlacementErrors) },
  ];
  return (
    <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-6">
      {items.map((i) => (
        <div key={i.k} className="bg-card px-3 py-3 text-center">
          <p className="font-mono text-lg font-semibold">{i.v}</p>
          <p className="text-[11px] uppercase tracking-wide text-muted">{i.k}</p>
        </div>
      ))}
    </div>
  );
}

export function Scorecard({ report }: { report: EvaluationReport }) {
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="mb-1 font-semibold">
        Scorecard <span className="font-mono text-sm text-muted">weighted, 0–5 per axis</span>
      </h2>
      <div className="mt-4 space-y-3">
        {report.score.axes.map((a) => (
          <div key={a.id}>
            <div className="flex items-baseline justify-between gap-2 text-sm">
              <span className="font-medium">
                {a.label} <span className="font-mono text-xs text-muted">×{a.weight}</span>
              </span>
              <span className="font-mono">{a.score}/5</span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-line">
              <div
                className={`h-full rounded-full ${a.score >= 4 ? "bg-pass" : a.score >= 2 ? "bg-accent" : "bg-fail"}`}
                style={{ width: `${(a.score / 5) * 100}%` }}
              />
            </div>
            <p className="mt-1 text-xs text-muted">{a.basis}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CostTable({ report }: { report: EvaluationReport }) {
  const first = report.cost.quantities[0];
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="font-semibold">Landed cost</h2>
      <p className="mt-1 text-sm text-muted">
        ±{report.cost.uncertaintyPct}% estimates, including the lines that appear in no generated
        BOM. <span className="text-foreground">Build one ≠ sell one:</span> certification is a cost
        of selling.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[540px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="py-2 pr-4">Qty</th>
              <th className="py-2 pr-4">Build one</th>
              <th className="py-2 pr-4">Sell one (compliance incl.)</th>
              <th className="py-2 pr-4">Order total</th>
              <th className="py-2">Gross margin @ retail</th>
            </tr>
          </thead>
          <tbody className="font-mono">
            {report.cost.quantities.map((q) => (
              <tr key={q.quantity} className="border-b border-line/50">
                <td className="py-2 pr-4">{q.quantity}</td>
                <td className="py-2 pr-4">{usd2(q.personalBuildUsd)}</td>
                <td className="py-2 pr-4">{usd2(q.unitUsd)}</td>
                <td className="py-2 pr-4">{usd2(q.orderTotalUsd)}</td>
                <td className={`py-2 ${(q.grossMarginPct ?? 0) >= 25 ? "text-pass" : (q.grossMarginPct ?? 0) > 0 ? "text-accent" : "text-fail"}`}>
                  {q.grossMarginPct !== undefined ? `${q.grossMarginPct}%` : "n/a"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {first && (
        <details className="mt-4">
          <summary className="cursor-pointer text-sm text-muted hover:text-foreground">
            Cost breakdown at qty {first.quantity} — every invisible line
          </summary>
          <ul className="mt-3 space-y-1.5">
            {first.breakdown.map((l) => (
              <li key={l.label} className="flex flex-wrap justify-between gap-2 text-sm">
                <span>
                  {l.label}
                  {l.note && <span className="block text-xs text-muted">{l.note}</span>}
                </span>
                <span className="font-mono">{usd2(l.usd)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}

      {report.cost.hiddenLinesFlagged.length > 0 && (
        <div className="mt-4 rounded-lg border border-accent/30 bg-accent/5 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-accent">Flagged</p>
          <ul className="mt-1 list-disc space-y-1 pl-4 text-sm text-muted">
            {report.cost.hiddenLinesFlagged.map((h) => (
              <li key={h}>{h}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function FindingList({ title, items }: { title: string; items: EvaluationReport["findings"] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">
        {title} <span className="font-mono text-muted">({items.length})</span>
      </h3>
      {items.length === 0 ? (
        <p className="mt-1 text-sm text-muted">none</p>
      ) : (
        <ul className="mt-2 space-y-3">
          {items.map((f, i) => (
            <li key={i} className="rounded-lg border border-line px-3 py-2">
              <p className="text-sm">
                <span className="font-mono text-xs text-accent">[{f.ruleId}]</span>{" "}
                <span className="text-muted">({f.subject})</span> {f.message}
              </p>
              <p className="mt-1 text-xs text-muted">→ fix: {f.fix}</p>
              {f.observed?.length ? (
                <p className="mt-1 text-xs text-muted">→ seen in the wild: {f.observed[0]}</p>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Findings({ report }: { report: EvaluationReport }) {
  const blocks = report.findings.filter((f) => f.severity === "block");
  const warns = report.findings.filter((f) => f.severity === "warn");
  const infos = report.findings.filter((f) => f.severity === "info");
  return (
    <section className="rounded-xl border border-line bg-card p-5">
      <h2 className="mb-4 font-semibold">DFM findings</h2>
      <div className="space-y-5">
        <FindingList title="Blocking" items={blocks} />
        <FindingList title="Warnings" items={warns} />
        {infos.length > 0 && <FindingList title="Notes" items={infos} />}
      </div>
    </section>
  );
}
