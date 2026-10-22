import { expect, test } from "@playwright/test";

// Needs the database: `/demo` seeds the demo account if it is missing.

test.describe("demo", () => {
  test("one click opens the demo projects", async ({ page }) => {
    await page.goto("/");
    await page.getByRole("link", { name: "Try demo" }).click();

    await expect(page).toHaveURL("/projects");
    for (const name of [
      "shop-frontend",
      "admin-dashboard",
      "marketing-site",
      "legacy-widget",
    ]) {
      await expect(page.getByRole("link", { name })).toBeVisible();
    }
    await expect(
      page.getByRole("link", { name: "Import from GitHub" }),
    ).toHaveCount(0);
  });

  test("the banner stays closed for the session", async ({ page }) => {
    await page.goto("/demo");
    const banner = page.getByRole("region", { name: "Demo notice" });
    await expect(banner).toContainText(
      "You're exploring a demo. Data resets daily.",
    );

    await page.getByRole("button", { name: "Dismiss demo notice" }).click();
    await expect(banner).toHaveCount(0);
    await page.goto("/settings/profile");
    await expect(page.getByRole("heading", { name: "Profile" })).toBeVisible();
    await expect(banner).toHaveCount(0);
  });

  test("the seeded projects and the profile are read-only", async ({
    page,
  }) => {
    await page.goto("/demo");
    await page
      .getByRole("button", { name: "Actions for shop-frontend" })
      .click();
    await expect(
      page.getByRole("menuitem", { name: /Delete/ }),
    ).toHaveAttribute("data-disabled");
    await page.getByRole("menuitem", { name: "Settings" }).click();

    await expect(
      page.getByRole("heading", { name: "Project settings" }),
    ).toBeVisible();
    await expect(page.getByLabel("Project name")).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Replace source" }),
    ).toBeDisabled();
    await expect(
      page.getByRole("button", { name: "Delete project" }),
    ).toBeDisabled();

    await page.goto("/settings/profile");
    await expect(page.getByLabel("Name")).toBeDisabled();
  });

  test("a project made in one demo session is that session's only", async ({
    page,
    browser,
  }) => {
    const name = `session-shop-${Date.now()}`;
    await page.goto("/demo");
    await page.goto("/projects/new");
    await page.getByLabel("Project name").fill(name);
    await page
      .getByLabel("package.json contents")
      .fill('{"dependencies":{"react":"^19.0.0"}}');
    await page.getByRole("button", { name: "Create & check" }).click();
    await expect(page).toHaveURL(/\/projects\/[0-9a-f-]{36}\/dependencies$/);
    const projectPath = new URL(page.url()).pathname.replace(
      /\/dependencies$/,
      "",
    );

    const other = await browser.newContext();
    try {
      const otherPage = await other.newPage();
      await otherPage.goto("/demo");
      await expect(
        otherPage.getByRole("link", { name: "shop-frontend" }),
      ).toBeVisible();
      await expect(otherPage.getByRole("link", { name })).toHaveCount(0);
      const response = await otherPage.goto(`${projectPath}/settings`);
      expect(response?.status()).toBe(404);
    } finally {
      await other.close();
    }

    await page.goto(`${projectPath}/settings`);
    await page.getByRole("button", { name: "Delete project" }).click();
    await page.getByLabel(`Type ${name} to confirm`).fill(name);
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Delete project" })
      .click();
    await expect(page).toHaveURL("/projects");
    await expect(page.getByRole("link", { name })).toHaveCount(0);
  });
});
