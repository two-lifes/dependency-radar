import { describe, expect, it } from "vitest";
import { computeLag } from "./version-lag";

describe("computeLag", () => {
  it.each([
    ["1.2.3", "1.2.3", { kind: "current" }],
    ["1.2.3", "1.2.5", { kind: "patch" }],
    ["1.2.3", "1.4.0", { kind: "minor" }],
    ["1.9.9", "2.0.0", { kind: "major", majors: 1 }],
    ["1.0.0", "4.1.0", { kind: "major", majors: 3 }],
    ["0.2.0", "0.3.0", { kind: "minor" }],
    ["0.2.1", "0.2.5", { kind: "patch" }],
    ["1.0.0-rc.1", "1.0.0", { kind: "patch" }],
    ["1.1.0-beta", "1.2.0", { kind: "minor" }],
    ["3.0.0-beta", "2.5.0", { kind: "current" }],
    ["2.6.0", "2.5.0", { kind: "current" }],
  ])("%s → %s", (current, latest, lag) => {
    expect(computeLag(current, latest)).toEqual(lag);
  });
});
