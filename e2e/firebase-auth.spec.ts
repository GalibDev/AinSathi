import { test, expect } from "@playwright/test";
test("Firebase login errors and signup navigation work without creating real accounts", async ({
  page,
}) => {
  await page.route(
    "**/identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?*",
    (route) =>
      route.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({
          error: { code: 400, message: "CONFIGURATION_NOT_FOUND" },
        }),
      }),
  );
  await page.goto("/login?invite=sample-token");
  await expect(
    page.getByRole("button", { name: "Google দিয়ে লগইন করুন" }),
  ).toBeVisible();
  await page.getByLabel("ইমেইল ঠিকানা").fill("fictional@example.test");
  await page
    .getByLabel("পাসওয়ার্ড", { exact: true })
    .fill("fictional-test-password");
  await page.getByRole("button", { name: "লগইন করুন", exact: true }).click();
  await expect(
    page.getByText("Firebase Console-এ Authentication চালু করতে হবে।"),
  ).toBeVisible();
  await page.getByRole("link", { name: "রেজিস্টার করুন" }).click();
  await expect(page).toHaveURL(/\/register\?invite=sample-token/);
  await expect(page.getByLabel("পূর্ণ নাম")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Google দিয়ে অ্যাকাউন্ট তৈরি করুন" }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});
