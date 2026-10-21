import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  type HealthScore as Score,
  healthScore,
} from "@/server/analysis/health-score";
import { HealthScore } from "./health-score";

const empty = healthScore([]);
const score = (overrides: Partial<Score>): Score => ({
  ...empty,
  ...overrides,
});

describe("HealthScore", () => {
  it.each([
    [92, "good", "text-success"],
    [65, "fair", "text-warning"],
    [30, "poor", "text-danger"],
  ] as const)("colors %i by its band", (value, band, color) => {
    const { container } = render(
      <HealthScore score={score({ score: value, band })} />,
    );

    expect(screen.getByText(String(value))).toBeInTheDocument();
    expect(container.querySelector(`.${color}`)).not.toBeNull();
  });

  it("shows a dash when nothing could be checked", () => {
    render(<HealthScore score={score({ score: null, band: null })} />);
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("marks a partial score", () => {
    const { rerender } = render(
      <HealthScore score={score({ score: 70, band: "fair" })} />,
    );
    expect(screen.queryByText("Partial")).toBeNull();

    rerender(
      <HealthScore score={score({ score: 70, band: "fair", partial: true })} />,
    );
    expect(screen.getByText("Partial")).toBeInTheDocument();
  });

  it("explains the weights and this report's penalties", () => {
    const breakdown = {
      ...empty.breakdown,
      major: { count: 7, penalty: 36, cap: 36 },
    };
    render(
      <HealthScore score={score({ score: 64, band: "fair", breakdown })} />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "How it's calculated" }),
    );
    const dialog = screen.getByRole("dialog");

    const major = within(dialog).getByRole("row", { name: /Major behind/ });
    expect(major).toHaveTextContent("−6 each, max −36");
    expect(major).toHaveTextContent("7 · −36");
    // No "−0" for a category without findings.
    const minor = within(dialog).getByRole("row", { name: /Minor behind/ });
    expect(minor).toHaveTextContent(/0 · 0$/);
    expect(dialog).toHaveTextContent(
      "critical −20, high −10, moderate −4, low −1; max −60",
    );
  });
});
