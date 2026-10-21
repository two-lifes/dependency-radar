import { render, screen, within } from "@testing-library/react";
import { NuqsTestingAdapter } from "nuqs/adapters/testing";
import type { ReactElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { healthScore } from "@/server/analysis/health-score";
import type { ReportCounts } from "@/server/analysis/report-counts";
import { ReportSummary } from "./report-summary";

const navigation = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

const renderAt = (ui: ReactElement, search = "") => {
  navigation.search = search;
  return render(
    <NuqsTestingAdapter searchParams={search}>{ui}</NuqsTestingAdapter>,
  );
};

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
  beforeEach(() => {
    navigation.search = "";
  });

  it("has a full and a short (mobile) label for the long tiles", () => {
    renderAt(
      <ReportSummary
        score={healthScore([])}
        counts={counts}
        basePath="/r/abc"
      />,
    );
    const major = screen.getByText("Major behind").closest("a");
    expect(major).not.toBeNull();
    expect(within(major as HTMLElement).getByText("Major")).toBeInTheDocument();
    expect(within(major as HTMLElement).getByText("7")).toBeInTheDocument();
  });

  it("shows the critical/high split in the tile and under the mobile row", () => {
    renderAt(
      <ReportSummary
        score={healthScore([])}
        counts={counts}
        basePath="/r/abc"
      />,
    );
    // One copy per layout; CSS shows only one of them at a time.
    expect(screen.getAllByText("1 critical · 1 high")).toHaveLength(2);
  });

  it("leaves the split out when nothing is critical or high", () => {
    renderAt(
      <ReportSummary
        basePath="/r/abc"
        score={healthScore([])}
        counts={{
          ...counts,
          vulnerableBySeverity: { critical: 0, high: 0, moderate: 3, low: 0 },
        }}
      />,
    );
    expect(screen.queryByText(/critical|high/)).toBeNull();
  });

  // jsdom ignores the CSS that hides one of the two labels, so both are in
  // the name here.
  const tile = (label: string) =>
    screen.getByRole("link", { name: new RegExp(label) });

  it("links each tile to Dependencies with its filter", () => {
    renderAt(
      <ReportSummary
        score={healthScore([])}
        counts={counts}
        basePath="/r/abc"
      />,
    );
    expect(tile("Up to date")).toHaveAttribute(
      "href",
      "/r/abc/dependencies?lag=current",
    );
    expect(tile("Major behind")).toHaveAttribute(
      "href",
      "/r/abc/dependencies?lag=major",
    );
    expect(tile("Vulnerable")).toHaveAttribute(
      "href",
      "/r/abc/dependencies?vuln=yes",
    );
  });

  it("keeps the rest of the query and takes an active tile's filter off", () => {
    renderAt(
      <ReportSummary
        score={healthScore([])}
        counts={counts}
        basePath="/r/abc"
      />,
      "?q=re&lag=major",
    );
    expect(tile("Major behind")).toHaveAttribute("aria-current", "true");
    expect(tile("Major behind")).toHaveAttribute(
      "href",
      "/r/abc/dependencies?q=re",
    );
    expect(tile("Minor behind")).not.toHaveAttribute("aria-current");
    expect(tile("Minor behind")).toHaveAttribute(
      "href",
      "/r/abc/dependencies?q=re&lag=minor",
    );
  });
});
