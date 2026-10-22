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
});
