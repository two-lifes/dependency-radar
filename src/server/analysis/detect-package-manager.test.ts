import { describe, expect, it } from "vitest";
import { detectPackageManager } from "./detect-package-manager";

describe("detectPackageManager", () => {
  it.each([
    ["pnpm@9.1.0", "pnpm"],
    ["yarn@4.2.2+sha512.abc", "yarn"],
    ["npm@10.8.0", "npm"],
    [" pnpm@9.1.0 ", "pnpm"],
  ] as const)("takes %j from the packageManager field", (field, expected) => {
    expect(detectPackageManager({ packageManager: field })).toBe(expected);
  });

  it("prefers the field over a conflicting lockfile", () => {
    expect(
      detectPackageManager({
        packageManager: "npm@10.8.0",
        files: ["pnpm-lock.yaml"],
      }),
    ).toBe("npm");
  });

  it.each(["bun@1.1.0", "", "@9", "yarn-classic@1"])(
    "falls through an unsupported or broken field %j",
    (field) => {
      expect(
        detectPackageManager({ packageManager: field, files: ["yarn.lock"] }),
      ).toBe("yarn");
    },
  );

  it("uses the pnpm lockfile", () => {
    expect(
      detectPackageManager({ files: ["package.json", "pnpm-lock.yaml"] }),
    ).toBe("pnpm");
  });

  it("uses the yarn lockfile", () => {
    expect(detectPackageManager({ files: ["package.json", "yarn.lock"] })).toBe(
      "yarn",
    );
  });

  it("prefers pnpm when both lockfiles exist", () => {
    expect(
      detectPackageManager({ files: ["yarn.lock", "pnpm-lock.yaml"] }),
    ).toBe("pnpm");
  });

  it("defaults to npm", () => {
    expect(detectPackageManager({})).toBe("npm");
    expect(
      detectPackageManager({ files: ["package.json", "package-lock.json"] }),
    ).toBe("npm");
  });
});
