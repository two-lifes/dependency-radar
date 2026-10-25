import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import {
  checks,
  checkPackages,
  projects,
  reports,
} from "../../src/server/db/schema";
import { testDatabase } from "../integration/database";
import { signInFixture } from "./fixtures";

// Run at the stage F gate with the existing disposable PostgreSQL database
// and MOCK_EXTERNAL=1. Layout/focus cannot be verified in jsdom.
const longName = `@mobile/${"dependency".repeat(12)}`;
const longVersion = `1.0.0+${"metadata".repeat(20)}`;
const projectName = "project".repeat(8);
const repoUrl = `https://github.com/${"owner".repeat(7)}/${"repository".repeat(10)}`;
const longEmail = `${"a".repeat(60)}@${"b".repeat(60)}.example.com`;

async function reportFixture(
  status: "completed" | "partial" | "failed" | "running" = "completed",
  ownerId?: string,
) {
  const { db, client } = testDatabase();
  const reportId = randomUUID();
  const checkId = randomUUID();
  const projectId = ownerId ? randomUUID() : null;
  const dependencies = [longName, "zod"].map((name) => ({
    name,
    specifier: "^1.0.0",
    type: "prod" as const,
  }));
  try {
    if (ownerId && projectId) {
      await db
        .insert(projects)
        .values({ id: projectId, ownerId, name: projectName });
    }
    await db.insert(reports).values({
      id: reportId,
      projectId,
      expiresAt: projectId ? null : new Date(Date.now() + 86400_000),
      name: projectName,
      source: "github",
      repoUrl,
      dependencies,
      packageManager: "npm",
    });
    await db.insert(checks).values({
      id: checkId,
      reportId,
      status,
      totalPackages: dependencies.length,
      startedAt: new Date(Date.now() - 120_000),
      finishedAt: status === "running" ? null : new Date(),
      failureReason: status === "failed" ? "internal-error" : null,
      score: status === "completed" ? 45 : null,
      vulnerabilityCount: 1,
      severeVulnerableCount: 1,
    });
    if (status !== "running" && status !== "failed") {
      await db.insert(checkPackages).values({
        checkId,
        name: longName,
        type: "prod",
        specifier: "^1.0.0",
        checked: true,
        registryName: "react",
        current: longVersion,
        latest: `2.0.0+${"metadata".repeat(20)}`,
        lagKind: "major",
        lagMajors: 1,
        status: "active",
        vulnerabilities: [
          {
            ids: ["GHSA-p6mc-m468-83gw"],
            primaryId: "GHSA-p6mc-m468-83gw",
            severity: "high",
            summary: "Long content regression",
            details: `Details: https://example.com/${"details".repeat(40)}`,
            fixedIn: `2.0.0+${"fixed".repeat(40)}`,
          },
        ],
      });
      await db.insert(checkPackages).values({
        checkId,
        name: "zod",
        type: "prod",
        specifier: "^1.0.0",
        checked: status !== "partial",
        reason: status === "partial" ? "registry-unavailable" : null,
        registryName: "zod",
        current: status === "partial" ? null : "1.0.0",
        latest: status === "partial" ? null : "4.1.12",
        lagKind: status === "partial" ? null : "major",
        lagMajors: status === "partial" ? null : 3,
        status: status === "partial" ? null : "active",
      });
    }
    return {
      basePath: projectId ? `/projects/${projectId}` : `/r/${reportId}`,
      projectId,
    };
  } finally {
    await client.end();
  }
}

async function noPageOverflow(page: Page) {
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    )
    .toBeLessThanOrEqual(1);
}

async function insideViewport(locator: Locator) {
  const bounds = await locator.evaluate((element) => {
    const rect = element.getBoundingClientRect();
    return {
      left: rect.left,
      right: rect.right,
      top: rect.top,
      bottom: rect.bottom,
      width: innerWidth,
      height: innerHeight,
    };
  });
  expect(bounds.left).toBeGreaterThanOrEqual(-1);
  expect(bounds.right).toBeLessThanOrEqual(bounds.width + 1);
  expect(bounds.top).toBeGreaterThanOrEqual(-1);
  expect(bounds.bottom).toBeLessThanOrEqual(bounds.height + 1);
}

async function keyboardFocus(page: Page, locator: Locator) {
  // Navigate to the control through the browser's actual Tab order.
  for (let step = 0; step < 80; step++) {
    await page.keyboard.press("Tab");
    if (
      await locator.evaluate((element) => element === document.activeElement)
    ) {
      await expect(locator).toBeFocused();
      const outline = await locator.evaluate(
        (element) => getComputedStyle(element).outlineStyle,
      );
      expect(outline).not.toBe("none");
      return;
    }
  }
  throw new Error("Control is not reachable with Tab");
}

for (const colorScheme of ["light", "dark"] as const) {
  test.describe(`375px accessibility (${colorScheme})`, () => {
    test.use({ viewport: { width: 375, height: 667 }, colorScheme });

    test.beforeEach(async ({ page }) => {
      test.setTimeout(60_000);
      await page.setExtraHTTPHeaders({ "x-real-ip": `mobile-${randomUUID()}` });
    });

    test("landing, upload, sign-in, check-email and 404 fit the viewport", async ({
      page,
    }) => {
      await page.goto("/");
      await noPageOverflow(page);
      await keyboardFocus(
        page,
        page.getByRole("tab", { name: "Paste", exact: true }),
      );
      await page.keyboard.press("ArrowRight");
      await expect(
        page.getByRole("tab", { name: "Upload file" }),
      ).toBeFocused();
      await keyboardFocus(page, page.getByRole("button", { name: "browse" }));
      const chooser = page.waitForEvent("filechooser");
      await page.keyboard.press("Enter");
      await (
        await chooser
      ).setFiles({
        name: "package.json",
        mimeType: "application/json",
        buffer: Buffer.from('{"dependencies":{"react":"^18.0.0"}}'),
      });
      await expect(
        page.getByRole("button", { name: "Remove package.json" }),
      ).toBeVisible();
      await noPageOverflow(page);

      await page.goto("/login");
      const email = page.getByRole("textbox", { name: "Email", exact: true });
      await keyboardFocus(page, email);
      await page.keyboard.type("invalid-email");
      await page.keyboard.press("Enter");
      await expect(email).toBeFocused();
      await expect(email).toHaveAttribute("aria-invalid", "true");
      await noPageOverflow(page);
      await page.goto(
        `/login/check-email?email=${encodeURIComponent(longEmail)}`,
      );
      await expect(page.getByText(longEmail, { exact: true })).toBeVisible();
      await noPageOverflow(page);
      await page.goto("/mobile-missing-page");
      await expect(
        page.getByRole("heading", { name: "Page not found" }),
      ).toBeVisible();
      await keyboardFocus(page, page.getByRole("link", { name: "Go home" }));
      await noPageOverflow(page);
    });

    test("report cards, filters, selection, vulnerabilities and modal keyboard navigation", async ({
      page,
    }) => {
      const { basePath } = await reportFixture();
      await page.goto(`${basePath}/dependencies?sort=name`);
      await expect(
        page.getByRole("heading", { name: projectName, exact: true }),
      ).toBeVisible();
      await noPageOverflow(page);
      const tiles = page
        .getByRole("region", { name: "Health score", exact: true })
        .getByRole("listitem");
      await expect(tiles).toHaveCount(5);
      const tops = await tiles.evaluateAll((elements) =>
        elements.map((element) => element.getBoundingClientRect().top),
      );
      expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(1);

      const filters = page.getByRole("button", {
        name: "Filters",
        exact: true,
      });
      await keyboardFocus(page, filters);
      await page.keyboard.press("Enter");
      const sheet = page.getByRole("dialog", { name: "Filters", exact: true });
      const close = sheet.getByRole("button", { name: "Close", exact: true });
      await keyboardFocus(page, close);
      await page.keyboard.press("/");
      await expect(close).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(filters).toBeFocused();
      await page.keyboard.press("/");
      const search = page.getByRole("searchbox", { name: "Search packages" });
      await expect(search).toBeFocused();
      await page.keyboard.type("no-matching-package");
      await expect(
        page.getByText("No packages match these filters."),
      ).toBeVisible();
      await keyboardFocus(
        page,
        page.getByRole("button", { name: "Clear filters", exact: true }),
      );
      await page.keyboard.press("Enter");

      const cards = page.getByRole("list", { name: "Packages", exact: true });
      const checkbox = cards.getByRole("checkbox", {
        name: `Select ${longName}`,
        exact: true,
      });
      await keyboardFocus(page, checkbox);
      await page.keyboard.press("Space");
      await expect(checkbox).toBeChecked();
      await expect(
        page.getByRole("group", { name: "Selected packages" }),
      ).toBeVisible();
      await noPageOverflow(page);
      await keyboardFocus(
        page,
        page.getByRole("button", { name: "Clear selection", exact: true }),
      );
      await page.keyboard.press("Enter");

      const card = cards.getByRole("listitem").filter({ hasText: longName });
      await keyboardFocus(page, card);
      await page.keyboard.press("Enter");
      const dialog = page.getByRole("dialog");
      await expect(
        dialog.getByRole("heading", { name: longName, exact: true }),
      ).toBeVisible();
      await insideViewport(dialog);
      expect(
        await dialog.evaluate((element) =>
          [element, ...element.querySelectorAll<HTMLElement>("*")]
            .filter((child) =>
              ["auto", "scroll"].includes(getComputedStyle(child).overflowX),
            )
            .some((child) => child.scrollWidth > child.clientWidth + 1),
        ),
      ).toBe(false);
      await keyboardFocus(
        page,
        dialog.getByRole("button", { name: "Close", exact: true }),
      );
      await page.keyboard.press("Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
      await page.keyboard.press("Shift+Tab");
      expect(
        await dialog.evaluate((element) =>
          element.contains(document.activeElement),
        ),
      ).toBe(true);
      await page.keyboard.press("k");
      await expect(
        dialog.getByRole("heading", { name: "zod", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("j");
      await expect(
        dialog.getByRole("heading", { name: longName, exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(card).toBeFocused();
      await keyboardFocus(
        page,
        page.getByRole("link", { name: "Vulnerabilities (1)", exact: true }),
      );
      await page.keyboard.press("Enter");
      await expect(page.getByText(/Fixed in 2\.0\.0/)).toBeVisible();
      await noPageOverflow(page);
    });

    test("loading, partial and failed reports fit with accessible recovery actions", async ({
      page,
    }) => {
      // Keep the first-check skeleton stable without starting a real runner.
      await page.route("**/api/checks/*/events", (route) =>
        route.fulfill({
          contentType: "text/event-stream",
          body: ": waiting\n\n",
        }),
      );
      const loading = await reportFixture("running");
      await page.goto(`${loading.basePath}/dependencies`);
      await expect(page.getByRole("progressbar")).toBeVisible();
      await expect(
        page.getByRole("button", { name: "Cancel", exact: true }),
      ).toBeEnabled();
      await noPageOverflow(page);
      const partial = await reportFixture("partial");
      await page.goto(`${partial.basePath}/dependencies`);
      await expect(
        page.getByRole("button", { name: "Retry failed", exact: true }),
      ).toBeEnabled();
      await expect(page.getByText("Partial", { exact: true })).toBeVisible();
      await noPageOverflow(page);
      const failed = await reportFixture("failed");
      await page.goto(`${failed.basePath}/dependencies`);
      await expect(
        page.getByRole("heading", { name: "We couldn't check this project." }),
      ).toBeVisible();
      await keyboardFocus(
        page,
        page.getByRole("button", { name: "Try again", exact: true }),
      );
      await noPageOverflow(page);
    });

    test("projects, new project, settings and a tall confirmation dialog", async ({
      page,
      context,
    }) => {
      const { userId } = await signInFixture(context);
      await page.goto("/projects");
      await expect(
        page.getByRole("heading", { name: "No projects yet", exact: true }),
      ).toBeVisible();
      await noPageOverflow(page);
      const fixture = await reportFixture("completed", userId);
      await page.reload();
      await expect(
        page.getByRole("link", { name: projectName, exact: true }),
      ).toBeVisible();
      await noPageOverflow(page);
      const actions = page.getByRole("button", {
        name: `Actions for ${projectName}`,
        exact: true,
      });
      await keyboardFocus(page, actions);
      await page.keyboard.press("Enter");
      await expect(
        page.getByRole("menuitem", { name: "Settings", exact: true }),
      ).toBeVisible();
      await page.keyboard.press("Escape");
      await expect(actions).toBeFocused();
      await page.goto("/projects/new");
      await keyboardFocus(
        page,
        page.getByRole("textbox", { name: "Project name", exact: true }),
      );
      await page.keyboard.type(projectName);
      await keyboardFocus(
        page,
        page.getByRole("link", { name: "Cancel", exact: true }),
      );
      await page.keyboard.press("Enter");
      const discard = page.getByRole("dialog", {
        name: "Discard changes?",
        exact: true,
      });
      await expect(discard).toBeVisible();
      await insideViewport(discard);
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("textbox", { name: "Project name", exact: true }),
      ).toHaveValue(projectName);
      await noPageOverflow(page);
      await keyboardFocus(
        page,
        page.getByRole("link", { name: "Cancel", exact: true }),
      );
      await page.keyboard.press("Enter");
      await keyboardFocus(
        page,
        discard.getByRole("button", { name: "Discard", exact: true }),
      );
      await page.keyboard.press("Enter");
      await expect(page).toHaveURL("/projects");
      await page.goto(`${fixture.basePath}/dependencies`);
      await noPageOverflow(page);
      await page.goto(`${fixture.basePath}/settings`);
      await expect(
        page.getByRole("heading", { name: "Project settings", exact: true }),
      ).toBeVisible();
      await noPageOverflow(page);
      await keyboardFocus(
        page,
        page.getByRole("button", { name: "Delete project", exact: true }),
      );
      await page.keyboard.press("Enter");
      const deletion = page.getByRole("dialog", {
        name: "Delete project?",
        exact: true,
      });
      // A shorter viewport also covers the space left by a mobile keyboard.
      await page.setViewportSize({ width: 375, height: 320 });
      await insideViewport(deletion);
      const typed = deletion.getByRole("textbox");
      await keyboardFocus(page, typed);
      await page.keyboard.type(projectName);
      const confirm = deletion.getByRole("button", {
        name: "Delete project",
        exact: true,
      });
      await keyboardFocus(page, confirm);
      await expect(confirm).toBeEnabled();
      await insideViewport(confirm);
      expect(
        await deletion.evaluate((element) => element.scrollTop),
      ).toBeGreaterThan(0);
      await page.keyboard.press("Escape");
      await expect(
        page.getByRole("button", { name: "Delete project", exact: true }),
      ).toBeFocused();
      await page.setViewportSize({ width: 375, height: 667 });
      await page.goto("/settings/profile");
      await expect(
        page.getByRole("heading", { name: "Profile", exact: true }),
      ).toBeVisible();
      await noPageOverflow(page);
      await keyboardFocus(
        page,
        page.getByRole("button", { name: "Account menu", exact: true }),
      );
      await page.keyboard.press("Enter");
      await expect(page.getByRole("menu")).toBeVisible();
      await insideViewport(page.getByRole("menu"));
      await page.keyboard.press("Escape");
    });

    test("reduced motion removes animations and transitions", async ({
      page,
    }) => {
      await page.emulateMedia({ reducedMotion: "reduce" });
      const fixture = await reportFixture();
      await page.goto(
        `${fixture.basePath}/dependencies?pkg=${encodeURIComponent(longName)}`,
      );
      const dialog = page.getByRole("dialog");
      await expect(dialog).toBeVisible();
      expect(
        await dialog.evaluate(
          (element) => getComputedStyle(element).animationName,
        ),
      ).toBe("none");
      const close = dialog.getByRole("button", { name: "Close", exact: true });
      expect(
        await close.evaluate(
          (element) => getComputedStyle(element).transitionDuration,
        ),
      ).toBe("0s");
    });
  });
}
