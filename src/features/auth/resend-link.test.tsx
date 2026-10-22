import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ResendLink } from "./resend-link";
import type { SignInLinkAction, SignInLinkState } from "./sign-in-state";

beforeEach(() => {
  // Only the countdown's clock: React's own scheduling stays real.
  vi.useFakeTimers({ toFake: ["setInterval", "clearInterval"] });
});

afterEach(() => {
  vi.useRealTimers();
});

const tick = (seconds: number) =>
  act(() => {
    vi.advanceTimersByTime(seconds * 1000);
  });

const sent: SignInLinkAction = async (state): Promise<SignInLinkState> => ({
  attempt: state.attempt + 1,
  sent: true,
});

describe("ResendLink", () => {
  it("waits 60 seconds with a countdown", () => {
    render(
      <ResendLink action={sent} email="dev@example.com" next="/projects" />,
    );

    expect(
      screen.getByRole("button", { name: "Resend link (60s)" }),
    ).toBeDisabled();
    tick(18);
    expect(
      screen.getByRole("button", { name: "Resend link (42s)" }),
    ).toBeDisabled();
    tick(42);
    expect(screen.getByRole("button", { name: "Resend link" })).toBeEnabled();
  });

  it("resends with the email and next, then waits again", async () => {
    const action = vi.fn(sent);
    render(
      <ResendLink action={action} email="dev@example.com" next="/r/abc/save" />,
    );
    tick(60);

    fireEvent.click(screen.getByRole("button", { name: "Resend link" }));

    expect(await screen.findByText("We sent a new link.")).toBeVisible();
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("email")).toBe("dev@example.com");
    expect(formData?.get("next")).toBe("/r/abc/save");
    expect(formData?.get("intent")).toBe("resend");
    expect(
      screen.getByRole("button", { name: "Resend link (60s)" }),
    ).toBeDisabled();
  });

  it("shows an error and allows another try at once", async () => {
    const action: SignInLinkAction = async (state) => ({
      attempt: state.attempt + 1,
      error: "Couldn't send the link. Try again.",
    });
    render(
      <ResendLink action={action} email="dev@example.com" next="/projects" />,
    );
    tick(60);

    fireEvent.click(screen.getByRole("button", { name: "Resend link" }));

    expect(
      await screen.findByText("Couldn't send the link. Try again."),
    ).toBeVisible();
    expect(screen.getByRole("button", { name: "Resend link" })).toBeEnabled();
  });
});
