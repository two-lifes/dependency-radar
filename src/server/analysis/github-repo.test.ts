import { describe, expect, it } from "vitest";
import { parseGithubRepoUrl, parseRepositoryField } from "./github-repo";

const repo = { owner: "vercel", repo: "next.js" };

describe("parseGithubRepoUrl", () => {
  it.each([
    "https://github.com/vercel/next.js",
    "https://github.com/vercel/next.js/",
    "https://github.com/vercel/next.js.git",
    "http://github.com/vercel/next.js",
    "https://www.github.com/vercel/next.js",
    "github.com/vercel/next.js",
    "  https://github.com/vercel/next.js  ",
    "https://github.com/vercel/next.js?tab=readme#top",
  ])("reads %j", (input) => {
    expect(parseGithubRepoUrl(input)).toEqual(repo);
  });

  it.each([
    "",
    "vercel/next.js",
    "https://github.com/vercel",
    "https://github.com/vercel/next.js/tree/canary/packages/next",
    "https://gitlab.com/vercel/next.js",
    "https://github.com.evil.com/vercel/next.js",
    "ftp://github.com/vercel/next.js",
    "https://github.com/-bad/repo",
    "https://github.com/owner/..",
    "not a url at all",
  ])("rejects %j", (input) => {
    expect(parseGithubRepoUrl(input)).toBeNull();
  });
});

describe("parseRepositoryField", () => {
  it.each([
    "git+https://github.com/vercel/next.js.git",
    "https://github.com/vercel/next.js",
    "git://github.com/vercel/next.js.git",
    "git+ssh://git@github.com/vercel/next.js.git",
    "git@github.com:vercel/next.js.git",
    "github:vercel/next.js",
    "vercel/next.js",
    "https://github.com/vercel/next.js/tree/canary/packages/next",
    "git+https://github.com/vercel/next.js.git#canary",
  ])("reads %j", (value) => {
    expect(parseRepositoryField(value)).toEqual(repo);
  });

  it.each([
    "",
    "git+https://gitlab.com/a/b.git",
    "gitlab:a/b",
    "bitbucket:a/b",
    "https://github.com/vercel",
    "not a url",
  ])("rejects %j", (value) => {
    expect(parseRepositoryField(value)).toBeNull();
  });
});
