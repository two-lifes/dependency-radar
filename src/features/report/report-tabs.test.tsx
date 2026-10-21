import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ReportTabs } from "./report-tabs";

const navigation = vi.hoisted(() => ({
  pathname: "/r/abc/dependencies",
  search: "",
}));
vi.mock("next/navigation", () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

describe("ReportTabs", () => {
  beforeEach(() => {
    navigation.pathname = "/r/abc/dependencies";
    navigation.search = "";
  });

  it("marks the open tab and shows counts", () => {
    render(
      <ReportTabs basePath="/r/abc" dependencies={112} vulnerabilities={7} />,
    );

    expect(
      screen.getByRole("link", { name: "Dependencies (112)" }),
    ).toHaveAttribute("aria-current", "page");
    expect(
      screen.getByRole("link", { name: "Vulnerabilities (7)" }),
    ).not.toHaveAttribute("aria-current");
  });

  it("keeps the query when switching tabs", () => {
    navigation.search = "lag=major&q=re";
    render(
      <ReportTabs basePath="/r/abc" dependencies={1} vulnerabilities={0} />,
    );

    expect(
      screen.getByRole("link", { name: "Vulnerabilities (0)" }),
    ).toHaveAttribute("href", "/r/abc/vulnerabilities?lag=major&q=re");
  });
});
