import { expect, test } from "@playwright/test";

// Needs the database (Better Auth stores the link token) and MOCK_EXTERNAL=1,
// so the link goes to the server log instead of Resend.

test.describe("sign-in", () => {
  test("a guest is sent to sign-in and back", async ({ page }) => {
    await page.goto("/settings/profile");
    await expect(page).toHaveURL("/login?next=%2Fsettings%2Fprofile");
    await expect(
      page.getByRole("heading", {
        level: 1,
        name: "Sign in to Dependency Radar",
      }),
    ).toBeVisible();
  });

  test("an invalid email stays on the form", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("textbox", { name: "Email" }).fill("not-an-email");
    await page.getByRole("button", { name: "Send sign-in link" }).click();
    await expect(page.getByText("Enter a valid email address.")).toBeVisible();
    await expect(page.getByRole("textbox", { name: "Email" })).toBeFocused();
  });

  test("an email link leads to check-email", async ({ page }) => {
    await page.goto("/login?next=%2Fr%2Fabc%2Fsave");
    await expect(page.getByText("Sign in to save your report.")).toBeVisible();
    await page.getByRole("textbox", { name: "Email" }).fill("e2e@example.com");
    await page.getByRole("button", { name: "Send sign-in link" }).click();

    await expect(page).toHaveURL(
      "/login/check-email?email=e2e%40example.com&next=%2Fr%2Fabc%2Fsave",
    );
    await expect(page.getByText("e2e@example.com")).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^Resend link \(\d+s\)$/ }),
    ).toBeDisabled();
    await page.getByRole("link", { name: "Use a different email" }).click();
    await expect(page).toHaveURL("/login?next=%2Fr%2Fabc%2Fsave");
  });

  test("a dead email link shows the expired message", async ({ page }) => {
    await page.goto(
      "/api/auth/magic-link/verify?token=unknown&callbackURL=%2Fprojects&errorCallbackURL=%2Flogin%3Freason%3Dlink-expired",
    );
    await expect(page).toHaveURL(/\/login\?reason=link-expired/);
    await expect(page.getByRole("alert")).toHaveText(
      "This link has expired. Request a new one.",
    );
  });
});
