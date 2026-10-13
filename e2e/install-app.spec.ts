import { test, expect } from "@playwright/test";
test("install help explains iPhone and Android installation", async ({
  page,
}) => {
  await page.goto("/demo/dashboard");
  await page.getByRole("button", { name: "অ্যাপ ইনস্টল", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.getByText(/Safari-তে/)).toBeVisible();
  await expect(page.getByText(/Chrome বা Edge/)).toBeVisible();
  await page.getByRole("button", { name: "বুঝেছি" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("install button uses browser prompt and hides when installed", async ({
  page,
}) => {
  await page.goto("/demo/dashboard");
  await page.evaluate(() => {
    const e = new Event("beforeinstallprompt");
    Object.assign(e, {
      prompt: async () => {
        document.documentElement.dataset.installPrompt = "opened";
      },
      userChoice: Promise.resolve({ outcome: "accepted" }),
    });
    window.dispatchEvent(e);
  });
  await page.getByRole("button", { name: "অ্যাপ ইনস্টল", exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute(
    "data-install-prompt",
    "opened",
  );
  await expect(
    page.getByRole("button", { name: "অ্যাপ ইনস্টল", exact: true }),
  ).not.toBeVisible();
});
