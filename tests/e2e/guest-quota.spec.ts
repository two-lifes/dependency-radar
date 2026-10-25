import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { signInFixture } from "./fixtures";
import { testDatabase } from "../integration/database";
import { checks, guestQuotas } from "../../src/server/db/schema";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-real-ip": `quota-e2e-${randomUUID()}` });
});
const exhausted = "You've used all 3 guest checks in this browser.";
async function finished(page: Page) {
  await expect(
    page.getByRole("link", { name: /^Vulnerabilities \(\d+\)$/ }),
  ).toBeVisible({ timeout: 60_000 });
}
async function startPaste(
  page: Page,
  manifest = '{"dependencies":{"react":"^18.0.0"}}',
) {
  await page
    .getByRole("textbox", { name: "package.json contents" })
    .fill(manifest);
  await page.getByRole("button", { name: "Check dependencies" }).click();
  await expect(page).toHaveURL(/\/r\/[^/]+\/dependencies/);
  await finished(page);
}

async function lastAttempt(page: Page) {
  await page.goto("/");
  const id = (await page.context().cookies()).find(
    (c) => c.name === "radar-guest",
  )?.value;
  if (!id) throw new Error("Missing guest cookie");
  const { client, db } = testDatabase();
  try {
    await db.insert(guestQuotas).values({ id, used: 2 });
  } finally {
    await client.end();
  }
  await page.reload();
}

test("Cancel does not refund; Resume at zero completes the same check", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await lastAttempt(page);
  const prefix = randomUUID();
  const dependencies = Object.fromEntries(
    Array.from({ length: 50 }, (_, i) => [`resume-${prefix}-${i}`, "1.0.0"]),
  );
  await page.getByRole("textbox").fill(JSON.stringify({ dependencies }));
  await page.getByRole("button", { name: "Check dependencies" }).click();
  await expect(page).toHaveURL(/\/r\/[^/]+\/dependencies/);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByText(exhausted)).toBeVisible();
  await page.getByRole("button", { name: "Resume", exact: true }).click();
  await finished(page);
  await expect(page.getByText(exhausted)).toBeVisible();
  const reportId = new URL(page.url()).pathname.split("/")[2];
  if (!reportId) throw new Error("Missing report");
  const { client, db } = testDatabase();
  try {
    await expect
      .poll(
        async () => {
          const rows = await db
            .select()
            .from(checks)
            .where(eq(checks.reportId, reportId));
          expect(rows).toHaveLength(1);
          return rows[0]?.status;
        },
        { timeout: 30_000 },
      )
      .toBe("completed");
  } finally {
    await client.end();
  }
});

test("package failures do not refund and Retry failed remains available at zero", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await lastAttempt(page);
  await startPaste(
    page,
    JSON.stringify({
      dependencies: { react: "^18.0.0", [`fail-${randomUUID()}`]: "1.0.0" },
    }),
  );
  await expect(page.getByText(exhausted)).toBeVisible();
  await page.getByRole("button", { name: "Retry failed", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry failed", exact: true }),
  ).toBeEnabled({ timeout: 30_000 });
  const reportId = new URL(page.url()).pathname.split("/")[2];
  if (!reportId) throw new Error("Missing report");
  const { client, db } = testDatabase();
  try {
    expect(
      await db.select().from(checks).where(eq(checks.reportId, reportId)),
    ).toHaveLength(1);
  } finally {
    await client.end();
  }
});

test("three launches of one repository, fourth refused, return visits and a different browser", async ({
  page,
  browser,
}) => {
  await page.goto("/");
  await expect(page.getByText("3 guest checks remaining")).toBeVisible();
  await page.getByRole("tab", { name: "GitHub URL" }).click();
  await page
    .getByRole("textbox", { name: "Repository URL" })
    .fill("https://github.com/quota-test/repo");
  await page.getByRole("button", { name: "Check dependencies" }).click();
  await expect(page).toHaveURL(/\/r\/[^/]+\/dependencies/);
  await finished(page);
  test.setTimeout(220_000);
  for (const remaining of [1, 0]) {
    await expect(
      page.getByRole("button", { name: "Check again", exact: true }),
    ).toBeEnabled({ timeout: 65_000 });
    await page
      .getByRole("button", { name: "Check again", exact: true })
      .click();
    await expect(
      page.getByText(remaining ? "1 guest check remaining" : exhausted),
    ).toBeVisible();
    await finished(page);
  }
  const report = page.url();
  await expect(
    page.getByRole("button", { name: "Check again", exact: true }),
  ).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByText(exhausted)).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Continue with GitHub" }),
  ).toBeVisible();
  const other = await browser.newContext({
    extraHTTPHeaders: { "x-real-ip": `quota-other-${randomUUID()}` },
  });
  try {
    const otherPage = await other.newPage();
    await otherPage.goto(report);
    await expect(otherPage.getByText("3 guest checks remaining")).toBeVisible();
    await expect(
      otherPage.getByRole("button", { name: "Check again", exact: true }),
    ).toBeEnabled({ timeout: 65_000 });
    await otherPage
      .getByRole("button", { name: "Check again", exact: true })
      .click();
    await expect(otherPage.getByText("2 guest checks remaining")).toBeVisible();
  } finally {
    await other.close();
  }
  await page.goto(report);
  await expect(page.getByText(exhausted)).toBeVisible();
});

test("Paste, Upload and sample share a quota; invalid input and missing repository are free", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("textbox").fill("{");
  await page.getByRole("button", { name: "Check dependencies" }).click();
  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page.getByText("3 guest checks remaining")).toBeVisible();
  await page.getByRole("tab", { name: "GitHub URL" }).click();
  await page
    .getByRole("textbox", { name: "Repository URL" })
    .fill("https://github.com/quota-test/missing");
  await page.getByRole("button", { name: "Check dependencies" }).click();
  await expect(
    page.getByText("Repository not found or private."),
  ).toBeVisible();
  await expect(page.getByText("3 guest checks remaining")).toBeVisible();
  await page.getByRole("tab", { name: "Paste", exact: true }).click();
  await startPaste(page);
  await page.goto("/");
  await page.getByRole("tab", { name: "Upload file" }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: "package.json",
    mimeType: "application/json",
    buffer: Buffer.from('{"dependencies":{"lodash":"^4.17.20"}}'),
  });
  await page.getByRole("button", { name: "Check dependencies" }).click();
  await expect(page).toHaveURL(/\/r\/[^/]+\/dependencies/);
  await finished(page);
  await page.goto("/");
  await page.getByRole("button", { name: "or try a sample project" }).click();
  await expect(page.getByText("1 guest check remaining")).toBeVisible();
  await page.getByRole("button", { name: "Check dependencies" }).click();
  await expect(page).toHaveURL(/\/r\/[^/]+\/dependencies/);
  await expect(page.getByText(exhausted)).toBeVisible();
  await finished(page);
});

test("two initially empty tabs establish a shared cookie before either launches", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await Promise.all([page.goto("/"), other.goto("/")]);
  await Promise.all([
    page.getByRole("button", { name: "Check dependencies" }).waitFor(),
    other.getByRole("button", { name: "Check dependencies" }).waitFor(),
  ]);
  await startPaste(page);
  await other.bringToFront();
  await other.reload();
  await expect(other.getByText("2 guest checks remaining")).toBeVisible();
});

test("GitHub CTA preserves query; mocked sign-in bypasses quota and sign-out restores it", async ({
  page,
  context,
}) => {
  await page.goto("/?source=github");
  const id = (await context.cookies()).find(
    (c) => c.name === "radar-guest",
  )?.value;
  expect(id).toBeTruthy();
  const { client, db } = testDatabase();
  try {
    if (!id) throw new Error("No browser identity");
    await db
      .insert(guestQuotas)
      .values({ id, used: 3 })
      .onConflictDoUpdate({ target: guestQuotas.id, set: { used: 3 } });
  } finally {
    await client.end();
  }
  await page.reload();
  await page.route("**/api/auth/sign-in/social", async (route) => {
    const body = route.request().postDataJSON();
    expect(body.callbackURL).toBe("/?source=github");
    await signInFixture(context);
    await route.fulfill({
      json: { url: "http://localhost:3000/?source=github", redirect: true },
    });
  });
  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  await expect(page.getByRole("link", { name: "Dashboard" })).toBeVisible();
  await expect(page).toHaveURL("/?source=github");
  await startPaste(page);
  const report = page.url();
  const response = await context.request.post("/api/auth/sign-out", {
    data: {},
    headers: { origin: "http://localhost:3000" },
  });
  expect(response.ok()).toBe(true);
  await page.goto(report);
  await expect(page.getByText(exhausted)).toBeVisible();
  const check = testDatabase();
  try {
    const [row] = await check.db
      .select()
      .from(guestQuotas)
      .where(eq(guestQuotas.id, id ?? ""));
    expect(row?.used).toBe(3);
  } finally {
    await check.client.end();
  }
});
