import { describe, expect, it } from "vitest";
import { analyzePackage } from "./analyze-package";
import type { ManifestDependency } from "./parse-manifest";
import type { RegistryPackage } from "./registry-package";

const now = new Date("2026-10-19T12:00:00.000Z");

const react: RegistryPackage = {
  versions: { "18.2.0": {}, "18.3.1": {}, "19.0.0": {}, "19.1.0": {} },
  distTags: { latest: "19.1.0" },
  time: { "19.1.0": "2026-04-01T00:00:00.000Z" },
};

const dep = (specifier: string, name = "react"): ManifestDependency => ({
  name,
  specifier,
  type: "prod",
});

describe("analyzePackage", () => {
  it("analyzes a registry range", () => {
    expect(
      analyzePackage({ dependency: dep("^18.2.0"), registry: react, now }),
    ).toEqual({
      checked: true,
      registryName: "react",
      current: "18.3.1",
      latest: "19.1.0",
      lag: { kind: "major", majors: 1 },
      status: "active",
      lastReleaseAt: "2026-04-01T00:00:00.000Z",
    });
  });

  it("uses the locked version", () => {
    const result = analyzePackage({
      dependency: dep("^18.2.0"),
      locked: { version: "18.2.0" },
      registry: react,
      now,
    });
    expect(result.checked && result.current).toBe("18.2.0");
  });

  it("checks an npm: alias under the real name", () => {
    const result = analyzePackage({
      dependency: dep("npm:react@^19.0.0", "react19"),
      locked: { version: "19.0.0", realName: "react" },
      registry: react,
      now,
    });

    expect(result).toMatchObject({
      checked: true,
      registryName: "react",
      current: "19.0.0",
      lag: { kind: "minor" },
    });
  });

  it.each(["github:facebook/react", "file:../react", "workspace:*"])(
    "does not check %s",
    (specifier) => {
      expect(
        analyzePackage({ dependency: dep(specifier), registry: react, now }),
      ).toEqual({ checked: false, reason: "not-from-registry" });
    },
  );

  it("does not check an invalid specifier", () => {
    expect(
      analyzePackage({ dependency: dep("^^1 !!"), registry: react, now }),
    ).toEqual({ checked: false, reason: "invalid-specifier" });
  });

  it("passes on resolution failures", () => {
    expect(
      analyzePackage({ dependency: dep("^20"), registry: react, now }),
    ).toEqual({ checked: false, reason: "no-matching-version" });
  });

  it("does not check a package without stable versions", () => {
    const registry: RegistryPackage = {
      versions: { "0.0.0-canary.1": {} },
      distTags: { latest: "0.0.0-canary.1" },
      time: {},
    };
    expect(
      analyzePackage({ dependency: dep("latest"), registry, now }),
    ).toEqual({ checked: false, reason: "no-stable-version" });
  });
});
