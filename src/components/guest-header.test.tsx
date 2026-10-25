import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { GuestHeader } from "./guest-header";

describe("GuestHeader", () => {
  it("links home and to sign in without demo entry points", () => {
    render(<GuestHeader />);

    expect(
      screen.getByRole("link", { name: "Dependency Radar home" }),
    ).toHaveAttribute("href", "/");
    expect(
      screen.queryByRole("link", { name: "Try demo" }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      "/login?next=%2F",
    );
    expect(
      screen.queryByRole("button", { name: "Open menu" }),
    ).not.toBeInTheDocument();
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
