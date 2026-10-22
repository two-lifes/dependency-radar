import { describe, expect, it } from "vitest";
import type { GithubUserRepo } from "@/server/sources/github";
import { filterRepos, markAdded } from "./github-repos";

const repo = (fullName: string): GithubUserRepo => ({
  name: fullName.split("/")[1] ?? fullName,
  fullName,
  url: `https://github.com/${fullName}`,
});

describe("markAdded", () => {
  it("links a repository to the project that checks it, ignoring case", () => {
    const rows = markAdded(
      [repo("Octocat/Shop"), repo("Octocat/blog")],
      [{ projectId: "p1", repoUrl: "https://github.com/octocat/shop" }],
    );
    expect(rows.map((row) => row.projectId)).toEqual(["p1", undefined]);
  });

  it("matches stored URLs with www. or .git", () => {
    const rows = markAdded(
      [repo("octocat/shop")],
      [{ projectId: "p1", repoUrl: "https://www.github.com/octocat/shop.git" }],
    );
    expect(rows[0]?.projectId).toBe("p1");
  });

  it("skips projects without a repository", () => {
    const rows = markAdded(
      [repo("octocat/shop")],
      [{ projectId: "p1", repoUrl: null }],
    );
    expect(rows[0]).not.toHaveProperty("projectId");
  });

  it("keeps the first project when a repository is added twice", () => {
    const url = "https://github.com/octocat/shop";
    const rows = markAdded(
      [repo("octocat/shop")],
      [
        { projectId: "p1", repoUrl: url },
        { projectId: "p2", repoUrl: url },
      ],
    );
    expect(rows[0]?.projectId).toBe("p1");
  });
});

describe("filterRepos", () => {
  const repos = [repo("octocat/shop-web"), repo("octocat/Blog")];

  it("returns everything for an empty query", () => {
    expect(filterRepos(repos, "  ")).toEqual(repos);
  });

  it("matches part of the name, ignoring case and spaces around", () => {
    expect(filterRepos(repos, " BLOG ")).toEqual([repos[1]]);
    expect(filterRepos(repos, "shop")).toEqual([repos[0]]);
  });

  it("returns nothing when no name matches", () => {
    expect(filterRepos(repos, "api")).toEqual([]);
  });
});
