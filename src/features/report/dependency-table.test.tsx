import { render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { PackageRowJson } from "@/server/check/package-row";
import { DependencyTable } from "./dependency-table";
import { ReportProvider } from "./report-context";
import { FakeEventSource } from "./test/fake-event-source";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const result = (name: string): PackageRowJson => ({
  checkId: "c1",
  name,
  type: "prod",
  specifier: "^1.0.0",
  checked: true,
  reason: null,
  registryName: name,
  current: "1.0.0",
  latest: "2.0.0",
  lagKind: "major",
  lagMajors: 1,
  status: "active",
  deprecationMessage: null,
  lastReleaseAt: null,
  vulnerabilities: [],
  checkedAt: "2026-10-20T10:00:00.000Z",
});

const dependencies = [
  { name: "react", specifier: "^1.0.0", type: "prod" as const },
  { name: "eslint", specifier: "^1.0.0", type: "dev" as const },
];

const rowOf = (name: string) => {
  const cell = screen.getByText(name);
  const row = cell.closest("tr");
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};

describe("DependencyTable", () => {
  beforeEach(() => {
    FakeEventSource.instances = [];
    vi.stubGlobal("EventSource", FakeEventSource);
  });
  afterEach(() => vi.unstubAllGlobals());

  it("turns skeleton rows into results as they stream in", async () => {
    render(
      <ReportProvider
        checkId="c1"
        running
        totalPackages={2}
        dependencies={dependencies}
        previousRows={[]}
        currentRows={[result("react")]}
      >
        <DependencyTable />
      </ReportProvider>,
    );

    expect(screen.getByText("1 of 2 ready")).toBeInTheDocument();
    expect(rowOf("react")).not.toHaveAttribute("aria-busy");
    expect(rowOf("eslint")).toHaveAttribute("aria-busy", "true");
    expect(within(rowOf("eslint")).getByText("dev")).toBeInTheDocument();
    // Loaded with the page, so not highlighted.
    expect(rowOf("react")).not.toHaveClass("animate-row-flash");

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    FakeEventSource.instances[0]?.send("package", {
      package: { ...result("eslint"), type: "dev" },
    });

    expect(screen.getByText("2 of 2 ready")).toBeInTheDocument();
    expect(rowOf("eslint")).not.toHaveAttribute("aria-busy");
    expect(rowOf("eslint")).toHaveClass("animate-row-flash");
  });
});
