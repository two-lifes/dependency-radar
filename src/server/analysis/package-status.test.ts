import { describe, expect, it } from "vitest";
import { packageStatus } from "./package-status";
import type { RegistryPackage } from "./registry-package";

const now = new Date("2026-10-19T12:00:00.000Z");

const registry = (
  versions: RegistryPackage["versions"],
  time: Record<string, string>,
): RegistryPackage => ({ versions, distTags: {}, time });

describe("packageStatus", () => {
  it("is active with a recent release", () => {
    const pkg = registry(
      { "1.0.0": {}, "1.1.0": {} },
      {
        created: "2020-01-01T00:00:00.000Z",
        modified: "2026-10-01T00:00:00.000Z",
        "1.0.0": "2020-01-01T00:00:00.000Z",
        "1.1.0": "2026-03-01T00:00:00.000Z",
      },
    );

    expect(packageStatus(pkg, "1.1.0", now)).toEqual({
      status: "active",
      lastReleaseAt: "2026-03-01T00:00:00.000Z",
    });
  });

  it("counts a prerelease or backport as the last release", () => {
    const pkg = registry(
      { "2.0.0": {}, "1.9.1": {}, "3.0.0-beta": {} },
      {
        "2.0.0": "2023-01-01T00:00:00.000Z",
        "1.9.1": "2024-01-01T00:00:00.000Z",
        "3.0.0-beta": "2026-05-01T00:00:00.000Z",
      },
    );

    expect(packageStatus(pkg, "2.0.0", now).lastReleaseAt).toBe(
      "2026-05-01T00:00:00.000Z",
    );
  });

  it("ignores npm's modified date and unpublished versions", () => {
    const pkg = registry(
      { "1.0.0": {} },
      {
        modified: "2026-10-01T00:00:00.000Z",
        "1.0.0": "2020-01-01T00:00:00.000Z",
        "1.0.1": "2026-09-01T00:00:00.000Z",
      },
    );

    expect(packageStatus(pkg, "1.0.0", now)).toEqual({
      status: "stale",
      lastReleaseAt: "2020-01-01T00:00:00.000Z",
    });
  });

  it("is active exactly 12 months after the last release", () => {
    const pkg = registry(
      { "1.0.0": {} },
      { "1.0.0": "2025-10-19T12:00:00.000Z" },
    );
    expect(packageStatus(pkg, "1.0.0", now).status).toBe("active");
  });

  it("is stale just over 12 months after the last release", () => {
    const pkg = registry(
      { "1.0.0": {} },
      { "1.0.0": "2025-10-19T11:59:59.999Z" },
    );
    expect(packageStatus(pkg, "1.0.0", now).status).toBe("stale");
  });

  it("is active without publish dates", () => {
    expect(packageStatus(registry({ "1.0.0": {} }, {}), "1.0.0", now)).toEqual({
      status: "active",
    });
  });

  it("is deprecated when the latest version is, over stale", () => {
    const pkg = registry(
      { "1.0.0": { deprecated: "Use other-pkg instead" } },
      { "1.0.0": "2019-01-01T00:00:00.000Z" },
    );

    expect(packageStatus(pkg, "1.0.0", now)).toEqual({
      status: "deprecated",
      deprecationMessage: "Use other-pkg instead",
      lastReleaseAt: "2019-01-01T00:00:00.000Z",
    });
  });

  it("ignores deprecation of versions other than latest", () => {
    const pkg = registry(
      { "1.0.0": { deprecated: "Security issue, upgrade" }, "1.0.1": {} },
      { "1.0.1": "2026-09-01T00:00:00.000Z" },
    );
    expect(packageStatus(pkg, "1.0.1", now).status).toBe("active");
  });
});
