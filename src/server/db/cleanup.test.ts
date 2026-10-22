import { PgDialect } from "drizzle-orm/pg-core";
import { describe, expect, it } from "vitest";
import { expiredGuestReports } from "./cleanup";

// Unit tests don't touch the database (plan.md assumption 1), so this checks
// the condition the delete runs with.
describe("expiredGuestReports", () => {
  it("selects reports whose expires_at is now or earlier", () => {
    const now = new Date("2026-10-22T03:00:00Z");

    const query = new PgDialect().sqlToQuery(expiredGuestReports(now));

    expect(query.sql).toBe('"reports"."expires_at" <= $1');
    expect(query.params).toEqual([now.toISOString()]);
  });
});
