import { describe, expect, it } from "vitest";
import { queryString } from "./query-string";

describe("queryString", () => {
  it("is empty without params", () => {
    expect(queryString({})).toBe("");
    expect(queryString({ q: undefined })).toBe("");
  });

  it("keeps repeated keys and encodes values", () => {
    expect(queryString({ lag: ["major", "minor"], q: "a b" })).toBe(
      "?lag=major&lag=minor&q=a+b",
    );
  });
});
