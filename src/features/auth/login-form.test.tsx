import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LoginForm } from "./login-form";
import type { SignInLinkAction, SignInLinkState } from "./sign-in-state";

const social = vi.hoisted(() => vi.fn());
vi.mock("./auth-client", () => ({
  authClient: { signIn: { social } },
}));

afterEach(() => {
  social.mockReset();
});

const emailField = () => screen.getByRole("textbox", { name: "Email" });
const submit = () =>
  fireEvent.click(screen.getByRole("button", { name: "Send sign-in link" }));

describe("LoginForm", () => {
  it("sends the email and next", async () => {
    const action = vi.fn<SignInLinkAction>(async (state) => state);
    render(<LoginForm action={action} next="/r/abc/save" />);

    fireEvent.change(emailField(), { target: { value: "dev@example.com" } });
    submit();

    await waitFor(() => expect(action).toHaveBeenCalledOnce());
    const formData = action.mock.calls[0]?.[1];
    expect(formData?.get("email")).toBe("dev@example.com");
    expect(formData?.get("next")).toBe("/r/abc/save");
  });

  it("shows an invalid email under the field and focuses it", async () => {
    const action = vi.fn<SignInLinkAction>(
      async (state): Promise<SignInLinkState> => ({
        attempt: state.attempt + 1,
        error: "Enter a valid email address.",
      }),
    );
    render(<LoginForm action={action} next="/projects" />);

    fireEvent.change(emailField(), { target: { value: "nope" } });
    submit();

    const error = await screen.findByText("Enter a valid email address.");
    expect(emailField()).toHaveAttribute("aria-invalid", "true");
    expect(emailField()).toHaveAttribute("aria-describedby", error.id);
    expect(emailField()).toHaveFocus();

    fireEvent.change(emailField(), { target: { value: "dev@example.com" } });
    expect(
      screen.queryByText("Enter a valid email address."),
    ).not.toBeInTheDocument();
  });

  it("shows a spinner and disables both ways in while sending", async () => {
    const action = vi.fn<SignInLinkAction>(() => new Promise(() => {}));
    render(<LoginForm action={action} next="/projects" />);

    fireEvent.change(emailField(), { target: { value: "dev@example.com" } });
    submit();

    expect(
      await screen.findByRole("button", { name: "Sending…" }),
    ).toBeDisabled();
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeDisabled();
  });

  it("asks to sign in to save a guest report", () => {
    render(<LoginForm action={vi.fn()} next="/r/abc/save" />);
    expect(screen.getByText("Sign in to save your report.")).toBeVisible();
  });

  it("has no save hint without a guest report", () => {
    render(<LoginForm action={vi.fn()} next="/projects" />);
    expect(
      screen.queryByText("Sign in to save your report."),
    ).not.toBeInTheDocument();
  });

  it.each([
    ["github", "GitHub sign-in was cancelled or failed. Try again."],
    ["link-expired", "This link has expired. Request a new one."],
  ] as const)("shows the %s error banner", (error, text) => {
    render(<LoginForm action={vi.fn()} next="/projects" error={error} />);
    expect(screen.getByRole("alert")).toHaveTextContent(text);
  });

  it("starts GitHub sign-in back to next, errors back to /login", async () => {
    social.mockReturnValue(new Promise(() => {}));
    render(<LoginForm action={vi.fn()} next="/r/abc/save" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    );

    expect(social).toHaveBeenCalledWith({
      provider: "github",
      callbackURL: "/r/abc/save",
      errorCallbackURL: "/login?reason=github&next=%2Fr%2Fabc%2Fsave",
    });
    expect(
      await screen.findByRole("button", { name: "Redirecting…" }),
    ).toBeDisabled();
  });

  it("shows the email form disabled and marked Coming soon when email sign-in is off", () => {
    render(
      <LoginForm action={vi.fn()} next="/projects" emailEnabled={false} />,
    );
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeEnabled();
    expect(screen.getByText("or")).toBeVisible();
    const field = screen.getByRole("textbox", { name: "Email" });
    expect(field).toBeDisabled();
    expect(field).toHaveAccessibleDescription(
      "Email sign-in is coming soon. Use GitHub for now.",
    );
    expect(
      screen.getByRole("button", { name: "Send sign-in link" }),
    ).toBeDisabled();
    expect(screen.getByText("Coming soon")).toBeVisible();
    expect(
      screen.queryByText("No passwords. We'll email you a magic link."),
    ).not.toBeInTheDocument();
  });

  it("shows the GitHub error when sign-in can't start", async () => {
    social.mockResolvedValue({ error: { message: "Provider not found" } });
    render(<LoginForm action={vi.fn()} next="/projects" />);

    fireEvent.click(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    );

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "GitHub sign-in was cancelled or failed. Try again.",
    );
    expect(
      screen.getByRole("button", { name: "Continue with GitHub" }),
    ).toBeEnabled();
  });
});
