import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Input } from "./input";
import { Textarea } from "./textarea";

describe("Input", () => {
  it("is labelled and marks errors with aria-invalid", () => {
    render(
      <>
        <label htmlFor="url">Repository URL</label>
        <Input id="url" aria-invalid aria-describedby="url-error" />
        <p id="url-error">Repository not found or private.</p>
      </>,
    );
    const input = screen.getByRole("textbox", { name: "Repository URL" });
    expect(input).toHaveAttribute("type", "text");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(
      "Repository not found or private.",
    );
    expect(input).toHaveClass("aria-invalid:border-danger", "h-9");
  });
});

describe("Textarea", () => {
  it("is labelled and shares the field styles", () => {
    render(
      <>
        <label htmlFor="json">package.json</label>
        <Textarea id="json" />
      </>,
    );
    const textarea = screen.getByRole("textbox", { name: "package.json" });
    expect(textarea.tagName).toBe("TEXTAREA");
    expect(textarea).toHaveClass("border-input", "aria-invalid:border-danger");
  });
});
