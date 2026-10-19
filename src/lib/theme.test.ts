import { afterEach, describe, expect, it, vi } from "vitest";
import { THEME_STORAGE_KEY, themeScript } from "./theme";

type MediaListener = () => void;

function mockSystemTheme(prefersDark: boolean) {
  const listeners: MediaListener[] = [];
  const media = {
    matches: prefersDark,
    addEventListener: (_type: "change", listener: MediaListener) => {
      listeners.push(listener);
    },
  };
  vi.stubGlobal("matchMedia", () => media);
  return {
    change(nextPrefersDark: boolean) {
      media.matches = nextPrefersDark;
      listeners.forEach((listener) => listener());
    },
  };
}

// Executes the exact string that is inlined into <head>.
function runThemeScript() {
  new Function(themeScript)();
}

const root = () => document.documentElement;

afterEach(() => {
  root().className = "";
  root().style.colorScheme = "";
  window.localStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("themeScript", () => {
  it("uses the system theme when nothing is stored (dark system)", () => {
    mockSystemTheme(true);
    runThemeScript();
    expect(root()).toHaveClass("dark");
    expect(root().style.colorScheme).toBe("dark");
  });

  it("uses the system theme when nothing is stored (light system)", () => {
    mockSystemTheme(false);
    runThemeScript();
    expect(root()).not.toHaveClass("dark");
    expect(root().style.colorScheme).toBe("light");
  });

  it("explicit light wins over a dark system", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    mockSystemTheme(true);
    runThemeScript();
    expect(root()).not.toHaveClass("dark");
  });

  it("explicit dark wins over a light system", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "dark");
    mockSystemTheme(false);
    runThemeScript();
    expect(root()).toHaveClass("dark");
  });

  it("treats an unknown stored value as system", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "sepia");
    mockSystemTheme(true);
    runThemeScript();
    expect(root()).toHaveClass("dark");
  });

  it("falls back to system when storage throws", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    mockSystemTheme(true);
    expect(runThemeScript).not.toThrow();
    expect(root()).toHaveClass("dark");
  });

  it("follows system changes while the preference is system", () => {
    const system = mockSystemTheme(false);
    runThemeScript();
    system.change(true);
    expect(root()).toHaveClass("dark");
    system.change(false);
    expect(root()).not.toHaveClass("dark");
  });

  it("ignores system changes when a theme is chosen explicitly", () => {
    window.localStorage.setItem(THEME_STORAGE_KEY, "light");
    const system = mockSystemTheme(false);
    runThemeScript();
    system.change(true);
    expect(root()).not.toHaveClass("dark");
  });
});
