import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { healthScore } from "@/server/analysis/health-score";
import type { ReportCounts } from "@/server/analysis/report-counts";
import { ReportSummary } from "./report-summary";

const counts: ReportCounts = {
  upToDate: 4,
  patch: 1,
  minor: 2,
  major: 7,
  vulnerable: 3,
  vulnerableBySeverity: { critical: 1, high: 1, moderate: 1, low: 0 },
  dependencies: 17,
  vulnerabilities: 3,
};

describe("ReportSummary", () => {
  it("has a full and a short (mobile) label for the long tiles", () => {
    render(<ReportSummary score={healthScore([])} counts={counts} />);
    const major = screen.getByText("Major behind").closest("li");
    expect(major).not.toBeNull();
    expect(within(major as HTMLElement).getByText("Major")).toBeInTheDocument();
    expect(within(major as HTMLElement).getByText("7")).toBeInTheDocument();
  });

  it("shows the critical/high split in the tile and under the mobile row", () => {
    render(<ReportSummary score={healthScore([])} counts={counts} />);
    // One copy per layout; CSS shows only one of them at a time.
    expect(screen.getAllByText("1 critical · 1 high")).toHaveLength(2);
  });

  it("leaves the split out when nothing is critical or high", () => {
    render(
      <ReportSummary
        score={healthScore([])}
        counts={{
          ...counts,
          vulnerableBySeverity: { critical: 0, high: 0, moderate: 3, low: 0 },
        }}
      />,
    );
    expect(screen.queryByText(/critical|high/)).toBeNull();
  });
});
