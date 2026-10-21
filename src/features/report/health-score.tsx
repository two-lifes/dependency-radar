"use client";

import { CircleHelp } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/cn";
import {
  type HealthScore as Score,
  PARTIAL_UNCHECKED_SHARE,
  SCORE_RULES,
  type ScoreBand,
  type ScoreCategory,
} from "@/server/analysis/health-score";
import { reportCopy } from "./copy";

const copy = reportCopy.score;

// spec 7.1, style guide §3: 80–100 success, 50–79 warning, < 50 danger.
const bandColor: Record<ScoreBand, string> = {
  good: "text-success",
  fair: "text-warning",
  poor: "text-danger",
};

const RADIUS = 34;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const CATEGORIES = Object.keys(SCORE_RULES) as ScoreCategory[];

/** screens 5.4: the score circle with "Partial" and its explanation. */
export function HealthScore({ score }: { score: Score }) {
  const color = score.band ? bandColor[score.band] : "text-muted-foreground";
  const filled = ((score.score ?? 0) / 100) * CIRCUMFERENCE;

  return (
    // < 768px the label sits beside the circle to keep the summary short.
    <div className="flex shrink-0 items-center gap-3 md:flex-col md:gap-1">
      <div className={cn("relative size-20", color)}>
        <svg viewBox="0 0 80 80" className="size-20 -rotate-90" aria-hidden>
          <circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            strokeWidth="4"
            className="stroke-muted"
          />
          <circle
            cx="40"
            cy="40"
            r={RADIUS}
            fill="none"
            strokeWidth="4"
            strokeLinecap="round"
            stroke="currentColor"
            strokeDasharray={`${filled} ${CIRCUMFERENCE}`}
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xl font-semibold tracking-tight tabular-nums">
          {score.score ?? "—"}
        </span>
      </div>
      <div className="flex items-center gap-1 text-xs font-medium text-muted-foreground">
        <span>{copy.label}</span>
        {score.partial ? (
          <span className="rounded-sm bg-warning-soft px-1 text-warning">
            {copy.partial}
          </span>
        ) : null}
        <Popover>
          <PopoverTrigger
            aria-label={copy.howItsCalculated}
            className="rounded-sm text-muted-foreground hover:text-foreground"
          >
            <CircleHelp className="size-4" strokeWidth={1.75} aria-hidden />
          </PopoverTrigger>
          <PopoverContent align="start" className="w-80 text-sm">
            <ScoreExplanation score={score} />
          </PopoverContent>
        </Popover>
      </div>
    </div>
  );
}

function ScoreExplanation({ score }: { score: Score }) {
  return (
    <div className="grid gap-3">
      <h2 className="text-base font-medium">{copy.howItsCalculated}</h2>
      <p className="text-muted-foreground">
        {score.score === null ? copy.noScore : copy.intro}
      </p>
      <table className="w-full text-left">
        <thead className="sr-only">
          <tr>
            <th scope="col">{copy.label}</th>
            <th scope="col">{copy.thisReport}</th>
          </tr>
        </thead>
        <tbody>
          {CATEGORIES.map((category) => {
            const { count, penalty } = score.breakdown[category];
            return (
              <tr key={category} className="border-t border-border">
                <th scope="row" className="py-1.5 pr-2 font-normal">
                  <span className="block">{copy.categories[category]}</span>
                  <span className="block text-muted-foreground">
                    {ruleText(category)}
                  </span>
                </th>
                <td className="py-1.5 text-right font-mono whitespace-nowrap tabular-nums">
                  {count} · {penalty > 0 ? `−${penalty}` : "0"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="text-muted-foreground">
        {copy.footnote(PARTIAL_UNCHECKED_SHARE)}
      </p>
    </div>
  );
}

function ruleText(category: ScoreCategory): string {
  if (category === "vulnerabilities") {
    const { penalty, cap } = SCORE_RULES.vulnerabilities;
    return copy.vulnerabilityRule(penalty, cap);
  }
  const { penalty, cap } = SCORE_RULES[category];
  return copy.perPackage(penalty, cap);
}
