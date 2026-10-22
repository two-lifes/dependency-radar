import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { DashboardProject } from "@/server/analysis/dashboard-card";
import type { DisplayStatus } from "./check-queue";
import { ProjectCard } from "./project-card";

const project: DashboardProject = {
  id: "p1",
  name: "shop-frontend",
  source: "github",
  repoUrl: "https://github.com/acme/shop-frontend",
  latest: null,
  result: {
    score: 45,
    vulnerabilityCount: 7,
    severeVulnerableCount: 2,
    finishedAt: new Date("2026-10-22T10:00:00.000Z"),
  },
};

function renderCard(
  status: DisplayStatus,
  overrides: Partial<DashboardProject> = {},
  handlers = { onCheckNow: vi.fn(), onDelete: vi.fn() },
) {
  render(
    <TooltipProvider>
      <ProjectCard
        project={{ ...project, ...overrides }}
        status={status}
        {...handlers}
      />
    </TooltipProvider>,
  );
  return handlers;
}

const openMenu = async () => {
  fireEvent.keyDown(
    screen.getByRole("button", { name: "Actions for shop-frontend" }),
    { key: "Enter" },
  );
  return screen.findByRole("menu");
};

describe("ProjectCard", () => {
  it("links to the project's report and shows its last result", () => {
    renderCard({ kind: "checked", at: new Date("2026-10-22T10:00:00.000Z") });

    expect(screen.getByRole("link", { name: "shop-frontend" })).toHaveAttribute(
      "href",
      "/projects/p1/dependencies",
    );
    expect(
      screen.getByText("github.com/acme/shop-frontend"),
    ).toBeInTheDocument();
    expect(screen.getByText("45")).toHaveClass("text-danger");
    expect(screen.getByText("7 vulnerabilities")).toHaveClass("text-danger");
    expect(screen.getByText(/Checked/)).toBeInTheDocument();
  });

  it("keeps the vulnerability count muted without critical or high ones", () => {
    renderCard(
      { kind: "checked", at: new Date() },
      {
        result: {
          score: 92,
          vulnerabilityCount: 1,
          severeVulnerableCount: 0,
          finishedAt: new Date(),
        },
      },
    );
    expect(screen.getByText("92")).toHaveClass("text-success");
    expect(screen.getByText("1 vulnerability")).toHaveClass(
      "text-muted-foreground",
    );
  });

  it.each<[DisplayStatus, string]>([
    [{ kind: "checking", percent: 40 }, "Checking… 40%"],
    [{ kind: "queued" }, "Queued"],
    [
      { kind: "limited", retryAfterSeconds: 600 },
      "Too many checks. Try again in 10 minutes.",
    ],
    [{ kind: "failed" }, "Check failed"],
  ])("shows %o instead of the date", (status, text) => {
    renderCard(status, { result: null });
    expect(screen.getByText(text)).toBeInTheDocument();
    expect(screen.getByText("No score")).toBeInTheDocument();
    expect(screen.queryByText(/vulnerabilit/)).not.toBeInTheDocument();
  });

  it("offers Check now, Settings and Delete in the menu", async () => {
    const handlers = renderCard({ kind: "checked", at: new Date() });
    await openMenu();

    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/projects/p1/settings",
    );
    fireEvent.click(screen.getByRole("menuitem", { name: "Check now" }));
    expect(handlers.onCheckNow).toHaveBeenCalledOnce();

    await openMenu();
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
    expect(handlers.onDelete).toHaveBeenCalledOnce();
  });

  it("disables Check now while the project is checking or queued", async () => {
    renderCard({ kind: "checking", percent: 10 });
    await openMenu();
    expect(screen.getByRole("menuitem", { name: "Check now" })).toHaveAttribute(
      "data-disabled",
    );
  });
});
