import { fireEvent, render, screen, within } from "@testing-library/react";
import { NuqsTestingAdapter, type UrlUpdateEvent } from "nuqs/adapters/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportActionResult } from "./actions";
import { ProjectSavedToast } from "./project-saved-toast";
import { ReportHeader, type ReportHeaderMode } from "./report-header";

const actions = vi.hoisted(() => ({
  checkAgain: vi.fn(async (): Promise<ReportActionResult> => ({})),
  saveReport: vi.fn(async () => {}),
}));
vi.mock("./actions", () => actions);
vi.mock("./report-context", () => ({ useReport: () => ({ running: false }) }));
const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/components/ui/toast", () => toasts);

function renderHeader(mode: ReportHeaderMode) {
  render(
    <ReportHeader
      reportId="r1"
      mode={mode}
      name="shop"
      source={{ kind: "paste" }}
      checkedAt={null}
      expiresAt={null}
      warnings={[]}
    />,
  );
  // Desktop buttons only: the "⋯" menu is closed and renders nothing.
  return within(screen.getByRole("banner"));
}

describe("ReportHeader", () => {
  beforeEach(() => vi.clearAllMocks());

  it("sends a guest to sign in from Save project", () => {
    const header = renderHeader({ kind: "guest", signedIn: false });

    expect(header.getByRole("link", { name: "Save project" })).toHaveAttribute(
      "href",
      "/login?next=/r/r1/save",
    );
    expect(
      header.getByRole("button", { name: "Check again" }),
    ).toBeInTheDocument();
  });

  it("saves right away for a signed-in user", () => {
    const header = renderHeader({ kind: "guest", signedIn: true });

    fireEvent.click(header.getByRole("button", { name: "Save project" }));

    expect(actions.saveReport).toHaveBeenCalledWith("r1");
  });

  it("gives a project Check again, Copy link and Settings, no Save", () => {
    const header = renderHeader({
      kind: "project",
      settingsHref: "/projects/p1/settings",
    });

    expect(
      header.queryByRole("link", { name: "Save project" }),
    ).not.toBeInTheDocument();
    expect(
      header.queryByRole("button", { name: "Save project" }),
    ).not.toBeInTheDocument();
    fireEvent.click(header.getByRole("button", { name: "Check again" }));
    expect(actions.checkAgain).toHaveBeenCalledWith("r1");
    expect(
      header.getByRole("button", { name: "Copy link" }),
    ).toBeInTheDocument();
    expect(
      header.getByRole("link", { name: "Project settings" }),
    ).toHaveAttribute("href", "/projects/p1/settings");
  });
});

describe("ProjectSavedToast", () => {
  beforeEach(() => vi.clearAllMocks());

  it("toasts once and drops only saved=1 from the URL", async () => {
    const onUrlUpdate = vi.fn<(event: UrlUpdateEvent) => void>();
    render(
      <NuqsTestingAdapter
        searchParams="?saved=1&q=react"
        onUrlUpdate={onUrlUpdate}
      >
        <ProjectSavedToast />
      </NuqsTestingAdapter>,
    );

    expect(toasts.toast).toHaveBeenCalledTimes(1);
    expect(toasts.toast).toHaveBeenCalledWith({ title: "Project saved" });
    await vi.waitFor(() => expect(onUrlUpdate).toHaveBeenCalled());
    const [event] = onUrlUpdate.mock.calls[0] ?? [];
    expect(event?.queryString).toBe("?q=react");
    expect(event?.options.history).toBe("replace");
  });

  it("stays quiet without saved=1", () => {
    render(
      <NuqsTestingAdapter searchParams="?q=react">
        <ProjectSavedToast />
      </NuqsTestingAdapter>,
    );

    expect(toasts.toast).not.toHaveBeenCalled();
  });
});
