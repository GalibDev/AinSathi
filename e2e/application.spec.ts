import { test, expect } from "@playwright/test";
test("Bengali dashboard and mobile layout render without overflow", async ({
  page,
}, info) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/demo/dashboard");
  await expect(page.getByRole("heading", { name: /স্বাগতম/ })).toBeVisible();
  await expect(page.getByText("জসিম উদ্দিন বনাম করিম").first()).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: `design/preview-${info.project.name}.png`,
    fullPage: true,
  });
  expect(errors).toEqual([]);
});
test("creates a client, creates case, closes and reopens it", async ({
  page,
}) => {
  await page.goto("/demo/clients");
  await page.getByRole("button", { name: "নতুন মক্কেল", exact: true }).click();
  await page.getByLabel("পূর্ণ নাম *").fill("টেস্ট মক্কেল");
  await page.getByLabel("মোবাইল নম্বর *", { exact: true }).fill("01912345678");
  await page.getByRole("button", { name: "মক্কেল সংরক্ষণ করুন" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.goto("/demo/cases/new");
  await page.getByLabel("মামলার শিরোনাম *").fill("টেস্ট মক্কেল বনাম বিবাদী");
  await page.getByLabel("আদালতের মামলা নম্বর *").fill("999/2026");
  await page.getByLabel("আদালত *", { exact: true }).fill("ঢাকা জেলা জজ কোর্ট");
  await page
    .getByLabel("মক্কেল নির্বাচন *")
    .selectOption({ label: "মো. জসিম উদ্দিন — 01712345670" });
  await page.getByRole("button", { name: "মামলা সংরক্ষণ করুন" }).click();
  await expect(
    page.getByRole("heading", { name: "মামলা সফলভাবে যোগ করা হয়েছে" }),
  ).toBeVisible();
  await page.getByRole("link", { name: /মামলার বিস্তারিত দেখুন/ }).click();
  await page.getByRole("button", { name: "মামলা বন্ধ করুন" }).click();
  await page
    .getByLabel("ফলাফল / চূড়ান্ত আদেশ *")
    .fill("পরীক্ষামূলক নিষ্পত্তি");
  await page.getByRole("button", { name: "নিষ্পত্তি সংরক্ষণ করুন" }).click();
  await expect(page.getByText("ফলাফল: পরীক্ষামূলক নিষ্পত্তি")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "পুনরায় চালু করুন" }).click();
  await expect(
    page.getByRole("button", { name: "মামলা বন্ধ করুন" }),
  ).toBeVisible();
});
test("calendar, report, staff and auth routes work", async ({ page }) => {
  await page.goto("/demo/calendar");
  await expect(
    page.getByRole("heading", { name: "শুনানি ক্যালেন্ডার", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "তালিকা", exact: true }).click();
  await expect(page.getByText("সাক্ষ্য গ্রহণ").first()).toBeVisible();
  await page.goto("/demo/reports");
  await expect(
    page.getByRole("heading", { name: "চেম্বার রিপোর্ট" }),
  ).toBeVisible();
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: "CSV ডাউনলোড" }).click();
  expect((await download).suggestedFilename()).toMatch(/ainsathi-report/);
  await page.goto("/demo/members");
  await expect(
    page.getByRole("heading", { name: "আইনজীবী ও স্টাফ" }),
  ).toBeVisible();
  await page.goto("/cases");
  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole("heading", { name: "লগইন করুন" })).toBeVisible();
});
