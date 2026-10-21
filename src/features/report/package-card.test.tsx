import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { PackageDetails } from "@/server/check/package-details";
import type { PackageRowJson } from "@/server/check/package-row";
import type { ReleaseNotesView } from "@/server/check/release-notes";
import { DependencyTable } from "./dependency-table";
import { PackageCard } from "./package-card";
import { ReportProvider } from "./report-context";
import { FakeEventSource } from "./test/fake-event-source";

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

const getPackageDetails = vi.hoisted(() => vi.fn());
const getReleaseNotes = vi.hoisted(() => vi.fn());
vi.mock("./package-actions", () => ({ getPackageDetails, getReleaseNotes }));

const toast = vi.hoisted(() => vi.fn());
vi.mock("@/components/ui/toast", () => ({ toast }));

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
  latest: "1.0.0",
  lagKind: "current",
  lagMajors: null,
  status: "active",
  deprecationMessage: null,
  lastReleaseAt: null,
  vulnerabilities: [],
  checkedAt: "2026-10-20T10:00:00.000Z",
  ...overrides,
});

// Default table order: vulnerable first, then the furthest behind, then name.
const rows: PackageRowJson[] = [
  result("react", { latest: "19.0.0", lagKind: "major", lagMajors: 1 }),
  result("lodash", {
    current: "4.17.15",
    latest: "4.17.21",
    lagKind: "patch",
    vulnerabilities: [
      {
        ids: ["GHSA-p6mc-m468-83gw", "CVE-2020-8203"],
        primaryId: "GHSA-p6mc-m468-83gw",
        severity: "high",
        summary: "Prototype Pollution in lodash",
        details: "Versions of lodash prior to 4.17.19 are vulnerable.",
        fixedIn: "4.17.21",
      },
    ],
  }),
  result("zod"),
  result("local-lib", {
    checked: false,
    reason: "not-from-registry",
    registryName: null,
    current: null,
    latest: null,
    lagKind: null,
    status: null,
  }),
];

const details: PackageDetails = {
  description: "Lodash modular utilities.",
  license: "MIT",
  npmUrl: "https://www.npmjs.com/package/lodash",
  repositoryUrl: "https://github.com/lodash/lodash",
  releases: [
    {
      version: "4.17.21",
      publishedAt: "2021-02-20T00:00:00.000Z",
      position: 1,
      major: false,
    },
  ],
};

const releaseNotes: ReleaseNotesView = {
  notes: [
    {
      version: "4.17.21",
      title: null,
      body: "## Bug Fixes\n- Fixed [prototype pollution](https://example.com/fix).",
      url: "https://github.com/lodash/lodash/releases/tag/4.17.21",
      publishedAt: "2021-02-20T00:00:00.000Z",
      possiblyBreaking: false,
    },
  ],
  repositoryUrl: "https://github.com/lodash/lodash",
};

function renderCard(
  search: string,
  {
    guest = true,
    onUrlUpdate,
  }: { guest?: boolean; onUrlUpdate?: (event: UrlUpdateEvent) => void } = {},
) {
  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <NuqsTestingAdapter
        searchParams={search}
        onUrlUpdate={onUrlUpdate}
        hasMemory
      >
        <TooltipProvider>{children}</TooltipProvider>
      </NuqsTestingAdapter>
    );
  }
  return render(
    <ReportProvider
      reportId="r1"
      guest={guest}
      packageManager="npm"
      checkId="c1"
      running={false}
      totalPackages={rows.length}
      dependencies={rows.map((row) => ({
        name: row.name,
        specifier: row.specifier,
        type: row.type,
      }))}
      previousRows={[]}
      currentRows={rows}
    >
      <DependencyTable />
      <PackageCard />
    </ReportProvider>,
    { wrapper: Wrapper },
  );
}

const dialog = () => screen.getByRole("dialog");
// Radix tabs switch on mousedown, not click.
const openTab = (name: string | RegExp) =>
  fireEvent.mouseDown(within(dialog()).getByRole("tab", { name }));
const tableRow = (name: string) => {
  const row = within(screen.getByRole("table")).getByText(name).closest("tr");
  if (!row) throw new Error(`no row for ${name}`);
  return row;
};
const lastPkg = (onUrlUpdate: ReturnType<typeof vi.fn>) =>
  (
    onUrlUpdate.mock.lastCall?.[0] as UrlUpdateEvent | undefined
  )?.searchParams.get("pkg");

describe("PackageCard", () => {
  const writeText = vi.fn<(text: string) => Promise<void>>();

  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
    getPackageDetails
      .mockReset()
      .mockResolvedValue({ ok: true, value: details });
    getReleaseNotes
      .mockReset()
      .mockResolvedValue({ ok: true, value: releaseNotes });
    toast.mockReset();
    writeText.mockReset().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      configurable: true,
    });
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    window.localStorage.clear();
  });

  it("opens from ?pkg with the stored versions and the loaded details", async () => {
    renderCard("?pkg=lodash");
    const card = within(dialog());
    expect(card.getByRole("heading", { name: "lodash" })).toBeInTheDocument();
    expect(card.getByText("4.17.15")).toBeInTheDocument();
    expect(card.getByText("4.17.21")).toBeInTheDocument();

    expect(
      await card.findByText("Lodash modular utilities."),
    ).toBeInTheDocument();
    expect(getPackageDetails).toHaveBeenCalledWith("r1", "lodash");
    expect(card.getByText("MIT")).toBeInTheDocument();
    expect(card.getByText("1 release since current")).toBeInTheDocument();
    expect(
      card.getByRole("link", { name: "lodash on npm (opens in a new tab)" }),
    ).toHaveAttribute("href", "https://www.npmjs.com/package/lodash");
    expect(
      card.getByRole("link", { name: "Repository (opens in a new tab)" }),
    ).toHaveAttribute("href", "https://github.com/lodash/lodash");
  });

  it("lists each vulnerability once with all its IDs as links", () => {
    renderCard("?pkg=lodash");
    const section = within(
      within(dialog()).getByRole("tabpanel", { name: "Vulnerabilities (1)" }),
    );
    expect(
      section.getByRole("link", {
        name: "GHSA-p6mc-m468-83gw (opens in a new tab)",
      }),
    ).toHaveAttribute(
      "href",
      "https://osv.dev/vulnerability/GHSA-p6mc-m468-83gw",
    );
    expect(
      section.getByRole("link", { name: "CVE-2020-8203 (opens in a new tab)" }),
    ).toHaveAttribute("href", "https://osv.dev/vulnerability/CVE-2020-8203");
    expect(
      section.getByText("Versions of lodash prior to 4.17.19 are vulnerable."),
    ).toBeInTheDocument();
    expect(section.getByText("Fixed in 4.17.21")).toBeInTheDocument();
  });

  it("says when a package has no known vulnerabilities", async () => {
    renderCard("?pkg=zod");
    // Nothing to show there, so the card opens on the release notes.
    expect(
      within(dialog()).getByRole("tab", { name: "Release notes" }),
    ).toHaveAttribute("aria-selected", "true");
    openTab("Vulnerabilities (0)");
    expect(
      await within(dialog()).findByText("No known vulnerabilities."),
    ).toBeInTheDocument();
  });

  it("lists release notes collapsed, newest first, rendered from markdown", async () => {
    renderCard("?pkg=lodash");
    expect(
      within(dialog()).getByRole("tab", { name: "Vulnerabilities (1)" }),
    ).toHaveAttribute("aria-selected", "true");
    openTab("Release notes");
    const panel = within(
      within(dialog()).getByRole("tabpanel", { name: "Release notes" }),
    );
    const version = await panel.findByText("4.17.21");
    expect(version.closest("details")).not.toHaveAttribute("open");
    expect(panel.queryByText("Possibly breaking")).not.toBeInTheDocument();
    expect(
      panel.getByRole("heading", { name: "Bug Fixes" }),
    ).toBeInTheDocument();
    expect(
      panel.getByRole("link", { name: "prototype pollution" }),
    ).toHaveAttribute("target", "_blank");
    expect(panel.getByRole("link", { name: "View on GitHub" })).toHaveAttribute(
      "href",
      "https://github.com/lodash/lodash/releases/tag/4.17.21",
    );
    expect(getReleaseNotes).toHaveBeenCalledWith("r1", "lodash");
  });

  it("marks possibly breaking releases in the list and on the scale", async () => {
    getPackageDetails.mockResolvedValue({
      ok: true,
      value: {
        ...details,
        releases: [
          { version: "1.1.0", publishedAt: null, position: 1, major: false },
        ],
      },
    });
    getReleaseNotes.mockResolvedValue({
      ok: true,
      value: {
        notes: [
          {
            ...releaseNotes.notes[0],
            version: "1.1.0",
            body: "### Removed\n- `legacy()`",
            possiblyBreaking: true,
          },
        ],
        repositoryUrl: null,
      },
    });
    renderCard("?pkg=zod");
    const card = within(dialog());
    expect(await card.findByText("Possibly breaking")).toBeInTheDocument();
    expect(
      card.getByText("Detected automatically from release notes"),
    ).toBeInTheDocument();
    expect(
      card.getByText("1 release since current, 1 minor possibly breaking"),
    ).toBeInTheDocument();
  });

  it("drops raw HTML and images from release notes", async () => {
    getReleaseNotes.mockResolvedValue({
      ok: true,
      value: {
        ...releaseNotes,
        notes: [
          {
            ...releaseNotes.notes[0],
            body: '<b onclick="x()">raw</b> text ![pixel](https://example.com/p.png)',
          },
        ],
      },
    });
    renderCard("?pkg=zod");
    const panel = within(
      within(dialog()).getByRole("tabpanel", { name: "Release notes" }),
    );
    await panel.findByText("4.17.21");
    // The tags go, their text stays as plain text.
    expect(panel.getByText(/raw\s+text/)).toBeInTheDocument();
    expect(
      document.querySelector("[role=dialog] :is(b, img, [onclick])"),
    ).toBeNull();
  });

  it("says when no release notes are published and links the repository", async () => {
    getReleaseNotes.mockResolvedValue({
      ok: true,
      value: { notes: [], repositoryUrl: "https://github.com/colinhacks/zod" },
    });
    renderCard("?pkg=zod");
    const card = within(dialog());
    expect(
      await card.findByText(/No release notes published\./),
    ).toBeInTheDocument();
    expect(card.getByRole("link", { name: "Open repository" })).toHaveAttribute(
      "href",
      "https://github.com/colinhacks/zod",
    );
  });

  it("keeps the rest of the card when release notes fail, and retries", async () => {
    getReleaseNotes.mockResolvedValueOnce({ ok: false, error: "unavailable" });
    renderCard("?pkg=zod");
    const card = within(dialog());
    expect(
      await card.findByText("Couldn't load release notes."),
    ).toBeInTheDocument();
    expect(card.getByText("Lodash modular utilities.")).toBeInTheDocument();

    fireEvent.click(card.getByRole("button", { name: "Retry" }));
    expect(
      await card.findByText("4.17.21", { selector: "span" }),
    ).toBeInTheDocument();
    expect(getReleaseNotes).toHaveBeenCalledTimes(2);
  });

  it("copies the update command and shows the guest hint", async () => {
    renderCard("?pkg=lodash");
    fireEvent.click(
      within(dialog()).getByRole("button", { name: "Copy update command" }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("npm i lodash@4.17.21"),
    );
    expect(
      within(dialog()).getByText("Save project to snooze or plan updates"),
    ).toBeInTheDocument();
  });

  it("copies the command for the manager picked in the switch", async () => {
    renderCard("?pkg=lodash");
    const switcher = within(
      within(dialog()).getByRole("radiogroup", { name: "Package manager" }),
    );
    expect(switcher.getByRole("radio", { name: "npm" })).toBeChecked();

    fireEvent.click(switcher.getByRole("radio", { name: "yarn" }));
    expect(switcher.getByRole("radio", { name: "yarn" })).toBeChecked();
    fireEvent.click(
      within(dialog()).getByRole("button", { name: "Copy update command" }),
    );
    await waitFor(() =>
      expect(writeText).toHaveBeenCalledWith("yarn add lodash@4.17.21"),
    );
  });

  it("has no command for an up-to-date package and no hint for a project", () => {
    renderCard("?pkg=zod", { guest: false });
    expect(
      within(dialog()).queryByRole("button", { name: "Copy update command" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog()).queryByRole("radiogroup", { name: "Package manager" }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog()).queryByText("Save project to snooze or plan updates"),
    ).not.toBeInTheDocument();
  });

  it("names the k, j and Esc shortcuts even without a footer action", () => {
    renderCard("?pkg=zod", { guest: false });
    const card = within(dialog());
    // Next first: "k j next / previous".
    expect(
      card
        .getAllByText(/^(k|j|Esc)$/, { selector: "kbd" })
        .map((key) => key.textContent),
    ).toEqual(["k", "j", "Esc"]);
    expect(card.getByText("next / previous ·")).toBeInTheDocument();
  });

  it("shows why a package wasn't checked and loads nothing for it", () => {
    renderCard("?pkg=local-lib");
    expect(
      within(dialog()).getAllByText("Not from npm registry").length,
    ).toBeGreaterThan(0);
    expect(getPackageDetails).not.toHaveBeenCalled();
    expect(getReleaseNotes).not.toHaveBeenCalled();
    expect(
      within(dialog()).queryByRole("button", { name: "Copy update command" }),
    ).not.toBeInTheDocument();
  });

  it("keeps the rest of the card when the details fail, and retries", async () => {
    getPackageDetails.mockResolvedValueOnce({
      ok: false,
      error: "unavailable",
    });
    renderCard("?pkg=lodash");
    const card = within(dialog());
    expect(
      await card.findByText("Couldn't load package details."),
    ).toBeInTheDocument();
    expect(card.getByText("Fixed in 4.17.21")).toBeInTheDocument();

    fireEvent.click(card.getByRole("button", { name: "Retry" }));
    expect(
      await card.findByText("Lodash modular utilities."),
    ).toBeInTheDocument();
    expect(getPackageDetails).toHaveBeenCalledTimes(2);
  });

  it("doesn't open for a package that isn't in the report", async () => {
    const onUrlUpdate = vi.fn();
    renderCard("?pkg=left-pad", { onUrlUpdate });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(toast).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith({
      title: "Package not found in this project",
    });
    await waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    expect(lastPkg(onUrlUpdate)).toBeNull();
    expect(onUrlUpdate.mock.lastCall?.[0].options.history).toBe("replace");
  });

  it("moves through packages in the table's order with k (next) and j (previous)", async () => {
    const onUrlUpdate = vi.fn();
    renderCard("?pkg=lodash", { onUrlUpdate });

    fireEvent.keyDown(dialog(), { key: "k" });
    await waitFor(() => expect(lastPkg(onUrlUpdate)).toBe("react"));
    expect(onUrlUpdate.mock.lastCall?.[0].options.history).toBe("replace");
    expect(
      within(dialog()).getByRole("heading", { name: "react" }),
    ).toBeInTheDocument();

    fireEvent.keyDown(dialog(), { key: "j" });
    await waitFor(() => expect(lastPkg(onUrlUpdate)).toBe("lodash"));

    // lodash is first: nothing before it.
    onUrlUpdate.mockClear();
    fireEvent.keyDown(dialog(), { key: "j" });
    fireEvent.keyDown(dialog(), { key: "k", ctrlKey: true });
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });

  it("follows the sort in the URL", async () => {
    const onUrlUpdate = vi.fn();
    renderCard("?sort=name&pkg=lodash", { onUrlUpdate });
    fireEvent.keyDown(dialog(), { key: "k" });
    await waitFor(() => expect(lastPkg(onUrlUpdate)).toBe("react"));
    fireEvent.keyDown(dialog(), { key: "j" });
    fireEvent.keyDown(dialog(), { key: "j" });
    await waitFor(() => expect(lastPkg(onUrlUpdate)).toBe("local-lib"));
  });

  it("closes on Esc and returns focus to the package's row", async () => {
    const onUrlUpdate = vi.fn();
    renderCard("?pkg=lodash", { onUrlUpdate });
    fireEvent.keyDown(dialog(), { key: "k" });
    await waitFor(() => expect(lastPkg(onUrlUpdate)).toBe("react"));

    fireEvent.keyDown(dialog(), { key: "Escape" });
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(lastPkg(onUrlUpdate)).toBeNull();
    expect(onUrlUpdate.mock.lastCall?.[0].options.history).toBe("push");
    await waitFor(() => expect(tableRow("react")).toHaveFocus());
  });
});

describe("DependencyTable rows open the package card", () => {
  beforeEach(() => {
    vi.stubGlobal("EventSource", FakeEventSource);
    getPackageDetails
      .mockReset()
      .mockResolvedValue({ ok: true, value: details });
    getReleaseNotes
      .mockReset()
      .mockResolvedValue({ ok: true, value: releaseNotes });
  });
  afterEach(() => vi.unstubAllGlobals());

  it("opens on a click and marks the open row", async () => {
    const onUrlUpdate = vi.fn();
    renderCard("", { onUrlUpdate });
    // The open dialog hides the page from the accessibility tree.
    const zod = tableRow("zod");
    fireEvent.click(within(zod).getByText("zod"));
    await waitFor(() => expect(lastPkg(onUrlUpdate)).toBe("zod"));
    expect(onUrlUpdate.mock.lastCall?.[0].options.history).toBe("push");
    expect(
      within(dialog()).getByRole("heading", { name: "zod" }),
    ).toBeInTheDocument();
    expect(zod.firstElementChild).toHaveClass("border-l-brand");
  });

  it("opens on Enter on a focused row", async () => {
    const onUrlUpdate = vi.fn();
    renderCard("", { onUrlUpdate });
    fireEvent.keyDown(tableRow("react"), { key: "Enter" });
    await waitFor(() => expect(lastPkg(onUrlUpdate)).toBe("react"));
  });

  it("doesn't open from the row's checkbox", () => {
    const onUrlUpdate = vi.fn();
    renderCard("", { onUrlUpdate });
    fireEvent.click(
      within(tableRow("zod")).getByRole("checkbox", { name: "Select zod" }),
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(onUrlUpdate).not.toHaveBeenCalled();
  });
});
