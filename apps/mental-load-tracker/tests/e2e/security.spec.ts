import { test, expect } from "@playwright/test";

const hasSupabase = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);
const hasTestAccount = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

test("unauthenticated users reach the authentication gate", async ({ page }) => {
  test.skip(!hasSupabase, "configure Supabase for the E2E app");
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Sign in to Noticed" })).toBeVisible();
  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByText("Start")).not.toBeVisible();
});

test("an authenticated owner can use the invitation controls", async ({ page }) => {
  test.skip(!hasSupabase || !hasTestAccount, "configure the E2E Supabase account variables");

  await page.goto("/");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD!);
  await page.locator('form').last().getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/board/);
  await expect(page.getByText("Invite someone to this household")).toBeVisible();
  await page.getByTestId("invite-toggle").click();
  await page.getByTestId("create-invite").click();
  await expect(page.getByTestId("invite-link")).toHaveValue(/#invite=[a-f0-9]{64}/);
});
