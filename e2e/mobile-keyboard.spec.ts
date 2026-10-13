import { test, expect } from "@playwright/test";

test("mobile form dismisses keyboard focus and keeps navigation out of the way", async ({
  page,
}, info) => {
  test.skip(info.project.name !== "mobile", "Mobile focus behavior only");
  await page.goto("/demo/cases/new");
  const title = page.getByLabel("মামলার শিরোনাম *");
  const nav = page.locator(".bottom-nav");
  await expect(nav).toBeVisible();
  await expect(title).not.toBeFocused();
  await title.tap();
  await title.fill("মোবাইল মামলা");
  await expect(nav).toBeHidden();
  expect(await title.evaluate((el) => getComputedStyle(el).fontSize)).toBe(
    "16px",
  );
  await title.press("Enter");
  await expect(title).not.toBeFocused();
  await expect(nav).toBeVisible();
  await expect(page).toHaveURL(/cases\/new$/);
  await title.tap();
  await expect(title).toBeFocused();
  const defendant = page.getByLabel("বিবাদীর নাম");
  await defendant.tap();
  await expect(defendant).toBeFocused();
  await expect(nav).toBeHidden();
  const notes = page.getByLabel("মামলার নোট");
  await notes.tap();
  await notes.fill("প্রথম লাইন");
  await notes.press("Enter");
  await expect(notes).toBeFocused();
  await page.getByText("মামলার নোট", { exact: true }).tap();
  // A label intentionally keeps native focus; tapping surrounding panel dismisses.
  await page.locator(".form-actions").tap({ position: { x: 2, y: 2 } });
  await expect(notes).not.toBeFocused();
  await expect(nav).toBeVisible();
  expect(
    await page
      .locator(".form-actions")
      .evaluate((el) => getComputedStyle(el).position),
  ).toBe("static");
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const box = await nav.boundingBox();
  expect(box).not.toBeNull();
  expect(
    Math.abs(box!.y + box!.height - page.viewportSize()!.height),
  ).toBeLessThanOrEqual(1);
});
