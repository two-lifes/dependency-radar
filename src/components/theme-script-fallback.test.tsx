import { render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { themeScript } from "@/lib/theme";
import { ThemeScriptFallback } from "./theme-script-fallback";

// jsdom would run an inserted <script> in its own context, which has no
// matchMedia and can't be stubbed from here, so the insert is intercepted.
// The script itself is covered by theme.test.ts; the real page by e2e.
let append: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  append = vi.spyOn(document.head, "append").mockImplementation(() => {});
});

afterEach(() => {
  document.documentElement.style.colorScheme = "";
  vi.restoreAllMocks();
});

describe("ThemeScriptFallback", () => {
  it("does nothing when the <head> script already ran", () => {
    document.documentElement.style.colorScheme = "light";
    render(<ThemeScriptFallback />);
    expect(append).not.toHaveBeenCalled();
  });

  it("inserts the theme script when the <head> one didn't run", () => {
    render(<ThemeScriptFallback />);
    expect(append).toHaveBeenCalledOnce();
    const [script] = append.mock.calls[0] ?? [];
    expect(script).toBeInstanceOf(HTMLScriptElement);
    expect((script as HTMLScriptElement).textContent).toBe(themeScript);
  });
});
