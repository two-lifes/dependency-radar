import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  TOAST_DURATION_MS,
  TOAST_WITH_ACTION_DURATION_MS,
  Toaster,
  dismissToast,
  toast,
} from "./toast";

const shown: number[] = [];

function show(options: Parameters<typeof toast>[0]) {
  act(() => {
    shown.push(toast(options));
  });
}

afterEach(() => {
  act(() => {
    for (const id of shown.splice(0)) dismissToast(id);
  });
  vi.useRealTimers();
});

describe("toast", () => {
  it("announces the message in a notification region", async () => {
    render(<Toaster />);
    show({ title: "Link copied" });
    expect(await screen.findByText("Link copied")).toBeInTheDocument();
    expect(screen.getByRole("region")).toBeInTheDocument();
  });

  it("runs the action callback", async () => {
    const onUndo = vi.fn();
    render(<Toaster />);
    show({
      title: "Package snoozed",
      action: { label: "Undo", onClick: onUndo },
    });
    fireEvent.click(await screen.findByRole("button", { name: "Undo" }));
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("hides after 5 s, or 8 s when it has an action", () => {
    vi.useFakeTimers();
    render(<Toaster />);
    show({ title: "Project saved" });
    show({
      title: "Package snoozed",
      action: { label: "Undo", onClick: () => {} },
    });

    act(() => vi.advanceTimersByTime(TOAST_DURATION_MS + 100));
    expect(screen.queryByText("Project saved")).not.toBeInTheDocument();
    expect(screen.getByText("Package snoozed")).toBeInTheDocument();

    act(() =>
      vi.advanceTimersByTime(TOAST_WITH_ACTION_DURATION_MS - TOAST_DURATION_MS),
    );
    expect(screen.queryByText("Package snoozed")).not.toBeInTheDocument();
  });
});
