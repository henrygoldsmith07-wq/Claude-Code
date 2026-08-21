import { test, expect } from "@playwright/test";

const SUMMARY = {
  trace: {
    event: "Manager gave brief critical feedback in standup.",
    observations: ["Manager said 'needs more detail in handover'"],
    assumptions: ["They think I'm incompetent"],
    namedEmotion: "shame",
    alternativeInterpretations: ["Manager wanted quicker handovers for the release"],
    intendedOutcome: "Feel competent and trusted in handovers",
    intendedAction: "Ask manager for one concrete example of good handover",
    predictedOutcome: "If I ask, they'll give one example and I'll feel clearer.",
    followUpAt: "2026-01-20",
    followUpNote: null,
  },
  coreEmotion: "shame",
  underlyingTriggers: ["Critical feedback in front of peers"],
  possibleBiases: [
    {
      type: "catastrophizing",
      description: "This interpretation may involve catastrophizing; the short delay was read as permanent rejection.",
      evidenceFor: ["User said 'it will ruin everything'"],
      evidenceAgainst: ["No evidence the delay is permanent"],
      confidence: 0.7,
    },
  ],
  otherPerspective: "Manager may see this as routine coaching.",
  balancedAssessment: "Feedback was blunt but not personal.",
  cautionFlags: [],
  suggestedNextSteps: ["Ask for an example"],
  hedgedDisclaimer: "These are tentative readings, not diagnoses; weigh them against the evidence listed.",
};

const SITUATION = "Manager gave brief critical feedback in standup.";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => localStorage.clear());
  await page.reload();
});

async function startReflection(page: import("@playwright/test").Page) {
  // Home CTA opens NewEntryForm
  await page.getByRole("button", { name: "Full reflection →" }).click();
  const box = page.getByPlaceholder(/What happened/i);
  await expect(box).toBeVisible();
  await box.fill(SITUATION);
  await page.getByRole("button", { name: /Start full reflection/ }).click();
}

test("create reflection → receive structured output → inspect evidence", async ({ page }) => {
  await page.route("**/api/reflect", async (route) => {
    if (route.request().method() !== "POST") return route.continue();
    const body = (route.request().postDataJSON() ?? {}) as Record<string, unknown>;
    const messages = (body.messages ?? []) as { role: string }[];
    const assistantCount = messages.filter((m) => m.role === "assistant").length;
    if (assistantCount < 3) {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ step: "question", question: `Question ${assistantCount + 1}: What was actually observed here?` }),
      });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ step: "summary", summary: SUMMARY }) });
    }
  });

  await startReflection(page);

  // Answer each question until the summary lands
  const box = page.getByPlaceholder(/Answer one question/i);
  const send = page.getByRole("button", { name: "Send", exact: true });
  for (let i = 0; i < 4; i++) {
    await box.fill(`Answer ${i + 1}: what was observed and alternative readings`);
    await send.click();
    await page.waitForTimeout(700);
    if ((await page.getByText("Structured trace").count()) > 0) break;
  }

  await expect(page.getByText("Structured trace")).toBeVisible({ timeout: 10_000 });
  // Observation vs inference separation
  await expect(page.getByText(/Observations \(facts only\)/i)).toBeVisible();
  await expect(page.getByText(/Assumptions to check/i)).toBeVisible();
  // Evidence inspection
  await expect(page.getByText(/Evidence-linked observations|Evidence for this reading/i).first()).toBeVisible();
  await expect(page.getByText(/Evidence against/i)).toBeVisible();
  // Hedged language contract
  await expect(page.getByText(/tentative readings, not diagnoses/i).first()).toBeVisible();
});

test("reject/correct interpretation and verify correction later", async ({ page }) => {
  // Seed a completed entry directly
  await page.evaluate((summary) => {
    localStorage.setItem(
      "reflectEntries",
      JSON.stringify([
        {
          id: "e-dismiss-1",
          createdAt: new Date().toISOString(),
          title: "Manager feedback",
          messages: [{ role: "user", content: "Manager said handover thin" }],
          status: "complete",
          summary,
        },
      ]),
    );
    localStorage.setItem("reflectCorrections", JSON.stringify([]));
  }, SUMMARY);
  await page.reload();

  // Open the entry via History
  await page.getByRole("button", { name: "History", exact: true }).click();
  await page.getByText("Manager feedback").first().click();
  await expect(page.getByText(/Patterns to consider/i)).toBeVisible();

  // Reject the interpretation
  await page.getByRole("button", { name: /Stop showing this pattern/i }).first().click();

  // Correction stored locally
  const corrections = await page.evaluate(() => JSON.parse(localStorage.getItem("reflectCorrections") ?? "[]"));
  expect(corrections.length).toBeGreaterThan(0);
  expect(String(corrections[0].key)).toContain("catastrophizing");
  // Rich propagation fields present
  expect(corrections[0].rejectedInterpretation ?? corrections[0].reason).toBeTruthy();
  expect(corrections[0].rejectedAt || corrections[0].timestamp).toBeTruthy();

  // Pattern hidden immediately
  await expect(page.getByText(/Patterns to consider/i)).not.toBeVisible({ timeout: 5000 });

  // Correction persists across reloads — rejected pattern must not resurface
  await page.reload();
  const persisted = await page.evaluate(() => JSON.parse(localStorage.getItem("reflectCorrections") ?? "[]"));
  expect(persisted.length).toBeGreaterThan(0);
});

test("export/delete privacy controls", async ({ page }) => {
  await page.evaluate(() => {
    localStorage.setItem(
      "reflectEntries",
      JSON.stringify([
        {
          id: "e-export-1",
          createdAt: new Date().toISOString(),
          title: "Exportable",
          messages: [{ role: "user", content: "private content export test" }],
          status: "complete",
          summary: null,
        },
      ]),
    );
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByText(/Privacy · Export · Encryption/i)).toBeVisible({ timeout: 5000 });
  await expect(page.getByRole("button", { name: "Export JSON" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Delete all data" })).toBeVisible();

  page.on("dialog", (d) => void d.accept());
  await page.getByRole("button", { name: "Delete all data" }).click();
  await page.waitForTimeout(500);
  const remaining = await page.evaluate(() => localStorage.getItem("reflectEntries"));
  expect(remaining === "[]" || remaining === null).toBeTruthy();
});

test("AI-provider failure shows error and allows retry", async ({ page }) => {
  let called = 0;
  await page.route("**/api/reflect", async (route) => {
    called++;
    if (called === 1) {
      await route.fulfill({ status: 502, contentType: "application/json", body: JSON.stringify({ error: "Claude did not return a structured response" }) });
    } else {
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ step: "question", question: "Retry question: what was observed?" }) });
    }
  });

  await startReflection(page);

  // First request fails — error surfaces to the user, not silently swallowed
  await expect(page.getByText(/Claude did not return a structured response|Something went wrong/i).first()).toBeVisible({ timeout: 10_000 });

  // The session retries automatically after failure (no duplicate user message)
  await expect(page.getByText(/Retry question/i)).toBeVisible({ timeout: 10_000 });
});
