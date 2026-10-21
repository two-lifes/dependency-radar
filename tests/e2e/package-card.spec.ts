import { expect, type Page, test } from "@playwright/test";

// Needs the database and MOCK_EXTERNAL=1 (fake npm, OSV and GitHub): the
// sample project's axios has an OSV record and release notes that quote a
// long unbroken URL.

async function openSampleReport(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "or try a sample project" }).click();
  await page.getByRole("button", { name: "Check dependencies" }).click();
  await expect(page).toHaveURL(/\/r\/[^/]+\/dependencies/);
  // The tab gets its count once the check is done and the page refreshed.
  await expect(
    page.getByRole("link", { name: /^Vulnerabilities \(\d+\)$/ }),
  ).toBeVisible({ timeout: 60_000 });
}

/** Elements inside the card whose content is wider than their box. */
function horizontalOverflow(page: Page) {
  return page.getByRole("dialog").evaluate((dialog) =>
    [dialog, ...dialog.querySelectorAll<HTMLElement>("*")]
      .filter((element) => {
        const { overflowX } = getComputedStyle(element);
        return (
          (overflowX === "auto" || overflowX === "scroll") &&
          element.scrollWidth > element.clientWidth
        );
      })
      .map((element) => element.className),
  );
}

for (const viewport of [
  { width: 1440, height: 900 },
  { width: 390, height: 844 },
]) {
  test(`the package card never scrolls sideways at ${viewport.width}px`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await openSampleReport(page);
    await page.goto(`${page.url()}?pkg=axios`);

    const card = page.getByRole("dialog");
    await expect(card.getByRole("heading", { name: "axios" })).toBeVisible();
    await expect(card.getByText(/axios\/commit\/[0-9a-f]{40}/)).toBeVisible();
    expect(await horizontalOverflow(page)).toEqual([]);

    // The mock release notes of axios end with an unbroken compare URL.
    await card.getByRole("tab", { name: "Release notes" }).click();
    await card
      .getByRole("tabpanel", { name: "Release notes" })
      .getByText("1.12.2", { exact: true })
      .click();
    await expect(card.getByText(/axios\/compare\/[0-9a-f]{40}/)).toBeVisible();
    expect(await horizontalOverflow(page)).toEqual([]);
  });
}
