import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  LagBadge,
  PackageStatusBadge,
  SeverityBadge,
} from "@/components/status-badges";
import { TooltipProvider } from "@/components/ui/tooltip";

describe("LagBadge", () => {
  it.each([
    ["current", "up to date", "text-success"],
    ["patch", "patch", "text-neutral-badge"],
    ["minor", "minor", "text-warning"],
    ["major", "major", "text-danger"],
  ] as const)("%s → %s", (lag, label, toneClass) => {
    render(<LagBadge lag={lag} />);
    expect(screen.getByText(label)).toHaveClass(toneClass);
  });

  it("shows the number of majors when behind by several", () => {
    render(<LagBadge lag="major" majorsBehind={2} />);
    expect(screen.getByText("2 majors")).toHaveClass("text-danger");
  });
});

describe("SeverityBadge", () => {
  it.each([
    ["critical", "text-critical"],
    ["high", "text-danger"],
    ["moderate", "text-moderate"],
    ["low", "text-neutral-badge"],
  ] as const)("%s", (severity, toneClass) => {
    render(<SeverityBadge severity={severity} />);
    expect(screen.getByText(severity)).toHaveClass(toneClass);
  });
});

describe("PackageStatusBadge", () => {
  it.each([
    ["active", "text-neutral-badge"],
    ["stale", "text-warning"],
    ["deprecated", "text-danger"],
  ] as const)("%s", (status, toneClass) => {
    render(<PackageStatusBadge status={status} />);
    const badge = screen.getByText(status);
    expect(badge).toHaveClass(toneClass);
    expect(badge).not.toHaveClass("border-dashed");
  });

  it("renders not checked with a dashed border", () => {
    render(<PackageStatusBadge status="unchecked" />);
    expect(screen.getByText("not checked")).toHaveClass("border-dashed");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("shows the reason in a tooltip reachable by keyboard", async () => {
    render(
      <TooltipProvider delayDuration={0}>
        <PackageStatusBadge
          status="unchecked"
          reason="npm registry timed out"
        />
      </TooltipProvider>,
    );
    fireEvent.focus(screen.getByRole("button", { name: "not checked" }));
    expect(await screen.findByRole("tooltip")).toHaveTextContent(
      "npm registry timed out",
    );
  });
});
