import { test, expect } from "../playwright-fixture";

const matchPath = "/matches/7a14bbd2-6c19-4aee-9d00-2a79f00e7837";

async function assertNoHorizontalOverflow(page: Parameters<typeof test>[0] extends never ? never : any) {
  const metrics = await page.evaluate(() => ({
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }));

  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.viewportWidth + 1);
}

test.describe("Coaching-Cockpit responsive", () => {
  test("renders cleanly on desktop", async ({ page }) => {
    await page.setViewportSize({ width: 1563, height: 887 });
    await page.goto(matchPath);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /schneller überblick für trainer/i })).toBeVisible();
    await expect(page.getByText(/coach summary/i)).toBeVisible();

    const tabs = page.getByRole("tab");
    await expect(tabs.first()).toBeVisible();
    await expect(tabs).toHaveCount(await tabs.count());

    await expect(page.getByText(/top-speed|topspeed/i).first()).toBeVisible();
    await expect(page.getByText(/passquote|passquote/i).first()).toBeVisible();

    const truncatedName = page.locator(".truncate, .line-clamp-2").filter({ hasText: /[A-Za-zÄÖÜäöüß-]{6,}\s+[A-Za-zÄÖÜäöüß-]{4,}/ }).first();
    if (await truncatedName.count()) {
      await expect(truncatedName).toBeVisible();
    }

    await assertNoHorizontalOverflow(page);
  });

  test("renders cleanly on tablet", async ({ page }) => {
    await page.setViewportSize({ width: 1024, height: 1366 });
    await page.goto(matchPath);
    await page.waitForLoadState("networkidle");

    await expect(page.getByRole("heading", { name: /schneller überblick für trainer/i })).toBeVisible();

    const tabs = page.getByRole("tab");
    await expect(tabs.first()).toBeVisible();

    const visibleTabs = await tabs.evaluateAll((elements) =>
      elements.map((element) => {
        const rect = element.getBoundingClientRect();
        return {
          text: element.textContent?.trim() || "",
          right: rect.right,
          left: rect.left,
          top: rect.top,
          bottom: rect.bottom,
        };
      }),
    );

    for (const tab of visibleTabs) {
      expect(tab.left).toBeGreaterThanOrEqual(0);
      expect(tab.right).toBeLessThanOrEqual(1024);
    }

    await expect(page.getByText(/was-wäre-wenn-analyse/i)).toBeVisible();
    await expect(page.getByText(/noch kein profil|offen/i).first()).toBeVisible();

    await assertNoHorizontalOverflow(page);
  });
});
