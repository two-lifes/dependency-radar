import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  packageManagerStorageKey,
  usePackageManager,
} from "./package-manager-preference";

afterEach(() => {
  vi.restoreAllMocks();
  window.localStorage.clear();
});

describe("usePackageManager", () => {
  it("starts from the detected manager", () => {
    const { result } = renderHook(() => usePackageManager("r1", "yarn"));
    expect(result.current[0]).toBe("yarn");
  });

  it("remembers the pick for this report only", () => {
    const first = renderHook(() => usePackageManager("r1", "npm"));
    act(() => first.result.current[1]("pnpm"));
    expect(first.result.current[0]).toBe("pnpm");
    expect(window.localStorage.getItem(packageManagerStorageKey("r1"))).toBe(
      "pnpm",
    );
    first.unmount();

    const again = renderHook(() => usePackageManager("r1", "npm"));
    expect(again.result.current[0]).toBe("pnpm");
    const other = renderHook(() => usePackageManager("r2", "npm"));
    expect(other.result.current[0]).toBe("npm");
  });

  it("updates every user of the same report together", () => {
    const bar = renderHook(() => usePackageManager("r1", "npm"));
    const card = renderHook(() => usePackageManager("r1", "npm"));
    act(() => bar.result.current[1]("yarn"));
    expect(card.result.current[0]).toBe("yarn");
  });

  it("ignores an unknown stored value", () => {
    window.localStorage.setItem(packageManagerStorageKey("r1"), "bun");
    const { result } = renderHook(() => usePackageManager("r1", "pnpm"));
    expect(result.current[0]).toBe("pnpm");
  });

  it("follows a pick made in another tab", () => {
    const { result } = renderHook(() => usePackageManager("r1", "npm"));
    const key = packageManagerStorageKey("r1");
    act(() => {
      window.localStorage.setItem(key, "yarn");
      window.dispatchEvent(new StorageEvent("storage", { key }));
    });
    expect(result.current[0]).toBe("yarn");
  });

  it("still switches when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("SecurityError");
    });
    const { result } = renderHook(() => usePackageManager("blocked", "npm"));
    expect(result.current[0]).toBe("npm");
    act(() => result.current[1]("pnpm"));
    expect(result.current[0]).toBe("pnpm");
  });
});
