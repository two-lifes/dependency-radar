import { render, screen } from "@testing-library/react";
import Link from "next/link";
import { describe, expect, it } from "vitest";
import { Button } from "./button";

describe("Button", () => {
  it("defaults to a primary, 36px, non-submitting button", () => {
    render(<Button>Save</Button>);
    const button = screen.getByRole("button", { name: "Save" });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("bg-primary", "h-9");
  });

  it.each([
    ["secondary", "bg-card"],
    ["ghost", "bg-transparent"],
    ["destructive", "text-danger"],
  ] as const)("applies the %s variant", (variant, expected) => {
    render(<Button variant={variant}>Go</Button>);
    expect(screen.getByRole("button")).toHaveClass(expected);
  });

  it("applies sizes and lets className override them", () => {
    render(
      <Button size="lg" className="h-12">
        Big
      </Button>,
    );
    const button = screen.getByRole("button");
    expect(button).toHaveClass("h-12");
    expect(button).not.toHaveClass("h-11");
  });

  it("keeps an explicit submit type", () => {
    render(<Button type="submit">Send</Button>);
    expect(screen.getByRole("button")).toHaveAttribute("type", "submit");
  });

  it("renders its child with button styles when asChild is set", () => {
    render(
      <Button asChild variant="secondary">
        <Link href="/">Home</Link>
      </Button>,
    );
    const link = screen.getByRole("link", { name: "Home" });
    expect(link).toHaveClass("bg-card");
    expect(link).not.toHaveAttribute("type");
  });

  it("is disabled", () => {
    render(<Button disabled>Wait</Button>);
    expect(screen.getByRole("button")).toBeDisabled();
  });
});
