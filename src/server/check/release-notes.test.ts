import { describe, expect, it } from "vitest";
import type { NpmPackageInfo } from "../sources/npm";
import { releasesRepo, toReleaseNotesView } from "./release-notes";

const registry = {
  versions: { "1.0.0": {}, "1.1.0": {} },
  distTags: { latest: "1.1.0" },
  time: {},
};
const target = { registryName: "pkg", current: "1.0.0", latest: "1.1.0" };

describe("releasesRepo", () => {
  it("reads the GitHub repository from npm's repository field", () => {
    expect(
      releasesRepo({
        registry,
        repositoryUrl: "git+https://github.com/o/r.git",
      }),
    ).toEqual({ owner: "o", repo: "r" });
  });

  it("is null without a repository or for another host", () => {
    expect(releasesRepo({ registry })).toBeNull();
    expect(
      releasesRepo({ registry, repositoryUrl: "https://gitlab.com/o/r" }),
    ).toBeNull();
  });
});

describe("toReleaseNotesView", () => {
  it("links the repository page next to the notes", () => {
    const info: NpmPackageInfo = {
      registry,
      repositoryUrl: "git+https://github.com/o/r.git",
    };
    expect(
      toReleaseNotesView(
        info,
        [
          {
            tag: "v1.1.0",
            url: "https://github.com/o/r/releases/tag/v1.1.0",
            prerelease: false,
          },
        ],
        target,
      ),
    ).toMatchObject({
      notes: [{ version: "1.1.0", body: null }],
      repositoryUrl: "https://github.com/o/r",
    });
  });

  it("keeps a non-GitHub repository link for the empty state", () => {
    expect(
      toReleaseNotesView(
        { registry, repositoryUrl: "https://gitlab.com/o/r.git" },
        [],
        target,
      ),
    ).toEqual({ notes: [], repositoryUrl: "https://gitlab.com/o/r" });
  });
});
