import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PackageRowJson } from "@/server/check/package-row";
import { DependencyTable } from "./dependency-table";
import { ReportProvider } from "./report-context";
import { FakeEventSource } from "./test/fake-event-source";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const result = (
  name: string,
  overrides: Partial<PackageRowJson> = {},
): PackageRowJson => ({
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
  ...overrides,
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

describe("DependencyTable columns and sorting", () => {
  const rows: PackageRowJson[] = [
    result("zod", { lagKind: "patch", latest: "1.0.1", lagMajors: null }),
    result("next", {
      lagKind: "major",
      lagMajors: 2,
      latest: "3.0.0",
      lastReleaseAt: "2026-10-18T10:00:00.000Z",
    }),
    result("axios", {
      lagKind: "minor",
      latest: "1.2.0",
      lagMajors: null,
      vulnerabilities: [
        {
          ids: ["GHSA-1"],
          primaryId: "GHSA-1",
          severity: "critical",
          fixedIn: null,
        },
        {
          ids: ["GHSA-2"],
          primaryId: "GHSA-2",
          severity: "low",
          fixedIn: null,
        },
      ],
    }),
    result("local-lib", {
      checked: false,
      reason: "not-from-registry",
      registryName: null,
      current: null,
      latest: null,
      lagKind: null,
      lagMajors: null,
      status: null,
    }),
    result("request", {
      lagKind: "current",
      latest: "1.0.0",
      lagMajors: null,
      status: "deprecated",
      deprecationMessage: "request has been deprecated",
    }),
  ];

  const renderTable = () =>
    render(
      <TooltipProvider delayDuration={0}>
        <ReportProvider
          checkId="c1"
          running={false}
          totalPackages={rows.length + 1}
          dependencies={[
            ...rows.map((row) => ({
              name: row.name,
              specifier: "^1.0.0",
              type: "prod" as const,
            })),
            { name: "pending-pkg", specifier: "^1.0.0", type: "prod" as const },
          ]}
          previousRows={[]}
          currentRows={rows}
        >
          <DependencyTable />
        </ReportProvider>
      </TooltipProvider>,
    );

  const order = () =>
    screen
      .getAllByRole("row")
      .slice(1)
      // The name only: the cell also holds sr-only "deprecated" / "Checking…".
      .map((row) => row.querySelector("td .font-mono")?.textContent ?? "");
  const header = (name: string) =>
    screen.getByRole("columnheader", { name: new RegExp(`^${name}`) });

  it("renders the screens 5.5 columns", () => {
    renderTable();
    expect(
      screen.getAllByRole("columnheader").map((th) => th.textContent),
    ).toEqual([
      "Package",
      "Current",
      "Latest",
      "Behind",
      "Vulnerabilities",
      "Released",
      "Status",
    ]);

    const next = within(rowOf("next"));
    expect(next.getByText("3.0.0")).toHaveClass("font-mono");
    expect(next.getByText("2 majors")).toBeInTheDocument();
    expect(rowOf("next").querySelector("time")).toHaveAttribute(
      "dateTime",
      "2026-10-18T10:00:00.000Z",
    );

    const axios = within(rowOf("axios"));
    expect(axios.getByText("2")).toHaveClass("text-critical");
    expect(axios.getByText(", highest critical")).toHaveClass("sr-only");

    const local = within(rowOf("local-lib"));
    expect(local.getAllByText("None")).toHaveLength(5);
    expect(local.getByText("not checked")).toBeInTheDocument();

    expect(
      within(rowOf("request")).getByText("deprecated", {
        selector: ".sr-only",
      }),
    ).toBeInTheDocument();
  });

  it("shows why a package wasn't checked", async () => {
    renderTable();
    fireEvent.focus(
      within(rowOf("local-lib")).getByRole("button", { name: "not checked" }),
    );
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "Not from npm registry",
    );
  });

  it("puts vulnerable first, then the furthest behind by default", () => {
    renderTable();
    expect(order()).toEqual([
      "axios",
      "next",
      "zod",
      "request",
      "local-lib",
      "pending-pkg",
    ]);
    expect(header("Behind")).toHaveAttribute("aria-sort", "none");
    expect(header("Current")).not.toHaveAttribute("aria-sort");
  });

  it("flips the direction on a repeated click, keeping rows without data last", () => {
    renderTable();
    const button = within(header("Behind")).getByRole("button");

    fireEvent.click(button);
    expect(header("Behind")).toHaveAttribute("aria-sort", "ascending");
    expect(order()).toEqual([
      "request",
      "zod",
      "axios",
      "next",
      "local-lib",
      "pending-pkg",
    ]);

    fireEvent.click(button);
    expect(header("Behind")).toHaveAttribute("aria-sort", "descending");
    expect(order().slice(0, 4)).toEqual(["next", "axios", "zod", "request"]);
    expect(order().slice(4)).toEqual(["local-lib", "pending-pkg"]);

    // No third "unsorted" state (screens 5.5).
    fireEvent.click(button);
    expect(header("Behind")).toHaveAttribute("aria-sort", "ascending");
  });

  it("sorts by name, vulnerabilities and release date", () => {
    renderTable();
    fireEvent.click(within(header("Package")).getByRole("button"));
    expect(order()).toEqual([
      "axios",
      "local-lib",
      "next",
      "pending-pkg",
      "request",
      "zod",
    ]);

    fireEvent.click(within(header("Vulnerabilities")).getByRole("button"));
    expect(header("Package")).toHaveAttribute("aria-sort", "none");
    expect(order().slice(-3)).toEqual(["axios", "local-lib", "pending-pkg"]);

    fireEvent.click(within(header("Released")).getByRole("button"));
    expect(order()[0]).toBe("next");
  });
});
