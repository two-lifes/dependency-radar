import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { DemoBanner } from "./demo-banner";

afterEach(() => {
  document.cookie = "demo-banner=; path=/; max-age=0";
});

describe("DemoBanner", () => {
  it("explains the demo and offers an account", () => {
    render(<DemoBanner />);
    expect(
      screen.getByRole("region", { name: "Demo notice" }),
    ).toHaveTextContent("You're exploring a demo. Data resets daily.");
    expect(
      screen.getByRole("link", { name: "Create free account" }),
    ).toHaveAttribute("href", "/login");
  });

  it("hides on dismiss and remembers it for the session", () => {
    render(<DemoBanner />);
    fireEvent.click(
      screen.getByRole("button", { name: "Dismiss demo notice" }),
    );

    expect(screen.queryByRole("region")).not.toBeInTheDocument();
    // A session cookie: no expiry, so it dies with the browser session.
    expect(document.cookie).toContain("demo-banner=dismissed");
  });
});
