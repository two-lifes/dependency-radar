import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { eq } from "drizzle-orm";
import { testDatabase } from "../integration/database";
import { checks } from "../../src/server/db/schema";
import { signInFixture } from "./fixtures";

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-real-ip": `cooldown-${randomUUID()}` });
});

async function start(page: Page) {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "package.json contents" })
    .fill('{"name":"cooldown-shop","dependencies":{"react":"^18.0.0"}}');
  await page.getByRole("button", { name: "Check dependencies" }).click();
  await expect(page).toHaveURL(/\/r\/[^/]+\/dependencies/);
  await finished(page);
}

async function finished(page: Page) {
  await expect(
    page.getByRole("link", { name: /^Vulnerabilities \(\d+\)$/ }),
  ).toBeVisible();
}

test("two tabs keep the pause after reload; a stale action cannot spend another attempt", async ({
  page,
  context,
}) => {
  test.setTimeout(95_000);
  await start(page);
  await expect(
    page.getByRole("button", { name: /Check again in \d+s/ }),
  ).toBeDisabled();
  const other = await context.newPage();
  await other.goto(page.url());
  await expect(
    other.getByRole("button", { name: /Check again in \d+s/ }),
  ).toBeDisabled();
  await page.reload();
  await expect(page.getByText("2 guest checks remaining")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Check again in \d+s/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Check again", exact: true }),
  ).toBeEnabled({ timeout: 65_000 });
  // Expiry alone must not start another check.
  await expect(page.getByText("2 guest checks remaining")).toBeVisible();
  const reportId = new URL(page.url()).pathname.split("/")[2];
  if (!reportId) throw new Error("Missing report id");
  const requestPromise = page.waitForRequest(
    (r) =>
      r.method() === "POST" &&
      !!r.headers()["next-action"] &&
      !!r.postData()?.includes(reportId),
  );
  await page.getByRole("button", { name: "Check again", exact: true }).click();
  const request = await requestPromise;
  await finished(page);
  await expect(page.getByText("1 guest check remaining")).toBeVisible();
  // Previous result tabs stay visible while a repeat check is still running.
  const database = testDatabase();
  try {
    await expect
      .poll(async () => {
        const rows = await database.db
          .select()
          .from(checks)
          .where(eq(checks.reportId, reportId));
        return (
          rows.length === 2 && rows.every((row) => row.status !== "running")
        );
      })
      .toBe(true);
  } finally {
    await database.client.end();
  }
  const action = request.headers()["next-action"];
  const body = request.postData();
  if (!action || !body) throw new Error("Missing action request");
  const response = await context.request.post(request.url(), {
    headers: {
      "next-action": action,
      "content-type":
        request.headers()["content-type"] ?? "text/plain;charset=UTF-8",
    },
    data: body,
  });
  expect(await response.text()).toContain("check-cooldown");
  await other.reload();
  await expect(other.getByText("1 guest check remaining")).toBeVisible();
  await expect(
    other.getByRole("button", { name: /Check again in \d+s/ }),
  ).toBeDisabled();
});

test("sign-in, saving and sign-out preserve the pause; dashboard and Replace source respect it", async ({
  page,
  context,
}) => {
  test.setTimeout(95_000);
  await start(page);
  const guestUrl = page.url();
  await signInFixture(context);
  await page.reload();
  await expect(
    page.getByRole("button", { name: /Check again in \d+s/ }),
  ).toBeDisabled();
  const signOut = await context.request.post("/api/auth/sign-out", {
    data: {},
    headers: { origin: "http://localhost:3000" },
  });
  expect(signOut.ok()).toBe(true);
  await page.goto(guestUrl);
  await expect(page.getByText("2 guest checks remaining")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Check again in \d+s/ }),
  ).toBeDisabled();
  await signInFixture(context);
  await page.reload();
  await page.getByRole("button", { name: "Save project", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/dependencies/);
  const savedUrl = new URL(page.url());
  const reportUrl = `${savedUrl.origin}${savedUrl.pathname}`;
  await page.goto("/projects");
  await page.getByRole("button", { name: "Actions for cooldown-shop" }).click();
  await expect(
    page.getByRole("menuitem", { name: /Check now in \d+s/ }),
  ).toHaveAttribute("aria-disabled", "true");
  await page.goto(reportUrl.replace("/dependencies", "/settings"));
  await page
    .getByRole("button", { name: "Replace source", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "package.json contents" })
    .fill('{"dependencies":{"zod":"^3.0.0"}}');
  await expect(
    page
      .getByRole("form", { name: "Replace source" })
      .getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await expect(page.getByRole("status")).toHaveText(/Try again in \d+s\./);
  await expect(
    page
      .getByRole("form", { name: "Replace source" })
      .getByRole("button", { name: "Save", exact: true }),
  ).toBeEnabled({ timeout: 65_000 });
  await page
    .getByRole("form", { name: "Replace source" })
    .getByRole("button", { name: "Save", exact: true })
    .click();
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Replace & check" })
    .click();
  await expect(page).toHaveURL(reportUrl);
  await finished(page);
  await expect(
    page.getByRole("button", { name: /Check again in \d+s/ }),
  ).toBeDisabled();
});
