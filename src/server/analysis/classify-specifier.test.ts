import { describe, expect, it } from "vitest";
import { classifySpecifier } from "./classify-specifier";

describe("classifySpecifier", () => {
  it.each([
    "^1.2.3",
    "~1",
    "1.2.3",
    "v1.0.0",
    ">=1 <3",
    "1.2.3 - 2",
    "*",
    "",
    "x",
    " ^1.0.0 ",
  ])("treats %j as a range", (spec) => {
    expect(classifySpecifier(spec)).toEqual({
      kind: "range",
      range: spec.trim(),
    });
  });

  it.each(["latest", "next", "beta", "canary-2024"])(
    "treats %j as a tag",
    (spec) => {
      expect(classifySpecifier(spec)).toEqual({ kind: "tag", tag: spec });
    },
  );

  it.each([
    "git+https://github.com/a/b.git",
    "git://github.com/a/b.git",
    "git+ssh://git@github.com:a/b.git#v1",
    "github:a/b",
    "gitlab:a/b",
    "bitbucket:a/b",
    "file:../lib",
    "link:../lib",
    "workspace:*",
    "workspace:^1.0.0",
    "portal:../lib",
    "patch:lodash@4.17.21#./fix.patch",
    "catalog:",
    "https://example.com/pkg-1.0.0.tgz",
    "http://example.com/pkg.tgz",
    "./lib",
    "../lib",
    "/abs/lib",
    "~/lib",
    "owner/repo",
    "owner/repo#main",
  ])("treats %j as not from the npm registry", (spec) => {
    expect(classifySpecifier(spec)).toEqual({ kind: "non-registry" });
  });

  it("resolves an npm: alias to the real name", () => {
    expect(classifySpecifier("npm:lodash@^4.17.0")).toEqual({
      kind: "alias",
      name: "lodash",
      inner: { kind: "range", range: "^4.17.0" },
    });
  });

  it("resolves a scoped npm: alias", () => {
    expect(classifySpecifier("npm:@types/node@next")).toEqual({
      kind: "alias",
      name: "@types/node",
      inner: { kind: "tag", tag: "next" },
    });
  });

  it("treats an npm: alias without a version as any version", () => {
    expect(classifySpecifier("npm:@scope/pkg")).toEqual({
      kind: "alias",
      name: "@scope/pkg",
      inner: { kind: "range", range: "*" },
    });
  });

  it.each([
    "npm:",
    "npm:@scope",
    "npm:a@npm:b@1",
    "npm:a@github:x/y",
    "npm:a@!!",
  ])("rejects the malformed alias %j", (spec) => {
    expect(classifySpecifier(spec)).toEqual({ kind: "invalid" });
  });

  it.each(["garbage!!", "^1.2.3 || ???", "1.0.0 !!"])(
    "treats %j as invalid",
    (spec) => {
      expect(classifySpecifier(spec)).toEqual({ kind: "invalid" });
    },
  );
});
