import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppHeader, initials } from "./app-header";

const signOut = vi.hoisted(() => vi.fn());
const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn() }));
vi.mock("@/features/auth/auth-client", () => ({ authClient: { signOut } }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

const user = { name: "Ada Lovelace", email: "ada@example.com", image: null };

// Radix DropdownMenu opens on pointerdown or the keyboard, not click.
const openMenu = () =>
  fireEvent.keyDown(screen.getByRole("button", { name: "Account menu" }), {
    key: "Enter",
  });

afterEach(() => {
  window.localStorage.clear();
  document.documentElement.className = "";
  document.documentElement.style.colorScheme = "";
  vi.unstubAllGlobals();
  signOut.mockReset();
  router.push.mockReset();
});

describe("AppHeader", () => {
  it("links the logo to projects and shows initials without a picture", () => {
    render(<AppHeader user={user} />);
    expect(
      screen.getByRole("link", { name: "Dependency Radar projects" }),
    ).toHaveAttribute("href", "/projects");
    expect(screen.getByText("AL")).toBeInTheDocument();
  });

  it("has Settings, Theme and Sign out in the menu", () => {
    render(<AppHeader user={user} />);
    openMenu();

    expect(screen.getByRole("menuitem", { name: "Settings" })).toHaveAttribute(
      "href",
      "/settings/profile",
    );
    expect(
      screen.getAllByRole("menuitemradio").map((item) => item.textContent),
    ).toEqual(["Light", "Dark", "System"]);
    expect(
      screen.getByRole("menuitemradio", { name: "System" }),
    ).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitem", { name: "Sign out" })).toBeVisible();
  });

  it("shows the stored theme as checked", () => {
    window.localStorage.setItem("theme", "light");
    render(<AppHeader user={user} />);
    openMenu();
    expect(
      screen.getByRole("menuitemradio", { name: "Light" }),
    ).toHaveAttribute("aria-checked", "true");
  });

  it("applies the chosen theme", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    render(<AppHeader user={user} />);
    openMenu();

    fireEvent.click(screen.getByRole("menuitemradio", { name: "Dark" }));

    expect(document.documentElement).toHaveClass("dark");
    expect(window.localStorage.getItem("theme")).toBe("dark");
  });

  it("signs out and goes home", async () => {
    signOut.mockResolvedValue({});
    render(<AppHeader user={user} />);
    openMenu();

    fireEvent.click(screen.getByRole("menuitem", { name: "Sign out" }));

    await vi.waitFor(() => expect(router.push).toHaveBeenCalledWith("/"));
    expect(signOut).toHaveBeenCalledOnce();
  });
});

describe("initials", () => {
  it.each([
    [{ name: "Ada Lovelace", email: "a@x.io" }, "AL"],
    [{ name: "ada", email: "a@x.io" }, "A"],
    [{ name: "Ada King Lovelace", email: "a@x.io" }, "AK"],
    [{ name: "  ", email: "zoe@x.io" }, "Z"],
  ])("%j → %s", (input, expected) => {
    expect(initials(input)).toBe(expected);
  });
});
