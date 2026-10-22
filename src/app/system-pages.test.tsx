import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import ErrorPage from "./error";
import NotFound from "./not-found";

const getOptionalSession = vi.hoisted(() => vi.fn());
vi.mock("@/server/auth/session", () => ({ getOptionalSession }));

describe("404 page", () => {
  it("links a signed-in user to projects", async () => {
    getOptionalSession.mockResolvedValue({ user: { id: "u1" } });
    render(await NotFound());
    expect(
      screen.getByRole("link", { name: "Go to projects" }),
    ).toHaveAttribute("href", "/projects");
    expect(
      screen.queryByRole("link", { name: "Go home" }),
    ).not.toBeInTheDocument();
  });

  it("explains and links a guest home", async () => {
    getOptionalSession.mockResolvedValue(null);
    render(await NotFound());
    expect(
      screen.getByRole("heading", { level: 1, name: "Page not found" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        "The page you're looking for doesn't exist or you don't have access.",
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});

describe("error boundary", () => {
  it("retries the segment and links home", () => {
    const retry = vi.fn();
    render(<ErrorPage retry={retry} />);
    expect(
      screen.getByRole("heading", { level: 1, name: "Something went wrong" }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(retry).toHaveBeenCalledOnce();
    expect(screen.getByRole("link", { name: "Go home" })).toHaveAttribute(
      "href",
      "/",
    );
  });
});
