import { describe, expect, it } from "vitest";
import { loginPath, safeNext } from "./safe-next";

describe("safeNext", () => {
  it.each(["/projects", "/r/abc/save", "/r/abc/dependencies?q=react&pkg=x"])(
    "keeps the site path %s",
    (next) => {
      expect(safeNext(next)).toBe(next);
    },
  );

  it.each([
    [null],
    [undefined],
    [""],
    ["projects"],
    ["https://evil.example/projects"],
    ["//evil.example"],
    ["/\\evil.example"],
    ["/\t/evil.example"],
    ["javascript:alert(1)"],
  ])("falls back to /projects for %j", (next) => {
    expect(safeNext(next)).toBe("/projects");
  });
});

describe("loginPath", () => {
  it("encodes the path into next", () => {
    expect(loginPath("/r/abc/save?x=1")).toBe(
      "/login?next=%2Fr%2Fabc%2Fsave%3Fx%3D1",
    );
  });

  it("leaves out the default destination", () => {
    expect(loginPath("/projects")).toBe("/login");
  });
});
