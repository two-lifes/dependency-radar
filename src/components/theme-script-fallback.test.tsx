import { render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { themeScript } from "@/lib/theme";
import { ThemeScriptFallback } from "./theme-script-fallback";

const themeScripts = () =>
  [...document.head.querySelectorAll("script")].filter(
    (script) => script.textContent === themeScript,
  );

afterEach(() => {
  document.documentElement.style.colorScheme = "";
  themeScripts().forEach((script) => script.remove());
});

describe("ThemeScriptFallback", () => {
  it("does nothing when the <head> script already ran", () => {
    document.documentElement.style.colorScheme = "dark";
    render(<ThemeScriptFallback />);
    expect(themeScripts()).toHaveLength(0);
  });

  it("runs the theme script when the <head> one didn't", () => {
    render(<ThemeScriptFallback />);
    expect(themeScripts()).toHaveLength(1);
  });
});
