import { timingSafeEqual } from "node:crypto";
import { getDb } from "@/server/db/client";
import {
  deleteExpiredApiCache,
  deleteExpiredGuestReports,
} from "@/server/db/cleanup";
import { seedDemo } from "@/server/db/demo";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    console.error("[cron] CRON_SECRET is not set, refusing the request");
    return false;
  }
  const given = Buffer.from(request.headers.get("authorization") ?? "");
  const expected = Buffer.from(`Bearer ${secret}`);
  // timingSafeEqual throws on different lengths; the length itself isn't secret.
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Daily job (decisions 11, 51), called by `.github/workflows/daily.yml`.
 * The steps don't depend on each other, so one failing still lets the rest
 * run; any failure answers 500 so the workflow run turns red.
 */
export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return new Response(null, { status: 401 });
  }

  const db = getDb();
  const now = new Date();
  const failed: string[] = [];
  async function step<T>(name: string, run: () => Promise<T>) {
    try {
      return await run();
    } catch (error) {
      console.error(`[cron] ${name} failed`, error);
      failed.push(name);
      return undefined;
    }
  }

  const [guestReports, apiCache] = await Promise.all([
    step("guestReports", () => deleteExpiredGuestReports(db, now)),
    step("apiCache", () => deleteExpiredApiCache(db, now)),
    step("demo", () => seedDemo(db, now)),
  ]);
  if (failed.length > 0) {
    return Response.json({ failed }, { status: 500 });
  }
  return Response.json({ guestReports, apiCache, demo: "reset" });
}
