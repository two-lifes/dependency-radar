import { describe, expect, it } from "vitest";
import type { OsvRecord } from "./osv-record";
import { cvss3BaseScore, maxSeverity, recordSeverity } from "./severity";

const ghsa = (severity: string): OsvRecord => ({
  id: "GHSA-aaaa-bbbb-cccc",
  database_specific: { severity },
});

const cvss = (vector: string): OsvRecord => ({
  id: "CVE-2024-0001",
  severity: [{ type: "CVSS_V3", score: vector }],
});

describe("recordSeverity", () => {
  it.each([
    ["CRITICAL", "critical"],
    ["HIGH", "high"],
    ["MODERATE", "moderate"],
    ["LOW", "low"],
    ["High", "high"],
  ])("maps the GHSA label %s", (label, expected) => {
    expect(recordSeverity(ghsa(label))).toBe(expected);
  });

  it("prefers the GHSA label over CVSS", () => {
    expect(
      recordSeverity({
        ...cvss("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"),
        database_specific: { severity: "LOW" },
      }),
    ).toBe("low");
  });

  it.each([
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", "critical"],
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H", "high"],
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", "moderate"],
    ["CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N", "low"],
  ])("falls back to the CVSS v3 vector %s", (vector, expected) => {
    expect(recordSeverity(cvss(vector))).toBe(expected);
  });

  it("falls back to an unknown GHSA label's CVSS", () => {
    expect(
      recordSeverity({
        ...cvss("CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"),
        database_specific: { severity: "UNKNOWN" },
      }),
    ).toBe("critical");
  });

  it("treats a record without severity data as moderate", () => {
    expect(recordSeverity({ id: "CVE-2024-0002" })).toBe("moderate");
    expect(
      recordSeverity({
        id: "CVE-2024-0003",
        severity: [{ type: "CVSS_V4", score: "CVSS:4.0/AV:N/AC:L" }],
      }),
    ).toBe("moderate");
  });

  it("treats malicious packages as critical", () => {
    expect(recordSeverity({ id: "MAL-2024-1234" })).toBe("critical");
  });
});

describe("cvss3BaseScore", () => {
  it.each([
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H", 9.8],
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H", 7.5],
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N", 5.3],
    ["CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:N/A:N", 3.1],
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N", 6.1],
    ["CVSS:3.0/AV:N/AC:L/PR:N/UI:N/S:C/C:H/I:H/A:H", 10],
    ["CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:N", 0],
  ])("scores %s as %d", (vector, score) => {
    expect(cvss3BaseScore(vector)).toBe(score);
  });

  it("rejects incomplete or foreign vectors", () => {
    expect(cvss3BaseScore("CVSS:3.1/AV:N/AC:L")).toBeUndefined();
    expect(cvss3BaseScore("AV:N/AC:L/Au:N/C:P/I:P/A:P")).toBeUndefined();
    expect(
      cvss3BaseScore("CVSS:3.1/AV:X/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H"),
    ).toBeUndefined();
  });
});

describe("maxSeverity", () => {
  it("returns the highest severity", () => {
    expect(maxSeverity(["low", "high", "moderate"])).toBe("high");
    expect(maxSeverity([])).toBeUndefined();
  });
});
