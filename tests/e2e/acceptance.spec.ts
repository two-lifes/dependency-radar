import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

for (const theme of ["light", "dark"] as const) {
  test(`landing uses the explicit ${theme} screenshot over the system preference`, async ({
    page,
  }) => {
    await page.emulateMedia({
      colorScheme: theme === "light" ? "dark" : "light",
    });
    await page.addInitScript(
      (value) => localStorage.setItem("theme", value),
      theme,
    );
    await page.goto("/");
    const preview = page.getByRole("region", { name: "See a real report" });
    const image = preview.getByRole("img");
    await image.scrollIntoViewIfNeeded();
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute("src", new RegExp(`report-${theme}`));
    await expect
      .poll(() =>
        image.evaluate(
          (element) =>
            element instanceof HTMLImageElement &&
            element.complete &&
            element.naturalWidth > 0,
        ),
      )
      .toBe(true);
    await expect(preview.getByRole("link")).toHaveCount(0);
  });
}

// Real-source timing and manual version checks are recorded separately:
// this suite verifies the UI deterministically with MOCK_EXTERNAL=1.
async function sampleReport(page: Page) {
  await page.setExtraHTTPHeaders({ "x-real-ip": `acceptance-${randomUUID()}` });
  await page.goto("/");
  await page.getByRole("button", { name: "or try a sample project" }).click();
  await page.getByRole("button", { name: "Check dependencies" }).click();
  await expect(page).toHaveURL(/\/r\/[^/]+\/dependencies/);
  await expect(
    page.getByRole("link", { name: /^Vulnerabilities \(\d+\)$/ }),
  ).toBeVisible({ timeout: 60_000 });
}

test("a shared filtered URL preserves rows and sorting in an independent browser", async ({
  page,
  browser,
}) => {
  test.setTimeout(60_000);
  await sampleReport(page);
  const reportUrl = page.url();
  await page.goto(`${reportUrl}?type=prod&lag=major&sort=-name`);
  await page.getByRole("searchbox", { name: "Search packages" }).fill("react");
  await expect(page).toHaveURL(/q=react/);
  const rows = page.getByRole("table").locator("tbody tr[data-package]");
  await expect(rows).toHaveCount(2);
  const names = await rows.evaluateAll((elements) =>
    elements.map((element) => element.getAttribute("data-package")),
  );
  expect(names).toEqual(["react-dom", "react"]);
  const sharedUrl = page.url();
  const other = await browser.newContext();
  try {
    expect(await other.cookies()).toEqual([]);
    const recipient = await other.newPage();
    await recipient.goto(sharedUrl);
    await expect(recipient.getByRole("searchbox")).toHaveValue("react");
    await expect(
      recipient.getByText("Showing 2 of 11", { exact: true }),
    ).toBeVisible();
    const receivedRows = recipient
      .getByRole("table")
      .locator("tbody tr[data-package]");
    await expect(receivedRows).toHaveCount(2);
    expect(
      await receivedRows.evaluateAll((elements) =>
        elements.map((element) => element.getAttribute("data-package")),
      ),
    ).toEqual(names);
    await recipient.getByRole("link", { name: /^Vulnerabilities/ }).click();
    await recipient.getByRole("link", { name: /^Dependencies/ }).click();
    await expect(recipient).toHaveURL(sharedUrl);
    await expect(receivedRows).toHaveCount(2);
  } finally {
    await other.close();
  }
});

test("a completed report shows resolved versions and vulnerability fixes", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await sampleReport(page);
  const table = page.getByRole("table");
  const react = table.locator('tr[data-package="react"]');
  await expect(react.getByText("18.3.1", { exact: true })).toBeVisible();
  await expect(react.getByText("19.2.0", { exact: true })).toBeVisible();
  const axios = table.locator('tr[data-package="axios"]');
  await expect(axios.getByText("0.21.4", { exact: true })).toBeVisible();
  await expect(axios.getByText("1.12.2", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: /^Vulnerabilities/ }).click();
  await expect(
    page.getByRole("link", { name: /GHSA-mock-axio-0001/ }),
  ).toBeVisible();
  await expect(page.getByText("Fixed in 1.8.2", { exact: true })).toBeVisible();
});
