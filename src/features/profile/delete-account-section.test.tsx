import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DeleteAccountSection } from "./delete-account-section";

const actions = vi.hoisted(() => ({
  deleteAccount:
    vi.fn<
      (email: string) => Promise<{ error?: "mismatch" | "reauth" | "failed" }>
    >(),
  updateName: vi.fn(),
}));
vi.mock("./actions", () => actions);
const router = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));
const auth = vi.hoisted(() => ({ signOut: vi.fn(async () => ({})) }));
vi.mock("../auth/auth-client", () => ({ authClient: auth }));

const EMAIL = "ada@example.com";

function openDialog() {
  render(<DeleteAccountSection email={EMAIL} />);
  fireEvent.click(screen.getByRole("button", { name: "Delete account" }));
}
const typeEmail = (value: string) =>
  fireEvent.change(
    screen.getByRole("textbox", { name: `Type ${EMAIL} to confirm` }),
    { target: { value } },
  );
const confirmButton = () =>
  screen.getByRole("button", { name: "Delete account" });

describe("DeleteAccountSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    actions.deleteAccount.mockResolvedValue({});
  });

  it("deletes only once the email is typed in", async () => {
    openDialog();
    expect(confirmButton()).toBeDisabled();
    typeEmail("ada@example");
    expect(confirmButton()).toBeDisabled();
    typeEmail("ADA@example.com");
    expect(confirmButton()).toBeEnabled();

    fireEvent.click(confirmButton());
    await waitFor(() =>
      expect(actions.deleteAccount).toHaveBeenCalledWith("ADA@example.com"),
    );
  });

  it("asks to sign in again after a stale session, signing out first", async () => {
    actions.deleteAccount.mockResolvedValue({ error: "reauth" });
    openDialog();
    typeEmail(EMAIL);
    fireEvent.click(confirmButton());

    expect(
      await screen.findByText(
        "For security, sign in again to delete your account.",
      ),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sign in again" }));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(
        "/login?next=%2Fsettings%2Fprofile",
      ),
    );
    expect(auth.signOut).toHaveBeenCalled();
  });

  it("shows a failure without closing the dialog", async () => {
    actions.deleteAccount.mockResolvedValue({ error: "failed" });
    openDialog();
    typeEmail(EMAIL);
    fireEvent.click(confirmButton());
    expect(
      await screen.findByText("Couldn't delete the account. Try again."),
    ).toBeInTheDocument();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("disables deleting the demo account and says why", () => {
    render(<DeleteAccountSection email={EMAIL} demo />);
    const button = screen.getByRole("button", { name: "Delete account" });
    expect(button).toBeDisabled();
    expect(button).toHaveAccessibleDescription("Not available in the demo.");
  });
});
