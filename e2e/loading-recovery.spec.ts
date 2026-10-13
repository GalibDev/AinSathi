import { test, expect } from "@playwright/test";
test("stalled dashboard stops loading and retry recovers", async ({ page }) => {
  await page.clock.install();
  await page.route("**/src/lib/repository.ts*", async (route) => {
    const response = await route.fetch();
    const body = (await response.text()).replace(
      'async report(org, from = "", to = "") {',
      'async report(org, from = "", to = "") { if (!globalThis.__ainsathiRecovered) { globalThis.__ainsathiStallOnce = true; await new Promise(() => {}); }',
    );
    await route.fulfill({ response, body });
  });
  await page.goto("/demo/dashboard");
  await expect(page.getByText("তথ্য লোড হচ্ছে…")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() =>
        Boolean(Reflect.get(globalThis, "__ainsathiStallOnce")),
      ),
    )
    .toBe(true);
  await page.clock.fastForward(21_000);
  await expect(page.getByText(/তথ্য আনতে সময় বেশি লাগছে/)).toBeVisible();
  await page.evaluate(() =>
    Reflect.set(globalThis, "__ainsathiRecovered", true),
  );
  await page.getByRole("button", { name: "আবার চেষ্টা করুন" }).click();
  await expect(page.locator(".stats-grid")).toBeVisible();
  await expect(page.getByText(/তথ্য আনতে সময় বেশি লাগছে/)).not.toBeVisible();
});
