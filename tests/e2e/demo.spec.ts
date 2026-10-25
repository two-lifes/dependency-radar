import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { historicalProject, signInFixture } from "./fixtures";
import { testDatabase } from "../integration/database";
import { eq } from "drizzle-orm";
import { projects } from "../../src/server/db/schema";

test("cron cleans only expired data and leaves historical demo projects", async ({
  context,
}) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) throw new Error("Set CRON_SECRET for the local test server");
  const { sessionId } = await signInFixture(context, true);
  const fixture = await historicalProject(sessionId);
  expect((await context.request.post("/api/cron/daily")).status()).toBe(401);
  const response = await context.request.post("/api/cron/daily", {
    headers: { authorization: `Bearer ${secret}` },
  });
  expect(response.status()).toBe(200);
  expect(await response.json()).toEqual({
    guestReports: expect.any(Number),
    apiCache: expect.any(Number),
  });
  const { client, db } = testDatabase();
  try {
    expect(
      await db
        .select()
        .from(projects)
        .where(eq(projects.id, fixture.projectId)),
    ).toHaveLength(1);
  } finally {
    await client.end();
  }
});

test("demo entry points are closed without creating a session", async ({
  page,
  context,
}) => {
  const response = await page.goto("/demo");
  expect(response?.status()).toBe(404);
  expect(
    (await context.cookies()).some((c) => c.name.includes("session_token")),
  ).toBe(false);
  await page.goto("/");
  await expect(page.locator('a[href="/demo"]')).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Demo notice" })).toHaveCount(
    0,
  );
});

test("old demo cookies cannot open either kind of project, report or stream", async ({
  page,
  context,
}) => {
  const { sessionId } = await signInFixture(context, true);
  for (const ownerSession of [null, sessionId]) {
    const fixture = await historicalProject(ownerSession);
    await page.goto(`/projects/${fixture.projectId}/settings`);
    await expect(page).toHaveURL(/\/login\?next=/);
    const report = await page.goto(`/r/${fixture.reportId}/dependencies`);
    expect(report?.status()).toBe(404);
    const stream = await context.request.get(
      `/api/checks/${fixture.checkId}/events`,
    );
    expect(stream.status()).toBe(404);
  }
  await page.goto("/settings/profile");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/");
  await expect(page.getByText("3 guest checks remaining")).toBeVisible();
  await expect(page.getByRole("link", { name: "Dashboard" })).toHaveCount(0);
});

test("old demo auth endpoints deny mutation, retain ordinary login and sign-out", async ({
  context,
}) => {
  await signInFixture(context, true);
  const headers = {
    origin: "http://localhost:3000",
    "x-real-ip": `demo-test-${randomUUID()}`,
  };
  for (const path of ["list-sessions", "list-accounts"]) {
    expect(
      (await context.request.get(`/api/auth/${path}`, { headers })).status(),
    ).toBe(403);
  }
  for (const [path, data] of [
    ["update-user", { name: "blocked" }],
    ["delete-user", {}],
    ["revoke-sessions", {}],
  ] as const) {
    expect(
      (
        await context.request.post(`/api/auth/${path}`, { data, headers })
      ).status(),
    ).toBe(403);
  }
  const email = `demo-login-${randomUUID()}@example.invalid`;
  for (let i = 0; i < 3; i++)
    expect(
      (
        await context.request.post("/api/auth/sign-in/magic-link", {
          data: { email },
          headers,
        })
      ).ok(),
    ).toBe(true);
  expect(
    (
      await context.request.post("/api/auth/sign-in/magic-link", {
        data: { email },
        headers,
      })
    ).status(),
  ).toBe(429);
  expect(
    (
      await context.request.post("/api/auth/sign-out", { data: {}, headers })
    ).ok(),
  ).toBe(true);
});
