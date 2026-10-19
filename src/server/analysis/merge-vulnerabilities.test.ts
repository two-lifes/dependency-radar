import { describe, expect, it } from "vitest";
import { mergeVulnerabilities } from "./merge-vulnerabilities";
import type { OsvEvent, OsvRecord } from "./osv-record";

const target = { packageName: "lodash", currentVersion: "4.17.15" };

const record = (
  id: string,
  options: {
    aliases?: string[];
    severity?: string;
    events?: OsvEvent[][];
    packageName?: string;
    summary?: string;
    withdrawn?: string;
  } = {},
): OsvRecord => ({
  id,
  ...(options.aliases && { aliases: options.aliases }),
  ...(options.summary && { summary: options.summary }),
  ...(options.withdrawn && { withdrawn: options.withdrawn }),
  database_specific: { severity: options.severity ?? "MODERATE" },
  affected: [
    {
      package: { ecosystem: "npm", name: options.packageName ?? "lodash" },
      ranges: (options.events ?? [[{ introduced: "0" }]]).map((events) => ({
        type: "SEMVER",
        events,
      })),
    },
  ],
});

const fixedAt = (version: string): OsvEvent[][] => [
  [{ introduced: "0" }, { fixed: version }],
];

describe("mergeVulnerabilities", () => {
  it("merges a GHSA record and its CVE alias into one", () => {
    const result = mergeVulnerabilities(
      [
        record("GHSA-1111", { aliases: ["CVE-2021-1"] }),
        record("CVE-2021-1", { aliases: ["GHSA-1111"] }),
      ],
      target,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.ids).toEqual(["GHSA-1111", "CVE-2021-1"]);
    expect(result[0]?.primaryId).toBe("GHSA-1111");
  });

  it("merges transitive chains A ↔ B ↔ C", () => {
    const result = mergeVulnerabilities(
      [
        record("GHSA-aaaa", { aliases: ["CVE-2021-2"] }),
        record("CVE-2021-2", { aliases: ["OSV-2021-3"] }),
        record("OSV-2021-3"),
      ],
      target,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.ids).toEqual(["GHSA-aaaa", "CVE-2021-2", "OSV-2021-3"]);
  });

  it("merges records linked only through a shared alias", () => {
    const result = mergeVulnerabilities(
      [
        record("GHSA-aaaa", { aliases: ["CVE-2021-4"] }),
        record("GHSA-bbbb", { aliases: ["CVE-2021-4"] }),
      ],
      target,
    );
    expect(result).toHaveLength(1);
    expect(result[0]?.ids).toEqual(["GHSA-aaaa", "GHSA-bbbb", "CVE-2021-4"]);
  });

  it("keeps different vulnerabilities apart", () => {
    const result = mergeVulnerabilities(
      [
        record("GHSA-aaaa", { aliases: ["CVE-2021-5"] }),
        record("GHSA-bbbb", { aliases: ["CVE-2021-6"] }),
      ],
      target,
    );
    expect(result.map((v) => v.primaryId)).toEqual(["GHSA-aaaa", "GHSA-bbbb"]);
  });

  it("does not depend on record order", () => {
    const records = [
      record("CVE-2021-7", { aliases: ["GHSA-cccc"], severity: "LOW" }),
      record("GHSA-cccc", { severity: "HIGH", events: fixedAt("4.17.19") }),
      record("GHSA-dddd", { severity: "CRITICAL" }),
      record("GHSA-eeee", {
        aliases: ["CVE-2021-7"],
        events: fixedAt("4.17.21"),
      }),
    ];
    const forward = mergeVulnerabilities(records, target);
    const backward = mergeVulnerabilities([...records].reverse(), target);
    expect(backward).toEqual(forward);
    expect(forward.map((v) => v.primaryId)).toEqual(["GHSA-dddd", "GHSA-cccc"]);
  });

  it("takes the highest severity of the merged records", () => {
    const [vulnerability] = mergeVulnerabilities(
      [
        record("GHSA-aaaa", { aliases: ["CVE-2021-8"], severity: "MODERATE" }),
        record("CVE-2021-8", { severity: "CRITICAL" }),
      ],
      target,
    );
    expect(vulnerability?.severity).toBe("critical");
  });

  it("takes the summary of the primary record", () => {
    const [vulnerability] = mergeVulnerabilities(
      [
        record("CVE-2021-9", { summary: "From CVE" }),
        record("GHSA-aaaa", { aliases: ["CVE-2021-9"], summary: "From GHSA" }),
      ],
      target,
    );
    expect(vulnerability?.summary).toBe("From GHSA");
  });

  it("sorts by severity, then by id", () => {
    const result = mergeVulnerabilities(
      [
        record("GHSA-bbbb", { severity: "LOW" }),
        record("GHSA-cccc", { severity: "HIGH" }),
        record("GHSA-aaaa", { severity: "HIGH" }),
      ],
      target,
    );
    expect(result.map((v) => v.primaryId)).toEqual([
      "GHSA-aaaa",
      "GHSA-cccc",
      "GHSA-bbbb",
    ]);
  });

  it("skips withdrawn records", () => {
    const result = mergeVulnerabilities(
      [record("GHSA-aaaa", { withdrawn: "2022-01-01T00:00:00Z" })],
      target,
    );
    expect(result).toEqual([]);
  });

  describe("fixedIn", () => {
    const fixedIn = (records: OsvRecord[]) =>
      mergeVulnerabilities(records, target)[0]?.fixedIn;

    it("is the version fixed by every merged record", () => {
      expect(
        fixedIn([
          record("GHSA-aaaa", {
            aliases: ["CVE-2021-1"],
            events: fixedAt("4.17.19"),
          }),
          record("CVE-2021-1", { events: fixedAt("4.17.21") }),
        ]),
      ).toBe("4.17.21");
    });

    it("handles several affected ranges in one record", () => {
      expect(
        fixedIn([
          record("GHSA-aaaa", {
            events: [
              [{ introduced: "0" }, { fixed: "3.10.2" }],
              [{ introduced: "4.0.0" }, { fixed: "4.17.20" }],
              [{ introduced: "5.0.0" }, { fixed: "5.0.1" }],
            ],
          }),
        ]),
      ).toBe("4.17.20");
    });

    it("skips a candidate that another range reopens", () => {
      expect(
        fixedIn([
          record("GHSA-aaaa", {
            aliases: ["CVE-2021-1"],
            events: [
              [{ introduced: "0" }, { fixed: "4.17.16" }],
              [{ introduced: "4.17.16" }, { fixed: "4.17.21" }],
            ],
          }),
        ]),
      ).toBe("4.17.21");
    });

    it("is null when one merged record has no fix", () => {
      expect(
        fixedIn([
          record("GHSA-aaaa", {
            aliases: ["CVE-2021-1"],
            events: fixedAt("4.17.21"),
          }),
          record("CVE-2021-1", { events: [[{ introduced: "0" }]] }),
        ]),
      ).toBeNull();
    });

    it("ignores a fix below the current version", () => {
      expect(
        fixedIn([
          record("GHSA-aaaa", {
            aliases: ["CVE-2021-1"],
            events: fixedAt("4.17.21"),
          }),
          record("CVE-2021-1", {
            events: [
              [{ introduced: "0" }, { fixed: "3.0.0" }],
              [{ introduced: "4.0.0" }, { fixed: "4.17.19" }],
            ],
          }),
        ]),
      ).toBe("4.17.21");
    });

    it("respects last_affected", () => {
      expect(
        fixedIn([
          record("GHSA-aaaa", {
            aliases: ["CVE-2021-1"],
            events: [[{ introduced: "0" }, { last_affected: "4.17.20" }]],
          }),
          record("CVE-2021-1", {
            events: [[{ introduced: "0" }, { fixed: "4.17.20" }]],
          }),
          record("OSV-1", {
            aliases: ["CVE-2021-1"],
            events: [[{ introduced: "0" }, { fixed: "4.17.21" }]],
          }),
        ]),
      ).toBe("4.17.21");
    });

    it("respects an explicit list of affected versions", () => {
      const listed: OsvRecord = {
        id: "CVE-2021-1",
        affected: [
          {
            package: { ecosystem: "npm", name: "lodash" },
            versions: ["4.17.15", "4.17.19"],
          },
        ],
      };
      expect(
        fixedIn([
          record("GHSA-aaaa", {
            aliases: ["CVE-2021-1"],
            events: fixedAt("4.17.19"),
          }),
          listed,
          record("OSV-1", {
            aliases: ["CVE-2021-1"],
            events: fixedAt("4.17.20"),
          }),
        ]),
      ).toBe("4.17.20");
    });

    it("ignores ranges of other packages", () => {
      const lodash = record("GHSA-aaaa", { events: fixedAt("4.17.21") });
      const lodashEs = record("GHSA-aaaa", {
        packageName: "lodash-es",
        events: [[{ introduced: "4.17.20" }]],
      });
      expect(
        fixedIn([
          {
            ...lodash,
            affected: [
              ...(lodash.affected ?? []),
              ...(lodashEs.affected ?? []),
            ],
          },
        ]),
      ).toBe("4.17.21");
    });
  });
});
