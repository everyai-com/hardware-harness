import type { EvaluationReport } from "./harness/score";
import { usd2 } from "@/components/format";

export type Verdict = { passed: boolean; headline: string; detail: string };

/**
 * The one-paragraph answer, derived deterministically from the stored report:
 * buildable or not, how many blockers, the worst one first, what one costs.
 * No AI — the verdict must never disagree with the gates.
 */
export function verdictFor(report: EvaluationReport): Verdict {
  const blocks = report.findings.filter((f) => f.severity === "block");
  const one = report.cost.quantities[0];
  const buildOne = one ? `About ${usd2(one.personalBuildUsd)} to build one.` : "";
  if (report.gates.passed) {
    return {
      passed: true,
      headline: `Buildable as specified — all ${report.gates.results.length} gates pass.`,
      detail: `${buildOne} Score ${report.score.total.toFixed(2)}/5.`,
    };
  }
  const worst = blocks[0] ? ` Worst first: ${blocks[0].message}` : "";
  return {
    passed: false,
    headline: `Not buildable yet — ${blocks.length} blocking issue${blocks.length === 1 ? "" : "s"}.`,
    detail: `${buildOne}${worst}`,
  };
}
