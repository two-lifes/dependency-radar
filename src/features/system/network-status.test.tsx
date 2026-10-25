import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useOnlineStatus } from "@/lib/use-online-status";
import { CheckForm } from "../landing/check-form";
import type { CheckFormAction } from "../landing/check-form-state";
import { LoginForm } from "../auth/login-form";
import { NetworkButton, OfflineBanner } from "./network-status";
import { networkCopy } from "./network-copy";

function connect(online: boolean) {
  vi.spyOn(navigator, "onLine", "get").mockReturnValue(online);
  act(() => window.dispatchEvent(new Event(online ? "online" : "offline")));
}

afterEach(() => vi.restoreAllMocks());

describe("connection status", () => {
  it("reads initial offline status and follows reconnects", () => {
    connect(false);
    const { result } = renderHook(useOnlineStatus);
    expect(result.current).toBe(false);
    connect(true);
    expect(result.current).toBe(true);
    connect(false);
    expect(result.current).toBe(false);
  });

  it("uses the same online snapshot for server rendering and initial hydration", () => {
    connect(false);
    expect(renderToString(<OfflineBanner />)).toBe("");
    render(<OfflineBanner />);
    expect(screen.getByRole("status")).toHaveTextContent(networkCopy.offline);
    connect(true);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("disables and explains network actions without invoking slotted link handlers", () => {
    const onClick = vi.fn();
    render(
      <>
        <NetworkButton onClick={onClick}>Save</NetworkButton>
        <NetworkButton asChild>
          <a href="/login" onClick={onClick}>
            Sign in
          </a>
        </NetworkButton>
      </>,
    );
    connect(false);
    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute(
      "aria-description",
      networkCopy.required,
    );
    fireEvent.click(screen.getByRole("link"));
    expect(onClick).not.toHaveBeenCalled();
    connect(true);
    fireEvent.click(screen.getByRole("button"));
    expect(onClick).toHaveBeenCalledOnce();
  });
});

describe("forms across disconnects", () => {
  it("keeps local editing and sample available but blocks submit, including direct form submission", async () => {
    const action = vi.fn<CheckFormAction>(async (state) => state);
    render(<CheckForm action={action} />);
    connect(false);
    fireEvent.click(
      screen.getByRole("button", { name: "or try a sample project" }),
    );
    const field = screen.getByRole("textbox", {
      name: "package.json contents",
    });
    expect(field).not.toHaveValue("");
    fireEvent.change(field, {
      target: { value: '{"dependencies":{"react":"19.0.0"}}' },
    });
    fireEvent.submit(screen.getByRole("form"));
    expect(action).not.toHaveBeenCalled();
    connect(true);
    expect(action).not.toHaveBeenCalled();
    expect(field).toHaveValue('{"dependencies":{"react":"19.0.0"}}');
    fireEvent.click(screen.getByRole("button", { name: "Check dependencies" }));
    await waitFor(() => expect(action).toHaveBeenCalledOnce());
  });

  it("keeps a rejected submission recoverable and retries only on request", async () => {
    const action = vi
      .fn<CheckFormAction>()
      .mockRejectedValueOnce(new Error("network"))
      .mockImplementation(async (state) => state);
    render(<CheckForm action={action} />);
    fireEvent.click(
      screen.getByRole("button", { name: "or try a sample project" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Check dependencies" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      networkCopy.failed,
    );
    connect(false);
    expect(screen.getByRole("button", { name: "Retry" })).toBeDisabled();
    connect(true);
    expect(action).toHaveBeenCalledOnce();
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    await waitFor(() => expect(action).toHaveBeenCalledTimes(2));
    expect(action.mock.calls[1]?.[1].get("packageJson")).toBe(
      action.mock.calls[0]?.[1].get("packageJson"),
    );
    await waitFor(() =>
      expect(screen.queryByRole("alert")).not.toBeInTheDocument(),
    );
  });

  it("blocks email form submission offline without erasing the address", () => {
    const action = vi.fn();
    const { container } = render(
      <LoginForm action={action} next="/projects" />,
    );
    const field = screen.getByRole("textbox");
    fireEvent.change(field, { target: { value: "user@example.com" } });
    connect(false);
    const form = container.querySelector("form");
    if (!form) throw new Error("No login form");
    fireEvent.submit(form);
    expect(action).not.toHaveBeenCalled();
    expect(field).toHaveValue("user@example.com");
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeDisabled();
  });
});
