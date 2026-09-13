import {
  RULES,
  PROCESSES,
  MATERIALS,
  CERTIFICATIONS,
  TARIFF_2026,
  LABOR_AND_QC,
  HIDDEN_COSTS,
  FAILURE_TAXONOMY,
  SOURCING_RULES,
} from "@/lib/harness/score";
import type { RuleDef, Process, Material, CertRequirement, FailureMode } from "@/lib/harness/score";

export const metadata = { title: "Reference — LUXO" };

const SEV_STYLE: Record<string, string> = {
  block: "bg-fail/15 text-fail",
  warn: "bg-accent/15 text-accent",
  info: "bg-line text-muted",
};

function Rules() {
  const rules = Object.values(RULES) as RuleDef[];
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">DFM rules ({rules.length})</h2>
      <p className="text-sm text-muted">
        Every rule the harness checks, with the evidence that produced it. Free to copy — published
        rules are how a format becomes the standard.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {rules.map((r) => (
          <div key={r.id} className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-snug">{r.title}</h3>
              <span className={`shrink-0 rounded px-1.5 py-0.5 font-mono text-[11px] ${SEV_STYLE[r.severity]}`}>
                {r.severity}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted">{r.rationale}</p>
            <p className="mt-1.5 text-xs text-muted">evidence: {r.evidence}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Processes() {
  const list = Object.values(PROCESSES) as Process[];
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Process capabilities</h2>
      <div className="overflow-x-auto rounded-xl border border-line bg-card">
        <table className="w-full min-w-[860px] text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
              <th className="px-4 py-3">Process</th>
              <th className="px-4 py-3">Min wall</th>
              <th className="px-4 py-3">Tolerance</th>
              <th className="px-4 py-3">Tooling</th>
              <th className="px-4 py-3">Lead time</th>
              <th className="px-4 py-3">$/cm³</th>
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id} className="border-b border-line/50 last:border-0 align-top">
                <td className="px-4 py-3">
                  {p.label}
                  {p.notes.length > 0 && <span className="block text-xs text-muted">{p.notes[0]}</span>}
                </td>
                <td className="px-4 py-3 font-mono">{p.minWallMm} mm</td>
                <td className="px-4 py-3 font-mono">±{p.toleranceMm} mm</td>
                <td className="px-4 py-3 font-mono">
                  ${p.toolingUsd[0]}–{p.toolingUsd[1]}
                </td>
                <td className="px-4 py-3 font-mono">
                  {p.leadTimeDays[0]}–{p.leadTimeDays[1]} d
                </td>
                <td className="px-4 py-3 font-mono">${p.costPerCm3.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Materials() {
  const list = Object.values(MATERIALS) as Material[];
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Materials</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((m) => (
          <div key={m.id} className="rounded-xl border border-line bg-card p-4">
            <h3 className="text-sm font-semibold">{m.label}</h3>
            <p className="mt-1 font-mono text-xs text-muted">
              wall ≥ {m.minWallMm} mm · ${m.costPerKgUsd[0]}–{m.costPerKgUsd[1]}/kg · shrink{" "}
              {(m.shrink * 100).toFixed(1)}%
            </p>
            {m.notes.length > 0 && <p className="mt-1.5 text-sm text-muted">{m.notes[0]}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

function Certifications() {
  const list = CERTIFICATIONS as CertRequirement[];
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Certifications</h2>
      <p className="text-sm text-muted">
        The fixed costs that decide whether a product can legally be sold. Certification is a cost
        of selling, not of building — the first thing a generated BOM leaves out.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((c) => (
          <div key={c.id} className="rounded-xl border border-line bg-card p-4">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold leading-snug">{c.label}</h3>
              <span className="shrink-0 font-mono text-xs text-accent">
                {c.costUsd ? `$${c.costUsd[0]}–${c.costUsd[1]}` : "no public price"}
              </span>
            </div>
            <p className="mt-1.5 text-sm text-muted">{c.trigger}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Economics() {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">2026 economics</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-line bg-card p-4">
          <h3 className="text-sm font-semibold">Duty &amp; tariffs</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>De minimis ended for China/HK: {TARIFF_2026.deMinimisEndedChinaHk}</li>
            <li>
              Effective all-in duty: {TARIFF_2026.effectiveDutyPctConsumer[0]}–
              {TARIFF_2026.effectiveDutyPctConsumer[1]}%
            </li>
            <li>Postal parcel cost increase: {TARIFF_2026.postalParcelCostIncreasePct[0]}–{TARIFF_2026.postalParcelCostIncreasePct[1]}%</li>
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <h3 className="text-sm font-semibold">Labour &amp; QC</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>Inspection: ${LABOR_AND_QC.inspectionPerManDayUsd[0]}–{LABOR_AND_QC.inspectionPerManDayUsd[1]}/man-day</li>
            <li>AQL {LABOR_AND_QC.aqlPct}</li>
            <li>Agent commission: {LABOR_AND_QC.sourcingAgentCommissionPct[0]}–{LABOR_AND_QC.sourcingAgentCommissionPct[1]}%</li>
            <li>Terms: {LABOR_AND_QC.factoryPaymentTerms}</li>
          </ul>
        </div>
        <div className="rounded-xl border border-line bg-card p-4">
          <h3 className="text-sm font-semibold">Hidden costs</h3>
          <ul className="mt-2 space-y-1 text-sm text-muted">
            <li>Signed drivers: ${HIDDEN_COSTS.signedDriverUsd[0]}–{HIDDEN_COSTS.signedDriverUsd[1]} one-off</li>
            <li>Payment processing: {HIDDEN_COSTS.paymentProcessingPct}%</li>
            <li>Defect reserve: {HIDDEN_COSTS.defectReservePct}%</li>
            <li>Air freight: ${HIDDEN_COSTS.airFreightPerKgUsd[0]}–{HIDDEN_COSTS.airFreightPerKgUsd[1]}/kg</li>
          </ul>
        </div>
      </div>
      <div className="rounded-xl border border-line bg-card p-4 text-sm text-muted">
        <h3 className="text-sm font-semibold text-foreground">Sourcing integrity</h3>
        <p className="mt-1">
          High-risk part classes: {SOURCING_RULES.highRiskPartTypes.join(", ")}. Buy programmable
          and analog parts from LCSC or authorised distribution — marketplace-channel parts are how
          counterfeit silicon gets into a build.
        </p>
      </div>
    </section>
  );
}

function Taxonomy() {
  const list = FAILURE_TAXONOMY as FailureMode[];
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-semibold">Failure taxonomy ({list.length})</h2>
      <p className="text-sm text-muted">
        Every entry is a failure that already happened in public, with the evidence attached.
        Models change every few weeks; these observations don&apos;t.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {list.map((f) => (
          <div key={f.id} className="rounded-xl border border-line bg-card p-4">
            <h3 className="text-sm font-semibold">{f.label}</h3>
            <p className="mt-1.5 text-sm text-muted">{f.symptom}</p>
            <p className="mt-1.5 text-xs text-muted">evidence: {f.evidence}</p>
            {f.ruleId && <p className="mt-1 font-mono text-[11px] text-accent">caught by {f.ruleId}</p>}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function ReferencePage() {
  return (
    <div className="space-y-12">
      <header className="space-y-2">
        <h1 className="text-3xl font-bold">Reference</h1>
        <p className="max-w-2xl text-muted">
          The knowledge layer the harness runs on — process data, materials, certifications, tariff
          economics, DFM rules and the failure taxonomy. Free, sourced, and versioned in the open.
          If a lab absorbs these rules, they spread; that is the point.
        </p>
      </header>
      <Rules />
      <Processes />
      <Materials />
      <Certifications />
      <Economics />
      <Taxonomy />
    </div>
  );
}
