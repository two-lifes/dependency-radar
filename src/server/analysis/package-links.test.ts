import { describe, expect, it } from "vitest";
import { npmPageUrl, repositoryPageUrl } from "./package-links";

describe("npmPageUrl", () => {
  it.each([
    ["lodash", "https://www.npmjs.com/package/lodash"],
    ["@types/node", "https://www.npmjs.com/package/@types/node"],
  ])("%s", (name, url) => {
    expect(npmPageUrl(name)).toBe(url);
  });
});

describe("repositoryPageUrl", () => {
  it.each([
    [
      "git+https://github.com/lodash/lodash.git",
      "https://github.com/lodash/lodash",
    ],
    ["git+ssh://git@github.com/o/r.git", "https://github.com/o/r"],
    ["git@github.com:o/r.git", "https://github.com/o/r"],
    ["github:o/r", "https://github.com/o/r"],
    ["https://github.com/o/r/tree/main/packages/x", "https://github.com/o/r"],
    [
      "git+https://gitlab.com/group/project.git",
      "https://gitlab.com/group/project",
    ],
    ["https://example.org/repo", "https://example.org/repo"],
  ])("%s", (value, url) => {
    expect(repositoryPageUrl(value)).toBe(url);
  });

  it.each(["", "not a url", "svn://example.org/repo", "javascript:alert(1)"])(
    "no link for %j",
    (value) => {
      expect(repositoryPageUrl(value)).toBeNull();
    },
  );
});
