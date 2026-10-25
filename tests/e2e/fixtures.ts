import { createHmac, randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";
import { testDatabase } from "../integration/database";
import {
  checks,
  projects,
  reports,
  session,
  user,
} from "../../src/server/db/schema";

/** Seed signed sessions only in the explicitly selected disposable database. */
export async function signInFixture(context: BrowserContext, demo = false) {
  const secret = process.env.BETTER_AUTH_SECRET;
  if (!secret) throw new Error("BETTER_AUTH_SECRET must match the test server");
  const { client, db } = testDatabase();
  const userId = demo ? "demo" : randomUUID();
  const sessionId = randomUUID();
  const token = randomUUID();
  try {
    await db
      .insert(user)
      .values({
        id: userId,
        name: "Quota tester",
        email: `${userId}@example.invalid`,
      })
      .onConflictDoNothing();
    await db
      .insert(session)
      .values({
        id: sessionId,
        userId,
        token,
        expiresAt: new Date(Date.now() + 3600_000),
      });
    // Better Call's installed cookie format: URL-encoded token.HMAC-SHA256(base64).
    const signature = createHmac("sha256", secret)
      .update(token)
      .digest("base64");
    await context.addCookies([
      {
        name: "better-auth.session_token",
        value: encodeURIComponent(`${token}.${signature}`),
        url: "http://localhost:3000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    return { userId, sessionId };
  } finally {
    await client.end();
  }
}

export async function historicalProject(sessionId: string | null) {
  const { client, db } = testDatabase();
  const projectId = randomUUID(),
    reportId = randomUUID(),
    checkId = randomUUID();
  try {
    await db
      .insert(projects)
      .values({
        id: projectId,
        ownerId: "demo",
        demoSessionId: sessionId,
        name: "Historical demo",
      });
    await db
      .insert(reports)
      .values({
        id: reportId,
        projectId,
        source: "paste",
        name: "Historical demo",
        dependencies: [],
        packageManager: "npm",
      });
    await db.insert(checks).values({ id: checkId, reportId, totalPackages: 0 });
    return { projectId, reportId, checkId };
  } finally {
    await client.end();
  }
}
