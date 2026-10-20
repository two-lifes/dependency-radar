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
});
