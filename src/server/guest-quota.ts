import { cookies } from "next/headers";
import { GUEST_COOKIE, validGuestId } from "@/lib/guest-cookie";
import { getOptionalSession } from "./auth/session";
import { getDb } from "./db/client";
import { guestChecksRemaining, GuestQuotaExhausted } from "./db/guest-quota";

export type GuestQuotaState =
  | { kind: "account" }
  | { kind: "guest"; remaining: number }
  | { kind: "error" };

export async function guestQuotaContext(): Promise<{
  guestId?: string;
  remaining?: number;
}> {
  if (await getOptionalSession()) return {};
  const id = (await cookies()).get(GUEST_COOKIE)?.value;
  // Never mint an identity during a launch: parallel initial POSTs must not
  // each receive a new allowance. The page response establishes the cookie.
  if (!validGuestId(id)) throw new Error("Guest identity is unavailable");
  return { guestId: id, remaining: await guestChecksRemaining(getDb(), id) };
}

export async function prepareGuestLaunch(): Promise<string | undefined> {
  const context = await guestQuotaContext();
  if (context.remaining === 0) throw new GuestQuotaExhausted();
  return context.guestId;
}

export async function readGuestQuota(): Promise<GuestQuotaState> {
  try {
    const { guestId, remaining } = await guestQuotaContext();
    return guestId && remaining !== undefined
      ? { kind: "guest", remaining }
      : { kind: "account" };
  } catch (error) {
    console.error("[guest-quota] couldn't read quota", error);
    return { kind: "error" };
  }
}
