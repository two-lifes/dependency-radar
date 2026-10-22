import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { GithubSection } from "./github-section";

const auth = vi.hoisted(() => ({
  linkSocial: vi.fn<(options: unknown) => Promise<{ error: unknown }>>(),
}));
vi.mock("../auth/auth-client", () => ({ authClient: auth }));

describe("GithubSection", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the connected login", () => {
    render(<GithubSection connection={{ connected: true, login: "ada" }} />);
    expect(screen.getByText("Connected as @ada")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Connect GitHub" }),
    ).not.toBeInTheDocument();
  });

  it("still shows a connection when the login couldn't be read", () => {
    render(<GithubSection connection={{ connected: true }} />);
    expect(screen.getByText("Connected to GitHub")).toBeInTheDocument();
  });

  it("links GitHub, coming back to the profile either way", async () => {
    auth.linkSocial.mockResolvedValue({ error: null });
    render(<GithubSection connection={{ connected: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub" }));

    await waitFor(() =>
      expect(auth.linkSocial).toHaveBeenCalledWith({
        provider: "github",
        callbackURL: "/settings/profile",
        errorCallbackURL: "/settings/profile?reason=github-link",
      }),
    );
    expect(screen.getByRole("button", { name: "Redirecting…" })).toBeDisabled();
  });

  it("explains a failed link", async () => {
    auth.linkSocial.mockResolvedValue({ error: { status: 500 } });
    render(<GithubSection connection={{ connected: false }} />);
    fireEvent.click(screen.getByRole("button", { name: "Connect GitHub" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Couldn't connect GitHub.",
    );
    expect(
      screen.getByRole("button", { name: "Connect GitHub" }),
    ).toBeEnabled();
  });

  it("shows the error GitHub sent the user back with", () => {
    render(<GithubSection connection={{ connected: false }} linkFailed />);
    expect(screen.getByRole("alert")).toHaveTextContent(
      "It may already be connected to another account.",
    );
  });

  it("disables Connect GitHub in the demo and says why", () => {
    render(<GithubSection connection={{ connected: false }} demo />);
    const button = screen.getByRole("button", { name: "Connect GitHub" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Not available in the demo.");
  });
});
