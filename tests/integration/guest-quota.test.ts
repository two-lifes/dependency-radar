import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import {
  createGuestReport,
  type NewGuestReport,
} from "../../src/server/db/reports";
import { createPgCheckStore } from "../../src/server/db/check-store";
import {
  consumeGuestQuota,
  guestChecksRemaining,
  GuestQuotaExhausted,
} from "../../src/server/db/guest-quota";
import { checks, guestQuotas, reports } from "../../src/server/db/schema";
import { deleteExpiredGuestReports } from "../../src/server/db/cleanup";
import { testDatabase } from "./database";

const { client, db } = testDatabase();
afterAll(() => client.end());
const input: NewGuestReport = {
  source: "paste",
  input: {
    name: "quota-test",
    dependencies: [{ name: "react", specifier: "^18.0.0", type: "prod" }],
    lockedVersions: null,
    warnings: [],
    packageManager: "npm",
  },
};

describe("guest quota PostgreSQL transactions", () => {
  it("rolls back quota when writing the report fails in PostgreSQL", async () => {
    const id = randomUUID();
    // Exercise the DB boundary with a value validation normally rejects earlier.
    const invalid = { ...input, source: "invalid" as NewGuestReport["source"] };
    await expect(
      createGuestReport(db, invalid, new Date(), id),
    ).rejects.toThrow();
    expect(await guestChecksRemaining(db, id)).toBe(3);
    expect(
      await db.select().from(guestQuotas).where(eq(guestQuotas.id, id)),
    ).toHaveLength(0);
  });
  it("allows only one of concurrent launches sharing the last attempt", async () => {
    const id = randomUUID();
    await db.insert(guestQuotas).values({ id, used: 2 });
    const outcomes = await Promise.allSettled(
      Array.from({ length: 8 }, () =>
        createGuestReport(db, input, new Date(), id),
      ),
    );
    expect(outcomes.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    for (const outcome of outcomes)
      if (outcome.status === "rejected")
        expect(outcome.reason).toBeInstanceOf(GuestQuotaExhausted);
    expect(await guestChecksRemaining(db, id)).toBe(0);
  });

  it("rolls back both an inserted counter and a later failure", async () => {
    const id = randomUUID();
    await expect(
      db.transaction(async (tx) => {
        await consumeGuestQuota(tx, id);
        throw new Error("write failed");
      }),
    ).rejects.toThrow("write failed");
    expect(await guestChecksRemaining(db, id)).toBe(3);
    expect(
      await db.select().from(guestQuotas).where(eq(guestQuotas.id, id)),
    ).toHaveLength(0);
  });

  it("rolls back quota and refreshed input on already-running, then charges Check again", async () => {
    const id = randomUUID();
    const first = await createGuestReport(db, input, new Date(), id);
    const changed = { ...input.input, name: "must-not-leak" };
    const store = createPgCheckStore(db, id);
    expect(await store.createCheck(first.reportId, changed)).toEqual({
      ok: false,
      error: "already-running",
    });
    expect(await guestChecksRemaining(db, id)).toBe(2);
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, first.reportId));
    expect(report?.name).toBe("quota-test");
    await db
      .update(checks)
      .set({ status: "cancelled", startedAt: new Date(Date.now() - 61_000) })
      .where(eq(checks.id, first.checkId));
    expect((await store.createCheck(first.reportId, changed)).ok).toBe(true);
    expect(await guestChecksRemaining(db, id)).toBe(1);
  });

  it("does not charge missing reports or changes rejected at zero", async () => {
    const id = randomUUID();
    expect(await createPgCheckStore(db, id).createCheck(randomUUID())).toEqual({
      ok: false,
      error: "report-not-found",
    });
    expect(await guestChecksRemaining(db, id)).toBe(3);
    const first = await createGuestReport(db, input);
    await db
      .update(checks)
      .set({ status: "cancelled", startedAt: new Date(Date.now() - 61_000) })
      .where(eq(checks.id, first.checkId));
    await db.insert(guestQuotas).values({ id, used: 3 });
    expect(
      await createPgCheckStore(db, id).createCheck(first.reportId, {
        ...input.input,
        name: "changed",
      }),
    ).toEqual({ ok: false, error: "guest-quota-exhausted" });
    const [report] = await db
      .select()
      .from(reports)
      .where(eq(reports.id, first.reportId));
    expect(report?.name).toBe("quota-test");
  });

  it("charges the initiator and keeps counters after report expiry and cron cleanup", async () => {
    const author = randomUUID(),
      visitor = randomUUID();
    const old = new Date(Date.now() - 8 * 86_400_000);
    const first = await createGuestReport(db, input, old, author);
    await db
      .update(checks)
      .set({ status: "cancelled", startedAt: new Date(Date.now() - 61_000) })
      .where(eq(checks.id, first.checkId));
    expect(
      (await createPgCheckStore(db, visitor).createCheck(first.reportId)).ok,
    ).toBe(true);
    await deleteExpiredGuestReports(db, new Date());
    expect(await guestChecksRemaining(db, author)).toBe(2);
    expect(await guestChecksRemaining(db, visitor)).toBe(2);
  });
});

describe("report cooldown PostgreSQL transactions", () => {
  it("keeps cancellation, input and quota unchanged during the minute for any visitor", async () => {
    const author = randomUUID(),
      visitor = randomUUID();
    const first = await createGuestReport(db, input, new Date(), author);
    await db
      .update(checks)
      .set({ status: "cancelled" })
      .where(eq(checks.id, first.checkId));
    for (const id of [author, visitor, undefined]) {
      expect(
        await createPgCheckStore(db, id).createCheck(first.reportId, {
          ...input.input,
          name: "blocked",
        }),
      ).toMatchObject({
        ok: false,
        error: "check-cooldown",
        nextCheckAt: expect.any(String),
      });
    }
    expect(await guestChecksRemaining(db, author)).toBe(2);
    expect(await guestChecksRemaining(db, visitor)).toBe(3);
    expect(
      (await db.select().from(reports).where(eq(reports.id, first.reportId)))[0]
        ?.name,
    ).toBe("quota-test");
    expect(
      await db.select().from(checks).where(eq(checks.reportId, first.reportId)),
    ).toHaveLength(1);
    // A different report has its own deadline, including the same source.
    const other = await createGuestReport(db, input, new Date(), visitor);
    expect(other.reportId).not.toBe(first.reportId);
  });

  it("serializes concurrent launches at the end of the pause", async () => {
    const id = randomUUID();
    const first = await createGuestReport(db, input, new Date(), id);
    await db
      .update(checks)
      .set({ status: "completed", startedAt: new Date(Date.now() - 61_000) })
      .where(eq(checks.id, first.checkId));
    const outcomes = await Promise.all(
      Array.from({ length: 8 }, () =>
        createPgCheckStore(db, id).createCheck(first.reportId),
      ),
    );
    expect(outcomes.filter((r) => r.ok)).toHaveLength(1);
    expect(outcomes.filter((r) => !r.ok)).toEqual(
      Array.from({ length: 7 }, () => ({
        ok: false,
        error: "already-running",
      })),
    );
    expect(await guestChecksRemaining(db, id)).toBe(1);
    const rows = await db
      .select()
      .from(checks)
      .where(eq(checks.reportId, first.reportId));
    expect(rows).toHaveLength(2);
    const current = rows.find((row) => row.id !== first.checkId);
    if (!current) throw new Error("Missing new check");
    await db
      .update(checks)
      .set({ status: "completed" })
      .where(eq(checks.id, current.id));
    expect(
      await createPgCheckStore(db, id).createCheck(first.reportId),
    ).toMatchObject({ ok: false, error: "check-cooldown" });
  });

  it("rolls back a failed source replacement and does not start a new cooldown", async () => {
    const id = randomUUID();
    const first = await createGuestReport(db, input, new Date(), id);
    const old = new Date(Date.now() - 61_000);
    await db
      .update(checks)
      .set({ status: "completed", startedAt: old })
      .where(eq(checks.id, first.checkId));
    await expect(
      createPgCheckStore(db, id).createCheck(
        first.reportId,
        { ...input.input, name: "rollback" },
        {
          source: "invalid" as "paste",
          repoUrl: null,
        },
      ),
    ).rejects.toThrow();
    expect(await guestChecksRemaining(db, id)).toBe(2);
    expect(
      (await db.select().from(reports).where(eq(reports.id, first.reportId)))[0]
        ?.name,
    ).toBe("quota-test");
    expect(
      (await db.select().from(checks).where(eq(checks.id, first.checkId)))[0]
        ?.startedAt,
    ).toEqual(old);
    expect(
      (await createPgCheckStore(db, id).createCheck(first.reportId)).ok,
    ).toBe(true);
  });
});
