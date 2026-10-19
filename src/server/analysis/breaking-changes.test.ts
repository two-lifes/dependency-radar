import { describe, expect, it } from "vitest";
import { hasBreakingSigns, isPossiblyBreaking } from "./breaking-changes";

describe("hasBreakingSigns", () => {
  it.each([
    "## Breaking Changes\n- dropped Node 16",
    "### ⚠ BREAKING CHANGES\n\n* foo",
    "#### Removed\n- `legacyApi()`",
    "### Deprecations\n- `oldOption`",
    "## Backwards incompatible changes",
    "**Breaking**\n- something",
    "* feat!: drop CommonJS build",
    "- fix(router)!: rename `match` to `matchPath` by @someone",
    "Some text.\n\nBREAKING CHANGE: `config` is now required.",
    "BREAKING: the default export is gone",
  ])("detects %j", (notes) => {
    expect(hasBreakingSigns(notes)).toBe(true);
  });

  it.each([
    "",
    "### Bug fixes\n- fix deprecated warning in console",
    "### Features\n- add `removeListener` helper",
    "- not breaking anything, just docs",
    "Fixes a breaking change introduced in 2.3.0",
    "feat: support ESM",
  ])("ignores %j", (notes) => {
    expect(hasBreakingSigns(notes)).toBe(false);
  });
});

describe("isPossiblyBreaking", () => {
  it("treats a major release as breaking without notes", () => {
    expect(isPossiblyBreaking({ from: "1.4.2", to: "2.0.0" })).toBe(true);
  });

  it("checks the notes of a minor release", () => {
    expect(
      isPossiblyBreaking({
        from: "1.4.2",
        to: "1.5.0",
        notes: "## Breaking\n- x",
      }),
    ).toBe(true);
    expect(
      isPossiblyBreaking({ from: "1.4.2", to: "1.5.0", notes: "## Features" }),
    ).toBe(false);
    expect(isPossiblyBreaking({ from: "1.4.2", to: "1.5.0" })).toBe(false);
  });

  it("does not flag patch releases or older versions", () => {
    expect(
      isPossiblyBreaking({
        from: "1.4.2",
        to: "1.4.3",
        notes: "BREAKING CHANGE: x",
      }),
    ).toBe(false);
    expect(isPossiblyBreaking({ from: "2.0.0", to: "1.0.0" })).toBe(false);
  });
});
