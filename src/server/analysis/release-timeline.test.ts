import { describe, expect, it } from "vitest";
import type { RegistryPackage } from "./registry-package";
import { releaseTimeline } from "./release-timeline";

function registry(time: Record<string, string>): RegistryPackage {
  const versions = Object.fromEntries(
    Object.keys(time)
      .filter((key) => key !== "created" && key !== "modified")
      .map((version) => [version, {}]),
  );
  return { versions, distTags: {}, time };
}

describe("releaseTimeline", () => {
  it("lists stable releases after current up to latest, oldest first", () => {
    const timeline = releaseTimeline(
      registry({
        created: "2020-01-01T00:00:00.000Z",
        "1.0.0": "2020-01-01T00:00:00.000Z",
        "1.1.0": "2020-02-01T00:00:00.000Z",
        "1.2.0-beta.1": "2020-02-15T00:00:00.000Z",
        "1.2.0": "2020-03-01T00:00:00.000Z",
        "1.3.0": "2020-04-01T00:00:00.000Z",
      }),
      "1.0.0",
      "1.2.0",
    );
    expect(timeline.map((release) => release.version)).toEqual([
      "1.1.0",
      "1.2.0",
    ]);
  });

  it("marks releases that change the major version as possibly breaking", () => {
    const timeline = releaseTimeline(
      registry({
        "1.0.0": "2020-01-01T00:00:00.000Z",
        "1.1.0": "2020-02-01T00:00:00.000Z",
        "2.0.0": "2020-03-01T00:00:00.000Z",
        "2.1.0": "2020-04-01T00:00:00.000Z",
        "3.0.0": "2020-05-01T00:00:00.000Z",
      }),
      "1.0.0",
      "3.0.0",
    );
    expect(timeline.map((release) => [release.version, release.major])).toEqual(
      [
        ["1.1.0", false],
        ["2.0.0", true],
        ["2.1.0", false],
        ["3.0.0", true],
      ],
    );
  });

  it("places releases by date between the current and the latest release", () => {
    const timeline = releaseTimeline(
      registry({
        "1.0.0": "2020-01-01T00:00:00.000Z",
        "1.0.1": "2020-01-02T00:00:00.000Z",
        "1.1.0": "2020-01-11T00:00:00.000Z",
      }),
      "1.0.0",
      "1.1.0",
    );
    expect(timeline).toEqual([
      {
        version: "1.0.1",
        publishedAt: "2020-01-02T00:00:00.000Z",
        position: 0.1,
        major: false,
      },
      {
        version: "1.1.0",
        publishedAt: "2020-01-11T00:00:00.000Z",
        position: 1,
        major: false,
      },
    ]);
  });

  it("spaces releases evenly when a date is missing", () => {
    const timeline = releaseTimeline(
      {
        versions: { "1.0.0": {}, "1.0.1": {}, "1.0.2": {} },
        distTags: {},
        time: { "1.0.2": "2020-01-03T00:00:00.000Z" },
      },
      "1.0.0",
      "1.0.2",
    );
    expect(
      timeline.map((release) => [release.publishedAt, release.position]),
    ).toEqual([
      [null, 0.5],
      ["2020-01-03T00:00:00.000Z", 1],
    ]);
  });

  it("skips versions that are no longer in the registry", () => {
    const timeline = releaseTimeline(
      {
        versions: { "1.0.0": {}, "1.2.0": {} },
        distTags: {},
        time: {
          "1.0.0": "2020-01-01T00:00:00.000Z",
          "1.1.0": "2020-02-01T00:00:00.000Z",
          "1.2.0": "2020-03-01T00:00:00.000Z",
        },
      },
      "1.0.0",
      "1.2.0",
    );
    expect(timeline.map((release) => release.version)).toEqual(["1.2.0"]);
  });

  it("is empty when the package is up to date or the versions are invalid", () => {
    const pkg = registry({ "1.0.0": "2020-01-01T00:00:00.000Z" });
    expect(releaseTimeline(pkg, "1.0.0", "1.0.0")).toEqual([]);
    expect(releaseTimeline(pkg, "latest", "1.0.0")).toEqual([]);
  });
});
