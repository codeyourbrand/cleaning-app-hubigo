import { test, expect } from "@playwright/test";

test("cleaner can login and see tasks", async ({ page }) => {
  await page.goto("/login");
  await page.getByPlaceholder("you@hubigo.local").fill("cleaner1@hubigo.local");
  await page.locator('input[type="password"]').fill("Hubigo123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Tasks" })).toBeVisible();
  await expect(page.getByText("157")).toBeVisible();
});

test("coordinator can login and see dashboard", async ({ page }) => {
  await page.goto("/login");
  await page
    .getByPlaceholder("you@hubigo.local")
    .fill("coordinator@hubigo.local");
  await page.locator('input[type="password"]').fill("Hubigo123!");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Team Board")).toBeVisible();
});
