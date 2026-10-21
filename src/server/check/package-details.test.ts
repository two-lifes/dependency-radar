import { describe, expect, it } from "vitest";
import { toPackageDetails } from "./package-details";

const target = {
  registryName: "lodash",
  current: "4.17.15",
  latest: "4.17.21",
};

describe("toPackageDetails", () => {
  it("builds links and the release scale from the npm document", () => {
    const details = toPackageDetails(
      {
        registry: {
          versions: { "4.17.15": {}, "4.17.21": {} },
          distTags: { latest: "4.17.21" },
          time: {
            "4.17.15": "2019-07-19T00:00:00.000Z",
            "4.17.21": "2021-02-20T00:00:00.000Z",
          },
        },
        description: "  Lodash modular utilities.  ",
        license: "MIT",
        repositoryUrl: "git+https://github.com/lodash/lodash.git",
      },
      target,
    );
    expect(details).toEqual({
      description: "Lodash modular utilities.",
      license: "MIT",
      npmUrl: "https://www.npmjs.com/package/lodash",
      repositoryUrl: "https://github.com/lodash/lodash",
      releases: [
        {
          version: "4.17.21",
          publishedAt: "2021-02-20T00:00:00.000Z",
          position: 1,
          major: false,
        },
      ],
    });
  });

  it("leaves out what npm doesn't publish", () => {
    const details = toPackageDetails(
      {
        registry: { versions: {}, distTags: {}, time: {} },
        description: " ",
      },
      target,
    );
    expect(details).toMatchObject({
      description: null,
      license: null,
      repositoryUrl: null,
      releases: [],
    });
  });
});
