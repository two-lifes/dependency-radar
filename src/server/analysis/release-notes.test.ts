import { describe, expect, it } from "vitest";
import type { RegistryPackage } from "./registry-package";
import {
  type PublishedRelease,
  releaseVersion,
  toReleaseNotes,
} from "./release-notes";

function registry(versions: string[]): RegistryPackage {
  return {
    versions: Object.fromEntries(versions.map((version) => [version, {}])),
    distTags: {},
    time: Object.fromEntries(
      versions.map((version, index) => [
        version,
        new Date(Date.UTC(2020, index, 1)).toISOString(),
      ]),
    ),
  };
}

function release(
  tag: string,
  overrides: Partial<PublishedRelease> = {},
): PublishedRelease {
  return {
    tag,
    body: `Notes for ${tag}`,
    url: `https://github.com/o/r/releases/tag/${tag}`,
    prerelease: false,
    ...overrides,
  };
}

describe("releaseVersion", () => {
  it.each([
    ["1.2.3", "pkg", "1.2.3"],
    ["v1.2.3", "pkg", "1.2.3"],
    ["pkg@1.2.3", "pkg", "1.2.3"],
    ["@scope/pkg@1.2.3", "@scope/pkg", "1.2.3"],
    ["@scope/pkg@v1.2.3", "@scope/pkg", "1.2.3"],
    ["pkg-v1.2.3", "@scope/pkg", "1.2.3"],
    ["v2.0.0-beta.1", "pkg", "2.0.0-beta.1"],
  ])("reads %s of %s as %s", (tag, name, version) => {
    expect(releaseVersion(tag, name)).toBe(version);
  });

  it.each([
    ["other@1.2.3", "pkg"],
    ["@scope/other@1.2.3", "@scope/pkg"],
    ["other-v1.2.3", "pkg"],
    ["release-2020", "pkg"],
    ["1.2", "pkg"],
  ])("ignores %s for %s", (tag, name) => {
    expect(releaseVersion(tag, name)).toBeNull();
  });
});

describe("toReleaseNotes", () => {
  const target = { registryName: "pkg", current: "1.0.0", latest: "2.0.0" };
  const pkg = registry(["1.0.0", "1.0.1", "1.1.0", "2.0.0", "2.1.0"]);

  it("lists releases after current up to latest, newest first", () => {
    const notes = toReleaseNotes(
      pkg,
      [
        release("v2.1.0"),
        release("v2.0.0"),
        release("v1.1.0"),
        release("v1.0.1"),
        release("v1.0.0"),
      ],
      target,
    );
    expect(notes.map((note) => note.version)).toEqual([
      "2.0.0",
      "1.1.0",
      "1.0.1",
    ]);
    expect(notes[0]).toEqual({
      version: "2.0.0",
      title: null,
      body: "Notes for v2.0.0",
      url: "https://github.com/o/r/releases/tag/v2.0.0",
      publishedAt: "2020-04-01T00:00:00.000Z",
      possiblyBreaking: true,
    });
  });

  it("flags majors always, minors by their notes, patches never", () => {
    const notes = toReleaseNotes(
      pkg,
      [
        release("v2.0.0", { body: "Small cleanup" }),
        release("v1.1.0", { body: "## Breaking Changes\n- dropped Node 14" }),
        release("v1.0.1", { body: "BREAKING CHANGE: oops" }),
      ],
      target,
    );
    expect(notes.map((note) => [note.version, note.possiblyBreaking])).toEqual([
      ["2.0.0", true],
      ["1.1.0", true],
      ["1.0.1", false],
    ]);
  });

  it("judges a release against the previous npm version, not the previous release", () => {
    // 2.0.0 has no release: 2.1.0 is a minor after it, not a major after 1.1.0.
    const notes = toReleaseNotes(
      pkg,
      [release("v2.1.0", { body: "Faster" }), release("v1.1.0")],
      { ...target, latest: "2.1.0" },
    );
    expect(notes.map((note) => [note.version, note.possiblyBreaking])).toEqual([
      ["2.1.0", false],
      ["1.1.0", false],
    ]);
  });

  it("skips prereleases, other packages' tags and versions npm doesn't have", () => {
    const notes = toReleaseNotes(
      pkg,
      [
        release("v1.5.0"),
        release("other@1.1.0"),
        release("v1.1.0", { prerelease: true }),
        release("pkg@1.0.1"),
      ],
      target,
    );
    expect(notes.map((note) => note.version)).toEqual(["1.0.1"]);
  });

  it("keeps the newer of two releases with the same version", () => {
    const notes = toReleaseNotes(
      pkg,
      [release("v1.0.1", { body: "new" }), release("1.0.1", { body: "old" })],
      target,
    );
    expect(notes.map((note) => note.body)).toEqual(["new"]);
  });

  it("keeps a release name only when it says more than the tag", () => {
    const notes = toReleaseNotes(
      pkg,
      [
        release("v1.1.0", { name: "v1.1.0", body: "   " }),
        release("v1.0.1", {
          name: " Spring cleanup ",
          publishedAt: "2021-01-01T00:00:00Z",
        }),
      ],
      target,
    );
    expect(notes).toMatchObject([
      { version: "1.1.0", title: null, body: null },
      {
        version: "1.0.1",
        title: "Spring cleanup",
        publishedAt: "2021-01-01T00:00:00Z",
      },
    ]);
  });

  it("is empty when the package is up to date", () => {
    expect(
      toReleaseNotes(pkg, [release("v2.0.0")], {
        ...target,
        current: "2.0.0",
      }),
    ).toEqual([]);
  });
});
