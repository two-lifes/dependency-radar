import { describe, expect, it } from "vitest";
import type { RegistryPackage } from "./registry-package";
import { resolveCurrent, resolveLatest } from "./resolve-versions";

const registry = (
  versions: string[],
  distTags: Record<string, string> = {},
): RegistryPackage => ({
  versions: Object.fromEntries(versions.map((version) => [version, {}])),
  distTags,
  time: {},
});

describe("resolveLatest", () => {
  it("uses the latest tag", () => {
    expect(
      resolveLatest(registry(["1.0.0", "1.1.0", "2.0.0"], { latest: "1.1.0" })),
    ).toBe("1.1.0");
  });

  it("falls back to the highest stable version when latest is a prerelease", () => {
    expect(
      resolveLatest(
        registry(["1.0.0", "1.2.0", "2.0.0-beta.1"], {
          latest: "2.0.0-beta.1",
        }),
      ),
    ).toBe("1.2.0");
  });

  it("falls back to the highest stable version when latest is missing", () => {
    expect(resolveLatest(registry(["1.0.0", "1.3.0", "1.2.0"]))).toBe("1.3.0");
  });

  it("falls back when latest points to an unpublished version", () => {
    expect(resolveLatest(registry(["1.0.0"], { latest: "1.5.0" }))).toBe(
      "1.0.0",
    );
  });

  it("returns undefined when there are only prereleases", () => {
    expect(
      resolveLatest(
        registry(["1.0.0-alpha", "1.0.0-beta"], { latest: "1.0.0-beta" }),
      ),
    ).toBeUndefined();
  });
});

describe("resolveCurrent", () => {
  const pkg = registry(["1.0.0", "1.2.0", "1.4.0", "2.0.0", "3.0.0-rc.1"], {
    latest: "2.0.0",
    next: "3.0.0-rc.1",
  });

  it("prefers the locked version, even outside the range", () => {
    expect(
      resolveCurrent({ kind: "range", range: "^2" }, { version: "1.2.0" }, pkg),
    ).toEqual({ ok: true, value: "1.2.0" });
  });

  it("falls back to the range when the locked version is not semver", () => {
    expect(
      resolveCurrent({ kind: "range", range: "^1" }, { version: "abc" }, pkg),
    ).toEqual({ ok: true, value: "1.4.0" });
  });

  it("takes the highest version satisfying the range", () => {
    expect(
      resolveCurrent({ kind: "range", range: "~1.2" }, undefined, pkg),
    ).toEqual({ ok: true, value: "1.2.0" });
  });

  it("ignores prereleases for a plain range", () => {
    expect(
      resolveCurrent({ kind: "range", range: "*" }, undefined, pkg),
    ).toEqual({ ok: true, value: "2.0.0" });
  });

  it("reports a range nothing satisfies", () => {
    expect(
      resolveCurrent({ kind: "range", range: "^9" }, undefined, pkg),
    ).toEqual({ ok: false, error: "no-matching-version" });
  });

  it("resolves a tag to its version", () => {
    expect(
      resolveCurrent({ kind: "tag", tag: "next" }, undefined, pkg),
    ).toEqual({ ok: true, value: "3.0.0-rc.1" });
  });

  it("reports an unknown tag", () => {
    expect(
      resolveCurrent({ kind: "tag", tag: "beta" }, undefined, pkg),
    ).toEqual({ ok: false, error: "unknown-tag" });
  });
});
