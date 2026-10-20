import { describe, expect, it } from "vitest";
import { checkOutcome, isSourceFailure } from "./check-outcome";
import type { UncheckedReason } from "./resolve-versions";

const rows = (...reasons: (UncheckedReason | null)[]) =>
  reasons.map((reason) => ({ reason }));

describe("checkOutcome", () => {
  it("is completed when nothing failed in a source", () => {
    expect(checkOutcome(rows(null, null))).toEqual({
      status: "completed",
      failure: null,
    });
  });

  it("is completed for an empty check", () => {
    expect(checkOutcome([]).status).toBe("completed");
  });

  it("ignores packages that a retry can't fix", () => {
    expect(
      checkOutcome(
        rows(null, "not-from-registry", "not-in-registry", "unknown-tag"),
      ).status,
    ).toBe("completed");
  });

  it("is completed when every package is a git dependency", () => {
    expect(checkOutcome(rows("not-from-registry")).status).toBe("completed");
  });

  it("is partial when some packages hit a source failure", () => {
    expect(checkOutcome(rows(null, "registry-unavailable"))).toEqual({
      status: "partial",
      failure: null,
    });
  });

  it("is partial when a package missing from npm is the only other one", () => {
    expect(
      checkOutcome(rows("not-in-registry", "registry-unavailable")).status,
    ).toBe("partial");
  });

  it("fails when every looked-up package hit a source failure", () => {
    expect(
      checkOutcome(
        rows(
          "registry-unavailable",
          "registry-unavailable",
          "not-from-registry",
        ),
      ),
    ).toEqual({ status: "failed", failure: "registry-unavailable" });
  });

  it("prefers the rate limit as the failure reason", () => {
    expect(
      checkOutcome(
        rows(
          "vulnerabilities-unavailable",
          "registry-rate-limited",
          "registry-unavailable",
          "not-from-registry",
        ),
      ),
    ).toEqual({ status: "failed", failure: "registry-rate-limited" });
  });

  it("reports OSV when only vulnerabilities failed", () => {
    expect(checkOutcome(rows("vulnerabilities-unavailable"))).toEqual({
      status: "failed",
      failure: "vulnerabilities-unavailable",
    });
  });
});

describe("isSourceFailure", () => {
  it("accepts only retryable reasons", () => {
    expect(isSourceFailure("registry-rate-limited")).toBe(true);
    expect(isSourceFailure("not-in-registry")).toBe(false);
    expect(isSourceFailure(null)).toBe(false);
  });
});
