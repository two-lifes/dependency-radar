import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { createLoader } from "nuqs";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PackageRowJson } from "@/server/check/package-row";
import { DependencyTable, VIRTUALIZE_FROM } from "./dependency-table";
import { filterParsers } from "./filters";
import { ReportProvider } from "./report-context";
import { buildRows } from "./report-rows";
import { orderedRows } from "./row-order";
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

const withUrl = (search = "", onUrlUpdate?: (event: UrlUpdateEvent) => void) =>
  function UrlWrapper({ children }: { children: ReactNode }) {
    return (
      <NuqsTestingAdapter
        searchParams={search}
        onUrlUpdate={onUrlUpdate}
        hasMemory
      >
        {children}
      </NuqsTestingAdapter>
    );
  };

// The cards list (< 768px) renders the same names; CSS hides one of the two.
const rowOf = (name: string) => {
  const cell = within(screen.getByRole("table")).getByText(name);
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
        reportId="r1"
        guest
        packageManager="npm"
        checkId="c1"
        running
        totalPackages={2}
        dependencies={dependencies}
        previousRows={[]}
        currentRows={[result("react")]}
      >
        <DependencyTable />
      </ReportProvider>,
      { wrapper: withUrl() },
    );

    expect(screen.getByText("Showing 2 of 2")).toBeInTheDocument();
    expect(rowOf("react")).not.toHaveAttribute("aria-busy");
    expect(rowOf("eslint")).toHaveAttribute("aria-busy", "true");
    expect(within(rowOf("eslint")).getByText("dev")).toBeInTheDocument();
    // Loaded with the page, so not highlighted.
    expect(rowOf("react")).not.toHaveClass("animate-row-flash");

    await waitFor(() => expect(FakeEventSource.instances).toHaveLength(1));
    FakeEventSource.instances[0]?.send("package", {
      package: { ...result("eslint"), type: "dev" },
    });

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

  const renderTable = (search = "") =>
    render(
      <TooltipProvider delayDuration={0}>
        <ReportProvider
          reportId="r1"
          guest
          packageManager="npm"
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
      { wrapper: withUrl(search) },
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
      // The selection column: a checkbox, no text.
      "",
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

describe("DependencyTable filters in the URL", () => {
  const rows: PackageRowJson[] = [
    result("zod", { lagKind: "patch", latest: "1.0.1", lagMajors: null }),
    result("next", { lagKind: "major", lagMajors: 2, latest: "3.0.0" }),
    result("axios", {
      lagKind: "minor",
      latest: "1.2.0",
      lagMajors: null,
      vulnerabilities: [
        {
          ids: ["GHSA-1"],
          primaryId: "GHSA-1",
          severity: "high",
          fixedIn: null,
        },
      ],
    }),
  ];

  const renderTable = (
    search = "",
    onUrlUpdate?: (event: UrlUpdateEvent) => void,
  ) =>
    render(
      <ReportProvider
        reportId="r1"
        guest
        packageManager="npm"
        checkId="c1"
        running={false}
        totalPackages={rows.length}
        dependencies={rows.map((row) => ({
          name: row.name,
          specifier: "^1.0.0",
          type: "prod" as const,
        }))}
        previousRows={[]}
        currentRows={rows}
      >
        <DependencyTable />
      </ReportProvider>,
      { wrapper: withUrl(search, onUrlUpdate) },
    );

  const shownNames = () =>
    screen
      .queryAllByRole("row")
      .slice(1)
      .map((row) => row.querySelector("td .font-mono")?.textContent ?? "");
  const lastQuery = (spy: ReturnType<typeof vi.fn>) =>
    (spy.mock.lastCall?.[0] as UrlUpdateEvent | undefined)?.queryString;

  it("opens with the filters and sort from the URL", () => {
    renderTable("?vuln=no&sort=-behind");
    expect(shownNames()).toEqual(["next", "zod"]);
    expect(screen.getByText("Showing 2 of 3")).toBeInTheDocument();
    expect(screen.getByText("Vulnerabilities: none")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: /^Behind/ }),
    ).toHaveAttribute("aria-sort", "descending");
  });

  it("writes the sort to the URL", async () => {
    const onUrlUpdate = vi.fn();
    renderTable("", onUrlUpdate);
    fireEvent.click(
      within(screen.getByRole("columnheader", { name: /^Package/ })).getByRole(
        "button",
      ),
    );
    expect(shownNames()).toEqual(["axios", "next", "zod"]);
    await waitFor(() => expect(lastQuery(onUrlUpdate)).toBe("?sort=name"));
  });

  it("applies a filter from its menu and removes it with the chip", async () => {
    const onUrlUpdate = vi.fn();
    renderTable("", onUrlUpdate);
    const toolbar = within(
      screen.getByRole("group", { name: "Filter packages" }),
    );
    fireEvent.keyDown(toolbar.getByRole("button", { name: "Behind" }), {
      key: "Enter",
    });
    fireEvent.click(
      await screen.findByRole("menuitemradio", { name: "minor" }),
    );

    expect(shownNames()).toEqual(["axios"]);
    await waitFor(() => expect(lastQuery(onUrlUpdate)).toBe("?lag=minor"));

    fireEvent.click(
      screen.getByRole("button", { name: "Remove filter Behind: minor" }),
    );
    expect(shownNames()).toHaveLength(3);
    await waitFor(() => expect(lastQuery(onUrlUpdate)).toBe(""));
  });

  it("searches after the typing delay", async () => {
    const onUrlUpdate = vi.fn();
    renderTable("", onUrlUpdate);
    fireEvent.change(
      screen.getByRole("searchbox", { name: "Search packages" }),
      {
        target: { value: "ax" },
      },
    );
    expect(shownNames()).toHaveLength(3);
    await waitFor(() => expect(shownNames()).toEqual(["axios"]));
    await waitFor(() => expect(lastQuery(onUrlUpdate)).toBe("?q=ax"));
  });

  it("shows the no-matches state and clears every filter, keeping the sort", async () => {
    const onUrlUpdate = vi.fn();
    renderTable("?q=nothing&lag=major&sort=name", onUrlUpdate);
    expect(
      screen.getByText("No packages match these filters."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Clear filters" }));
    expect(shownNames()).toEqual(["axios", "next", "zod"]);
    await waitFor(() => expect(lastQuery(onUrlUpdate)).toBe("?sort=name"));
  });

  it("focuses the search on / unless the user is already typing", () => {
    renderTable();
    const search = screen.getByRole("searchbox", { name: "Search packages" });

    expect(fireEvent.keyDown(document.body, { key: "/" })).toBe(false);
    expect(search).toHaveFocus();

    // Not cancelled: the "/" goes into the field.
    expect(fireEvent.keyDown(search, { key: "/" })).toBe(true);
    expect(fireEvent.keyDown(document.body, { key: "/", ctrlKey: true })).toBe(
      true,
    );
  });

  it("says when every package is up to date", () => {
    const current = (name: string) =>
      result(name, { lagKind: "current", latest: "1.0.0", lagMajors: null });
    render(
      <ReportProvider
        reportId="r1"
        guest
        packageManager="npm"
        checkId="c1"
        running={false}
        totalPackages={2}
        dependencies={dependencies}
        previousRows={[]}
        currentRows={[current("react"), current("eslint")]}
      >
        <DependencyTable saveHint />
      </ReportProvider>,
      { wrapper: withUrl() },
    );
    expect(
      screen.getByText("All 2 packages are up to date."),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Save project to get notified about new releases."),
    ).toBeInTheDocument();
    expect(screen.queryByRole("table")).toBeNull();
  });
});

describe("DependencyTable selection", () => {
  const rows: PackageRowJson[] = [
    result("zod", { lagKind: "patch", latest: "1.0.1", lagMajors: null }),
    result("next", { lagKind: "major", lagMajors: 2, latest: "3.0.0" }),
    result("vitest", { type: "dev", lagKind: "minor", latest: "1.2.0" }),
  ];
  const writeText = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });

  const renderTable = (search = "", manager: "npm" | "pnpm" = "npm") =>
    render(
      <ReportProvider
        reportId="r1"
        guest
        packageManager={manager}
        checkId="c1"
        running={false}
        totalPackages={rows.length}
        dependencies={rows.map((row) => ({
          name: row.name,
          specifier: "^1.0.0",
          type: row.type,
        }))}
        previousRows={[]}
        currentRows={rows}
      >
        <DependencyTable />
      </ReportProvider>,
      { wrapper: withUrl(search) },
    );
  const table = () => within(screen.getByRole("table"));
  const selectAll = () =>
    table().getByRole("checkbox", { name: "Select all shown packages" });

  it("swaps the toolbar for the selection bar and back", () => {
    renderTable();
    fireEvent.click(table().getByRole("checkbox", { name: "Select next" }));

    const bar = within(
      screen.getByRole("group", { name: "Selected packages" }),
    );
    expect(bar.getByText("1 selected")).toBeInTheDocument();
    expect(
      screen.queryByRole("group", { name: "Filter packages" }),
    ).not.toBeInTheDocument();
    expect(selectAll()).toHaveAttribute("aria-checked", "mixed");

    fireEvent.click(bar.getByRole("button", { name: "Clear selection" }));
    expect(
      screen.getByRole("group", { name: "Filter packages" }),
    ).toBeInTheDocument();
    expect(selectAll()).toHaveAttribute("aria-checked", "false");
  });

  it("selects every filtered row from the header", () => {
    renderTable("?type=prod");
    fireEvent.click(selectAll());
    expect(screen.getByText("2 selected")).toBeInTheDocument();
    expect(selectAll()).toHaveAttribute("aria-checked", "true");

    fireEvent.click(selectAll());
    expect(screen.queryByText(/selected$/)).not.toBeInTheDocument();
  });

  it("copies one command with the dev packages after &&", async () => {
    renderTable("", "pnpm");
    fireEvent.click(selectAll());
    fireEvent.click(
      screen.getByRole("button", { name: "Copy update command" }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith(
        "pnpm add next@3.0.0 zod@1.0.1 && pnpm add -D vitest@1.2.0",
      ),
    );
  });

  it("selects from the mobile cards too", () => {
    renderTable();
    const cards = within(screen.getByRole("list", { name: "Packages" }));
    fireEvent.click(cards.getByRole("checkbox", { name: "Select zod" }));
    expect(
      table().getByRole("checkbox", { name: "Select zod" }),
    ).toHaveAttribute("aria-checked", "true");
  });
});

describe("DependencyTable on small screens", () => {
  const rows = [
    result("zod", { lagKind: "patch", latest: "1.0.1", lagMajors: null }),
    result("next", { lagKind: "major", lagMajors: 2, latest: "3.0.0" }),
  ];

  it("filters from the Filters sheet", async () => {
    const onUrlUpdate = vi.fn();
    render(
      <ReportProvider
        reportId="r1"
        guest
        packageManager="npm"
        checkId="c1"
        running={false}
        totalPackages={rows.length}
        dependencies={rows.map((row) => ({
          name: row.name,
          specifier: "^1.0.0",
          type: "prod" as const,
        }))}
        previousRows={[]}
        currentRows={rows}
      >
        <DependencyTable />
      </ReportProvider>,
      { wrapper: withUrl("", onUrlUpdate) },
    );
    fireEvent.click(screen.getByRole("button", { name: "Filters" }));
    const sheet = within(
      await screen.findByRole("dialog", { name: "Filters" }),
    );
    fireEvent.click(
      within(sheet.getByRole("group", { name: "Behind" })).getByRole("radio", {
        name: "patch",
      }),
    );

    fireEvent.keyDown(sheet.getByRole("radio", { name: "patch" }), {
      key: "Escape",
    });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );

    const cards = within(screen.getByRole("list", { name: "Packages" }));
    expect(cards.getAllByRole("listitem")).toHaveLength(1);
    expect(cards.getByText("zod")).toBeInTheDocument();
    await waitFor(() =>
      expect(
        (onUrlUpdate.mock.lastCall?.[0] as UrlUpdateEvent | undefined)
          ?.queryString,
      ).toBe("?lag=patch"),
    );
    expect(
      screen.getByRole("button", { name: "Filters (1)" }),
    ).toBeInTheDocument();
  });
});

describe("DependencyTable with 500+ rows", () => {
  const count = VIRTUALIZE_FROM + 100;
  const names = Array.from(
    { length: count },
    (_, i) => `pkg-${String(i).padStart(4, "0")}`,
  );

  beforeEach(() => {
    // jsdom has no layout: give the scroll area a height to fill.
    vi.spyOn(HTMLElement.prototype, "clientHeight", "get").mockReturnValue(640);
    vi.spyOn(HTMLElement.prototype, "clientWidth", "get").mockReturnValue(1024);
    // Measured rows (offsetHeight) would otherwise all be 0 px tall.
    vi.spyOn(HTMLElement.prototype, "offsetHeight", "get").mockReturnValue(41);
  });
  afterEach(() => vi.restoreAllMocks());

  it("renders only the visible rows and keeps the header", () => {
    render(
      <ReportProvider
        reportId="r1"
        guest
        packageManager="npm"
        checkId="c1"
        running={false}
        totalPackages={count}
        dependencies={names.map((name) => ({
          name,
          specifier: "^1.0.0",
          type: "prod" as const,
        }))}
        previousRows={[]}
        currentRows={names.map((name) => result(name))}
      >
        <DependencyTable />
      </ReportProvider>,
      { wrapper: withUrl("?sort=name") },
    );
    const rendered = within(screen.getByRole("table")).getAllByRole("row");
    // The header row plus a window of body rows.
    expect(rendered.length).toBeGreaterThan(1);
    expect(rendered.length).toBeLessThan(100);
    expect(
      screen.getByText(`Showing ${count} of ${count}`),
    ).toBeInTheDocument();
    expect(
      within(rendered[1] ?? document.body).getByText("pkg-0000"),
    ).toBeInTheDocument();
  });
});

// The package card's j/k (screens 5.9) walk `orderedRows`; it must match
// what the table shows for every sort.
describe("DependencyTable order matches orderedRows", () => {
  const rows: PackageRowJson[] = [
    result("b-pkg", {
      lagKind: "minor",
      latest: "1.2.0",
      lagMajors: null,
      lastReleaseAt: "2026-03-01T00:00:00.000Z",
    }),
    result("a-pkg", {
      lagKind: "current",
      latest: "1.0.0",
      lagMajors: null,
      lastReleaseAt: "2026-05-01T00:00:00.000Z",
    }),
    result("d-pkg", {
      vulnerabilities: [
        {
          ids: ["GHSA-1"],
          primaryId: "GHSA-1",
          severity: "low",
          fixedIn: null,
        },
      ],
      lastReleaseAt: "2026-01-01T00:00:00.000Z",
    }),
    result("c-pkg", {
      checked: false,
      reason: "not-from-registry",
      registryName: null,
      current: null,
      latest: null,
      lagKind: null,
      lagMajors: null,
      status: null,
    }),
    result("e-pkg", { type: "dev", lagKind: "minor", lagMajors: null }),
  ];
  const deps = rows.map((row) => ({
    name: row.name,
    specifier: "^1.0.0",
    type: row.type,
  }));

  beforeEach(() => vi.stubGlobal("EventSource", FakeEventSource));
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    "",
    "?sort=name",
    "?sort=-name",
    "?sort=behind",
    "?sort=-behind",
    "?sort=vulns",
    "?sort=-vulns",
    "?sort=released",
    "?sort=-released",
    "?type=prod&sort=-behind",
  ])("%s", (search) => {
    render(
      <TooltipProvider>
        <ReportProvider
          reportId="r1"
          guest
          packageManager="npm"
          checkId="c1"
          running={false}
          totalPackages={rows.length}
          dependencies={deps}
          previousRows={[]}
          currentRows={rows}
        >
          <DependencyTable />
        </ReportProvider>
      </TooltipProvider>,
      { wrapper: withUrl(search) },
    );
    const shown = within(screen.getByRole("table"))
      .getAllByRole("row")
      .slice(1)
      .map((row) => row.getAttribute("data-package"));
    const filters = createLoader(filterParsers)(search);
    const expected = orderedRows(
      buildRows(deps, { previous: [], current: rows, streamed: {} }),
      filters,
    ).map((row) => row.name);
    expect(shown).toEqual(expected);
  });
});
