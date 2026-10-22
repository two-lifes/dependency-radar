import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReportActionResult } from "./actions";
import { CheckBanner, CheckFailed } from "./check-status";
import { checkFailureCopy } from "./copy";

const actions = vi.hoisted(() => ({
  cancel: vi.fn(async (): Promise<ReportActionResult> => ({})),
  resume: vi.fn(async (): Promise<ReportActionResult> => ({})),
  retry: vi.fn(async (): Promise<ReportActionResult> => ({})),
}));
vi.mock("./actions", () => actions);

const toasts = vi.hoisted(() => ({ toast: vi.fn() }));
vi.mock("@/components/ui/toast", () => toasts);

const navigation = vi.hoisted(() => ({ search: "" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(navigation.search),
}));

describe("CheckBanner", () => {
  beforeEach(() => {
    navigation.search = "";
    vi.clearAllMocks();
  });

  it("offers Show and Retry failed for a partial check", () => {
    navigation.search = "q=re&status=active";
    render(
      <CheckBanner
        status="partial"
        checkId="c1"
        sourceFailures={12}
        basePath="/r/abc"
      />,
    );

    expect(
      screen.getByText("12 packages couldn't be checked."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Show" })).toHaveAttribute(
      "href",
      "/r/abc/dependencies?q=re&status=unchecked",
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry failed" }));
    expect(actions.retry).toHaveBeenCalledWith("c1");
  });

  it("offers Resume for a cancelled check", () => {
    render(
      <CheckBanner
        status="cancelled"
        checkId="c1"
        sourceFailures={0}
        basePath="/r/abc"
      />,
    );

    expect(
      screen.getByText("Check cancelled. Showing partial results."),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Resume" }));
    expect(actions.resume).toHaveBeenCalledWith("c1");
  });

  it("toasts the rate limit when Retry failed is refused", async () => {
    const message = "Too many checks. Try again in 40 minutes.";
    actions.retry.mockResolvedValueOnce({ error: message });
    render(
      <CheckBanner
        status="partial"
        checkId="c1"
        sourceFailures={3}
        basePath="/r/abc"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Retry failed" }));

    await waitFor(() =>
      expect(toasts.toast).toHaveBeenCalledWith({ title: message }),
    );
  });

  it("doesn't toast when the action goes through", async () => {
    render(
      <CheckBanner
        status="cancelled"
        checkId="c1"
        sourceFailures={0}
        basePath="/r/abc"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Resume" }));

    await waitFor(() => expect(actions.resume).toHaveBeenCalled());
    expect(toasts.toast).not.toHaveBeenCalled();
  });
});

describe("CheckFailed", () => {
  it("shows the reason and tries again", () => {
    const onTryAgain = vi.fn(async (): Promise<ReportActionResult> => ({}));
    render(
      <CheckFailed
        reason="Couldn't reach the npm registry."
        onTryAgain={onTryAgain}
      />,
    );

    expect(screen.getByRole("alert")).toHaveTextContent(
      "We couldn't check this project.Couldn't reach the npm registry.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(onTryAgain).toHaveBeenCalled();
  });

  it("toasts the rate limit and enables Try again again", async () => {
    const message = "Too many checks. Try again in 40 minutes.";
    render(
      <CheckFailed
        reason="Couldn't reach the npm registry."
        onTryAgain={async () => ({ error: message })}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Try again" }));

    await waitFor(() =>
      expect(toasts.toast).toHaveBeenCalledWith({ title: message }),
    );
    expect(screen.getByRole("button", { name: "Try again" })).toBeEnabled();
  });
});

describe("checkFailureCopy", () => {
  it("counts minutes until a rate limit lifts, rounding up", () => {
    const now = new Date("2026-10-20T12:00:00Z");
    const retryAt = new Date(now.getTime() + 61_000);

    expect(checkFailureCopy["registry-rate-limited"](retryAt, now)).toBe(
      "npm is rate-limiting us. Try again in 2 minutes.",
    );
    expect(checkFailureCopy["registry-rate-limited"](null, now)).toBe(
      "npm is rate-limiting us. Try again in 1 minute.",
    );
  });
});
