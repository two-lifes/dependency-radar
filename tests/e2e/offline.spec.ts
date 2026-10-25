import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";
import { signInFixture } from "./fixtures";

const offline = "You're offline. Showing last loaded data.";
const failed =
  "Couldn't complete the request. Check your connection and try again.";
const manifest = '{"name":"offline-shop","dependencies":{"react":"^18.0.0"}}';

test.beforeEach(async ({ page }) => {
  await page.setExtraHTTPHeaders({ "x-real-ip": `offline-${randomUUID()}` });
});

test("offline keeps input and local sample, blocks submit and never launches on reconnect", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(page.getByText("3 guest checks remaining")).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText(offline)).toBeVisible();
  const submit = page.getByRole("button", { name: "Check dependencies" });
  await expect(submit).toBeDisabled();
  await expect(submit).toHaveAttribute(
    "aria-description",
    "Requires an internet connection.",
  );
  await page.getByRole("button", { name: "or try a sample project" }).click();
  const field = page.getByRole("textbox", { name: "package.json contents" });
  await expect(field).not.toHaveValue("");
  await field.fill(manifest);
  await page
    .getByRole("form")
    .evaluate((form: HTMLFormElement) => form.requestSubmit());
  await expect(field).toHaveValue(manifest);
  await context.setOffline(false);
  await expect(page.getByText(offline)).toBeHidden();
  await expect(submit).toBeEnabled();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByText("3 guest checks remaining")).toBeVisible();
  await submit.click();
  await expect(page).toHaveURL(/\/r\/[^/]+\/dependencies/);
  await expect(page.getByText("2 guest checks remaining")).toBeVisible();
});

test("a rejected action keeps input and Retry creates the report only once", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "package.json contents" })
    .fill(manifest);
  let aborted = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (
      !aborted &&
      request.headers()["next-action"] &&
      request.postData()?.includes("offline-shop")
    ) {
      aborted = true;
      await route.abort("connectionreset");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Check dependencies" }).click();
  await expect(page.getByText(failed)).toBeVisible();
  await expect(
    page.getByRole("textbox", { name: "package.json contents" }),
  ).toHaveValue(manifest);
  await expect(page.getByText("3 guest checks remaining")).toBeVisible();
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page).toHaveURL(/\/r\/[^/]+\/dependencies/);
  await expect(page.getByText("2 guest checks remaining")).toBeVisible();
});

test("loaded report survives offline and reconnect without a new check", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page
    .getByRole("textbox", { name: "package.json contents" })
    .fill(manifest);
  await page.getByRole("button", { name: "Check dependencies" }).click();
  await expect(page).toHaveURL(/\/r\/[^/]+\/dependencies/);
  await expect(
    page.getByRole("link", { name: /^Vulnerabilities \(\d+\)$/ }),
  ).toBeVisible();
  await context.setOffline(true);
  await expect(page.getByText(offline)).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "offline-shop" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /^Check again/ }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Copy link", exact: true }),
  ).toBeEnabled();
  await expect(
    page.getByRole("link", { name: "Save project", exact: true }),
  ).toHaveAttribute("aria-disabled", "true");
  await context.setOffline(false);
  await expect(page.getByText(offline)).toBeHidden();
  await expect(page.getByText("2 guest checks remaining")).toBeVisible();
});

test("profile preserves edits offline and lets a rejected save retry manually", async ({
  page,
  context,
}) => {
  await signInFixture(context);
  await page.goto("/settings/profile");
  const field = page.getByRole("textbox", { name: "Name", exact: true });
  await expect(field).toHaveValue("Quota tester");
  await field.fill("Offline editor");
  await context.setOffline(true);
  await expect(
    page.getByRole("button", { name: "Save", exact: true }),
  ).toBeDisabled();
  await field.press("Enter");
  await expect(field).toHaveValue("Offline editor");
  await context.setOffline(false);
  let aborted = false;
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (
      !aborted &&
      request.headers()["next-action"] &&
      request.postData()?.includes("Offline editor")
    ) {
      aborted = true;
      await route.abort("connectionreset");
    } else await route.continue();
  });
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Retry", exact: true }),
  ).toBeVisible();
  await expect(field).toHaveValue("Offline editor");
  await page.getByRole("button", { name: "Retry", exact: true }).click();
  await expect(page.getByText("Name saved", { exact: true })).toBeVisible();
  await page.reload();
  await expect(field).toHaveValue("Offline editor");
});
