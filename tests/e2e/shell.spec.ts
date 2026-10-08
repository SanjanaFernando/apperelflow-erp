import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("login shell has no critical accessibility violations", async ({ page }) => {
  await page.goto("/login");
  await expect(page).toHaveTitle(/ApparelFlow/);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("protected API routes reject unauthenticated access", async ({ request }) => {
  const response = await request.get("/api/sewing/queue");
  expect(response.status()).toBe(401);
});