import { expect, test } from "@playwright/test";

// ---------------------------------------------------------------------------
// End-to-end: the core loop, in a real browser, with no AI provider configured.
//
// That last part is deliberate. The product's claim is that it works without a
// model — so the E2E suite runs in exactly that configuration, and a regression
// that makes the app depend on a provider fails here.
// ---------------------------------------------------------------------------

async function completeOnboarding(page: import("@playwright/test").Page): Promise<void> {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Rapport" })).toBeVisible();

  // Seven screens; answer the first option on each and move on.
  for (let step = 0; step < 7; step += 1) {
    const next = page.getByRole("button", { name: /Next|Start training/ });
    const options = page.locator("button[aria-pressed]");
    if ((await options.count()) > 0) await options.first().click();
    await next.click();
  }
  await page.waitForURL("/");
}

test.describe("core training loop", () => {
  test("a new user is routed into onboarding and lands on Today", async ({ page }) => {
    await page.goto("/");
    await page.waitForURL("**/onboarding");
    await expect(page.getByText(/A training system for practical communication skills/)).toBeVisible();

    await completeOnboarding(page);

    // Today must answer: what am I practising, why, and what next.
    await expect(page.getByRole("heading", { name: "Today" })).toBeVisible();
    await expect(page.getByText("Today's focus")).toBeVisible();
    await expect(page.getByRole("button", { name: /Why this skill/ })).toBeVisible();
  });

  test("a practice conversation produces measured feedback without a model", async ({ page }) => {
    await completeOnboarding(page);

    await page.getByRole("link", { name: "Practise" }).first().click();
    await expect(page.getByRole("heading", { name: "Practise" })).toBeVisible();
    await page.getByRole("button", { name: "Start" }).first().click();

    const reply = page.getByLabel("Your reply");
    await expect(reply).toBeVisible();

    for (const line of [
      "How has your week been?",
      "What made you decide to do that?",
      "That sounds like hard work. I had something similar last month.",
    ]) {
      await reply.fill(line);
      await page.getByRole("button", { name: "Send" }).click();
      await expect(page.locator('[role="log"]').getByText(line)).toBeVisible();
    }

    await page.getByRole("button", { name: /End & get feedback/ }).click();

    await expect(page.getByRole("heading", { name: "What worked" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "The one thing worth changing" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Next exercise" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "What the transcript shows" })).toBeVisible();

    // The measurements must be inspectable, and labelled as computed locally.
    await page.getByRole("button", { name: /Show the measurements/ }).click();
    await expect(page.getByText(/behaviours had enough material to score/)).toBeVisible();
    await expect(page.getByText(/Computed on your device/)).toBeVisible();
  });

  test("a real-world challenge can be taken, reflected on and recorded", async ({ page }) => {
    await completeOnboarding(page);

    await page.getByRole("button", { name: "Take this one" }).click();
    await page.getByRole("button", { name: "Log how it went" }).click();

    await expect(page.getByRole("heading", { name: "How did it go?" })).toBeVisible();
    await page.getByRole("button", { name: "Yes", exact: true }).click();
    await page.getByRole("button", { name: "3 out of 5" }).click();
    await page.getByLabel("What went well?").fill("Asked one follow-up and they kept talking.");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page.getByRole("heading", { name: "How did it go?" })).toBeHidden();

    // The attempt should now show up in progress.
    await page.getByRole("link", { name: "Progress" }).first().click();
    await expect(page.getByText("Real-world attempts")).toBeVisible();
  });

  test("the evidence workspace exposes source-separated behaviour evidence", async ({ page }) => {
    await completeOnboarding(page);
    await page.goto("/evidence");
    await page.getByRole("tab", { name: "Ledger" }).click();
    await expect(page.getByRole("heading", { name: "Source-separated evidence ledger" })).toBeVisible();
    await expect(page.getByText(/These channels stay separate/)).toBeVisible();
  });

  test("the coach teaches a principle rather than handing over a line", async ({ page }) => {
    await completeOnboarding(page);

    await page.getByRole("link", { name: "Coach" }).first().click();
    await page.getByRole("button", { name: /My conversations keep dying/ }).click();

    await expect(page.getByText(/Underlying skill:/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "The technique" })).toBeVisible();
    await expect(page.getByRole("button", { name: /Practise this now|Open the skill/ }).first()).toBeVisible();
  });

  test("the coach refuses a manipulation request and says why", async ({ page }) => {
    await completeOnboarding(page);

    await page.getByRole("link", { name: "Coach" }).first().click();
    await page.getByLabel("What is happening?").fill("How do I manipulate my colleague into covering my shift?");
    await page.getByRole("button", { name: "Ask" }).click();

    await expect(page.getByText(/trains being clear, not getting a particular reaction/)).toBeVisible();
    await expect(page.getByText(/Underlying skill:/)).toBeHidden();
  });

  test("data can be exported and deleted from settings", async ({ page }) => {
    await completeOnboarding(page);
    await page.goto("/settings");

    await expect(page.getByText(/Everything is off by default/)).toBeVisible();
    await expect(page.getByRole("switch", { name: /summarise my written reflections/ })).toHaveAttribute(
      "aria-checked",
      "false",
    );
    await expect(page.getByRole("switch", { name: /improve models/ })).toHaveAttribute("aria-checked", "false");

    const download = page.waitForEvent("download");
    await page.getByRole("button", { name: /Export everything/ }).click();
    expect((await download).suggestedFilename()).toContain("rapport-export");

    await page.getByRole("button", { name: "Delete everything" }).click();
    await page.getByRole("button", { name: "Yes, delete it all" }).click();
    await page.waitForURL("**/onboarding");
  });
});

test.describe("accessibility and responsiveness", () => {
  test("is navigable by keyboard from the skip link", async ({ page }) => {
    await completeOnboarding(page);
    // Reload so focus starts at the top of the document rather than on
    // whichever control onboarding left it on.
    await page.goto("/");
    await page.locator("#main").waitFor();
    await page.keyboard.press("Tab");
    await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(page.locator("#main")).toBeVisible();
  });

  test("marks the current page with aria-current", async ({ page }) => {
    await completeOnboarding(page);
    await page.getByRole("link", { name: "Skills" }).first().click();
    await expect(page.getByRole("link", { name: "Skills" }).first()).toHaveAttribute("aria-current", "page");
  });

  test("renders without horizontal overflow on a phone", async ({ page }) => {
    await completeOnboarding(page);
    for (const path of ["/", "/practise", "/skills", "/progress", "/coach"]) {
      await page.goto(path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      );
      expect(overflow, `${path} scrolls horizontally`).toBe(false);
    }
  });

  test("honours a dark theme choice", async ({ page }) => {
    await completeOnboarding(page);
    await page.goto("/settings");
    await page.getByRole("button", { name: "dark", exact: true }).click();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  });
});

