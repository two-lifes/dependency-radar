import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  GuestGithubButton,
  GuestQuotaNotice,
  GuestQuotaProvider,
} from "./guest-quota";
import { CheckForm } from "../landing/check-form";
const mocked = vi.hoisted(() => ({ refresh: vi.fn(), social: vi.fn() }));
vi.mock("./actions", () => ({ refreshGuestQuota: mocked.refresh }));
vi.mock("../auth/auth-client", () => ({
  authClient: { signIn: { social: mocked.social } },
}));
beforeEach(() => {
  vi.clearAllMocks();
  window.history.replaceState(null, "", "/");
});
describe("guest quota UI", () => {
  it.each([3, 2, 1])("shows %s remaining", (remaining) => {
    render(
      <GuestQuotaProvider initial={{ kind: "guest", remaining }}>
        <GuestQuotaNotice />
      </GuestQuotaProvider>,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      `${remaining} guest check${remaining === 1 ? "" : "s"} remaining`,
    );
  });
  it("replaces launch at zero while allowing sample to populate input for free", () => {
    const action = vi.fn();
    render(
      <GuestQuotaProvider initial={{ kind: "guest", remaining: 0 }}>
        <CheckForm action={action} />
      </GuestQuotaProvider>,
    );
    expect(
      screen.getByText("You've used all 3 guest checks in this browser."),
    ).toBeVisible();
    expect(
      screen.queryByRole("button", { name: "Check dependencies" }),
    ).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeVisible();
    fireEvent.click(
      screen.getByRole("button", { name: "or try a sample project" }),
    );
    expect(screen.getByRole("textbox")).not.toHaveValue("");
    expect(action).not.toHaveBeenCalled();
  });
  it("updates stale UI on refusal and clears it after sign-in in another tab", async () => {
    const action = vi.fn(async () => ({
      attempt: 1,
      code: "guest-quota-exhausted" as const,
      remaining: 0 as const,
    }));
    render(
      <GuestQuotaProvider initial={{ kind: "guest", remaining: 1 }}>
        <CheckForm action={action} />
      </GuestQuotaProvider>,
    );
    fireEvent.submit(screen.getByRole("form"));
    expect(
      await screen.findByRole("button", { name: "Continue with GitHub" }),
    ).toBeVisible();
    mocked.refresh.mockResolvedValue({ kind: "account" });
    fireEvent.focus(window);
    expect(
      await screen.findByRole("button", { name: "Check dependencies" }),
    ).toBeVisible();
    expect(
      screen.queryByText("You've used all 3 guest checks in this browser."),
    ).not.toBeInTheDocument();
  });
  it("fails closed on read error and retries", async () => {
    mocked.refresh.mockResolvedValue({ kind: "guest", remaining: 2 });
    render(
      <GuestQuotaProvider initial={{ kind: "error" }}>
        <CheckForm action={vi.fn()} />
      </GuestQuotaProvider>,
    );
    expect(
      screen.getByRole("button", { name: "Check dependencies" }),
    ).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(await screen.findByText("2 guest checks remaining")).toBeVisible();
  });
  it("refreshes on focus and hides the count after sign-in", async () => {
    mocked.refresh.mockResolvedValue({ kind: "account" });
    render(
      <GuestQuotaProvider initial={{ kind: "guest", remaining: 1 }}>
        <GuestQuotaNotice />
      </GuestQuotaProvider>,
    );
    fireEvent.focus(window);
    await waitFor(() =>
      expect(screen.queryByRole("status")).not.toBeInTheDocument(),
    );
  });
  it("starts OAuth with the current query and handles a rejected login", async () => {
    window.history.replaceState(
      null,
      "",
      "/r/test/dependencies?q=react&pkg=react",
    );
    mocked.social.mockResolvedValue({ error: true });
    render(<GuestGithubButton />);
    fireEvent.click(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    );
    expect(mocked.social).toHaveBeenCalledWith(
      expect.objectContaining({
        callbackURL: "/r/test/dependencies?q=react&pkg=react",
        errorCallbackURL: expect.stringContaining("next="),
      }),
    );
    expect(await screen.findByRole("alert")).toBeVisible();
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeEnabled();
  });
});
