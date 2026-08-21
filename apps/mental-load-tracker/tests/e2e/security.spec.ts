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

test("the sign-in form is keyboard operable with labelled controls", async ({ page }) => {
  test.skip(!hasSupabase, "configure Supabase for the E2E app");

  await page.goto("/");
  const email = page.getByLabel("Email");
  const password = page.getByLabel("Password");
  await expect(email).toBeVisible();
  await expect(password).toBeVisible();

  await email.focus();
  await expect(email).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(password).toBeFocused();

  const modeGroup = page.getByRole("group", { name: /sign in or create account/i });
  await expect(modeGroup).toBeVisible();
  await expect(modeGroup.getByRole("button").first()).toHaveAttribute(
    "aria-pressed",
    /^(true|false)$/,
  );

  const submit = page.getByRole("button", { name: /^Sign in$|^Create account$/ }).last();
  await expect(submit).toBeEnabled();
});

test("the board exposes accessible capture and resolution controls", async ({ page }) => {
  test.skip(!hasSupabase || !hasTestAccount, "configure the E2E Supabase account variables");

  await page.goto("/");
  await page.getByLabel("Email").fill(process.env.E2E_TEST_EMAIL!);
  await page.getByLabel("Password").fill(process.env.E2E_TEST_PASSWORD!);
  await page.locator('form').last().getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page).toHaveURL(/\/board/);

  const captureInput = page.getByLabel("What did you notice needs doing?");
  await expect(captureInput).toBeVisible();
  await captureInput.fill("Accessibility probe item");
  await page.getByRole("button", { name: "Log it" }).click();
  await expect(page.getByText("Accessibility probe item")).toBeVisible();

  await expect(page.getByRole("button", { name: "Mark as done" }).first()).toBeVisible();
});
