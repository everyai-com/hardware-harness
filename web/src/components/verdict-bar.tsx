import Link from "next/link";
import type { EvaluationReport } from "@/lib/harness/score";
import { verdictFor } from "@/lib/verdict";
import { ScoreBadge } from "./design-card";
import { ScoreRing } from "./report-view";

/**
 * Sticky verdict bar: the one-paragraph answer plus jumps to the deep
 * sections. Answers "is it good?" before the 100KB of evidence below.
 */
export function VerdictBar({
  designId,
  title,
  scoreTotal,
  gatesPassed,
  report,
}: {
  designId: string;
  title: string;
  scoreTotal: number;
  gatesPassed: boolean;
  report: EvaluationReport;
}) {
  const verdict = verdictFor(report);
  return (
    <div className="sticky top-0 z-10 -mx-4 border-y border-line bg-background/90 px-4 py-2 backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-1">
        <ScoreRing total={report.score.total} />
        <div className="min-w-0 flex-1 basis-48">
          <p className="truncate text-sm font-semibold">
            <Link href={`/d/${designId}`} className="hover:text-accent">
              {title}
            </Link>{" "}
            <ScoreBadge total={scoreTotal} gates={gatesPassed} />
          </p>
          <p className="truncate text-xs text-muted">{verdict.headline}</p>
        </div>
        <nav className="flex gap-3 text-xs text-muted" aria-label="On this page">
          <a href="#refine" className="hover:text-foreground">
            Refine
          </a>
          <a href="#cost" className="hover:text-foreground">
            Cost
          </a>
          <a href="#findings" className="hover:text-foreground">
            Findings
          </a>
          <a href="#outcomes" className="hover:text-foreground">
            Outcomes
          </a>
        </nav>
      </div>
    </div>
  );
}
