import { and, eq, lt, sql } from "drizzle-orm";
import type { Db } from "./client";
import { guestQuotas } from "./schema";

type Transaction = Parameters<Parameters<Db["transaction"]>[0]>[0];

export class GuestQuotaExhausted extends Error {
  constructor() {
    super("guest-quota-exhausted");
  }
}

export async function guestChecksRemaining(
  db: Db,
  id: string,
): Promise<number> {
  const [row] = await db
    .select({ used: guestQuotas.used })
    .from(guestQuotas)
    .where(eq(guestQuotas.id, id));
  return 3 - (row?.used ?? 0);
}

/** Must share the check's transaction: any later refusal rolls this back. */
export async function consumeGuestQuota(
  tx: Transaction,
  id: string,
): Promise<number> {
  await tx.insert(guestQuotas).values({ id }).onConflictDoNothing();
  const [row] = await tx
    .update(guestQuotas)
    .set({ used: sql`${guestQuotas.used} + 1` })
    .where(and(eq(guestQuotas.id, id), lt(guestQuotas.used, 3)))
    .returning({ used: guestQuotas.used });
  if (!row) throw new GuestQuotaExhausted();
  return 3 - row.used;
}
