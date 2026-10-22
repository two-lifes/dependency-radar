import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY } from "@/lib/theme";
import { ThemeSection } from "./theme-section";

const option = (name: string) => screen.getByRole("radio", { name });

describe("ThemeSection", () => {
  afterEach(() => {
    window.localStorage.clear();
    document.documentElement.classList.remove("dark");
    vi.unstubAllGlobals();
  });

  it("starts from the stored choice", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    render(<ThemeSection />);
    expect(option("Dark")).toHaveAttribute("aria-checked", "true");
  });

  it("applies and remembers a new choice at once", () => {
    vi.stubGlobal("matchMedia", () => ({ matches: false }));
    render(<ThemeSection />);
    expect(option("System")).toHaveAttribute("aria-checked", "true");

    fireEvent.click(option("Dark"));
    expect(option("Dark")).toHaveAttribute("aria-checked", "true");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("dark");
    expect(document.documentElement).toHaveClass("dark");

    fireEvent.click(option("System"));
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBeNull();
    expect(document.documentElement).not.toHaveClass("dark");
  });
});
