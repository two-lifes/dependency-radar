import { describe, expect, it } from "vitest";
import { packageNameFrom } from "./package-name";

describe("packageNameFrom", () => {
  it("reads the trimmed name of a package.json", () => {
    expect(packageNameFrom('{ "name": "  shop-frontend " }')).toBe(
      "shop-frontend",
    );
  });

  it("cuts the name to the 60 characters a project name allows", () => {
    expect(packageNameFrom(JSON.stringify({ name: "a".repeat(80) }))).toBe(
      "a".repeat(60),
    );
  });

  it("gives nothing for half-typed JSON or a missing or empty name", () => {
    expect(packageNameFrom('{ "name": "sh')).toBeUndefined();
    expect(packageNameFrom('{ "dependencies": {} }')).toBeUndefined();
    expect(packageNameFrom('{ "name": " " }')).toBeUndefined();
    expect(packageNameFrom('{ "name": 1 }')).toBeUndefined();
    expect(packageNameFrom("null")).toBeUndefined();
  });
});
