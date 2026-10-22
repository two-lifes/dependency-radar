import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GuestHeader } from "./guest-header";

describe("GuestHeader", () => {
  it("links home, to the demo and to sign in", () => {
    render(<GuestHeader />);

    expect(
      screen.getByRole("link", { name: "Dependency Radar home" }),
    ).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Try demo" })).toHaveAttribute(
      "href",
      "/demo",
    );
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login",
    );
    expect(
      screen.getByRole("button", { name: "Open menu" }),
    ).toBeInTheDocument();
  });

  it("shows Dashboard instead of the guest actions once signed in", () => {
    render(<GuestHeader signedIn />);

    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute(
      "href",
      "/projects",
    );
    expect(
      screen.queryByRole("link", { name: "Sign in" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: "Try demo" }),
    ).not.toBeInTheDocument();
  });
});
