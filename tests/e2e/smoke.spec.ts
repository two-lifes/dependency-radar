import { expect, test } from "@playwright/test";
import { THEME_STORAGE_KEY } from "../../src/lib/theme";

test.describe("home page", () => {
  test("renders the heading", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle("Dependency Radar");
    await expect(
      page.getByRole("heading", { level: 1, name: "Dependency Radar" }),
    ).toBeVisible();
  });

  test.describe("dark system theme", () => {
    test.use({ colorScheme: "dark" });

    test("applies dark tokens", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("html")).toHaveClass(/\bdark\b/);
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(10, 10, 10)",
      );
    });

    test("an explicit light preference wins", async ({ page }) => {
      await page.addInitScript(
        (key) => window.localStorage.setItem(key, "light"),
        THEME_STORAGE_KEY,
      );
      await page.goto("/");
      await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(255, 255, 255)",
      );
    });
  });

  test.describe("light system theme", () => {
    test.use({ colorScheme: "light" });

    test("applies light tokens", async ({ page }) => {
      await page.goto("/");
      await expect(page.locator("html")).not.toHaveClass(/\bdark\b/);
      await expect(page.locator("body")).toHaveCSS(
        "background-color",
        "rgb(255, 255, 255)",
      );
    });
  });
});
