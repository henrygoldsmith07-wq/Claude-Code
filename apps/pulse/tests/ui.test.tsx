/**
 * UI and accessibility tests.
 *
 * The UI's contract is narrow but strict: it must render every field of the
 * evidence spec, it must never render a causal claim for an observational
 * finding, and it must be operable without a mouse or a working colour sense.
 * Accessibility here is checked with axe against the real rendered output, not
 * asserted by convention.
 */

import { beforeAll, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import axe from "axe-core";
import { App } from "../src/ui/App.js";
import { FindingCard } from "../src/ui/FindingCard.js";
import { afterPaint, renderBootFailure } from "../src/ui/boot.js";
import { createSyntheticPulse } from "../src/synthetic/harness.js";
import type { Pulse } from "../src/pulse.js";
import type { Finding } from "../src/discovery/finding.js";

const finding: Finding = {
  id: "f1",
  createdAt: "2025-06-30T00:00:00Z",
  evidenceClass: "correlation",
  title: "Question accuracy is higher within 4h of training",
  statement: "Across 42 revision sessions, sessions within four hours of exercise had 8.7% higher question accuracy.",
  metricIds: ["study.accuracy", "exercise.volume"],
  sources: ["revise", "arise"],
  sampleSize: 42,
  sampleDescription: "18 within window vs 24 outside",
  effect: { kind: "hedges_g", value: 0.45, magnitude: "small", label: "+0.45 SD", ci: { low: 0.12, high: 0.78, level: 0.95 } },
  test: { name: "welch_t", statistic: 2.4, pValue: 0.019, adjustedP: 0.041, familySize: 98, correctionMethod: "benjamini_hochberg" },
  confidence: {
    level: "moderate",
    score: 0.62,
    reasons: ["Based on 42 observations", "Survives multiple-testing correction (adjusted p = 0.041)"],
    limitations: ["Found while scanning 98 comparisons"],
  },
  confounders: [
    { id: "time-of-day", name: "Time of day", description: "Sessions happened at different clock times.", status: "controlled", detail: "Median 16:20 vs 16:05, p = 0.62" },
    { id: "secular-trend", name: "Improvement over time", description: "One group sits later in the period.", status: "uncontrolled", detail: "Mean day 70 vs 87, p = 0.001" },
  ],
  causalityNote: "This is an association, not a cause. Something else may drive both.",
  nextAction: {
    kind: "run-experiment",
    summary: "Run a crossover experiment to test whether training before study changes the outcome",
    rationale: "The behaviour is under your control.",
    effortHours: 2,
  },
  evidence: [
    { kind: "events", description: "42 revision sessions paired with training", metricIds: ["study.accuracy"], sources: ["revise", "arise"], eventCount: 620, dateRange: { from: "2025-01-06", to: "2025-06-29" } },
  ],
  tags: ["exposure-window", "study"],
};

async function expectNoAxeViolations(container: HTMLElement): Promise<void> {
  const results = await axe.run(container, {
    rules: {
      // Landmark/region rules need a full document; these tests render fragments.
      region: { enabled: false },
    },
  });
  const messages = results.violations.map((violation) => `${violation.id}: ${violation.help}`);
  expect(messages).toEqual([]);
}

describe("FindingCard renders the whole evidence contract", () => {
  it("shows what was found, the sample, the effect and the confidence", () => {
    render(<FindingCard finding={finding} />);
    expect(screen.getByText(finding.title)).toBeTruthy();
    expect(screen.getByText(finding.statement)).toBeTruthy();
    expect(screen.getByText("18 within window vs 24 outside")).toBeTruthy();
    expect(screen.getByText(/\+0\.45 SD/)).toBeTruthy();
    expect(screen.getByText(/Confidence: Moderate/)).toBeTruthy();
  });

  it("shows the interval and the corrected p-value with the size of the search", () => {
    render(<FindingCard finding={finding} />);
    expect(screen.getByText(/0\.12 to 0\.78 \(95%\)/)).toBeTruthy();
    expect(screen.getByText(/adjusted 0\.041 across 98 comparisons/)).toBeTruthy();
  });

  it("always shows the causality note", () => {
    render(<FindingCard finding={finding} />);
    const note = screen.getByRole("note");
    expect(note.textContent).toMatch(/not a cause/);
  });

  it("labels the evidence class so a correlation is never mistaken for a result", () => {
    render(<FindingCard finding={finding} />);
    expect(screen.getByText("Correlation")).toBeTruthy();
  });

  it("shows confounders and flags the ones that were not ruled out", () => {
    render(<FindingCard finding={finding} />);
    expect(screen.getByText(/1 not ruled out/)).toBeTruthy();
    expect(screen.getByText("Time of day")).toBeTruthy();
    expect(screen.getByText("uncontrolled")).toBeTruthy();
    expect(screen.getByText(/Mean day 70 vs 87/)).toBeTruthy();
  });

  it("says so explicitly when no confounder checks were possible", () => {
    render(<FindingCard finding={{ ...finding, confounders: [] }} />);
    expect(screen.getByText(/No confounder checks were possible/)).toBeTruthy();
  });

  it("shows which data supports the claim, with its date range and sources", () => {
    render(<FindingCard finding={finding} />);
    expect(screen.getByText(/42 revision sessions paired with training/)).toBeTruthy();
    expect(screen.getByText(/2025-01-06 to 2025-06-29/)).toBeTruthy();
    expect(screen.getByText(/from revise, arise/)).toBeTruthy();
  });

  it("shows the recommended next step, and says plainly when there is none", () => {
    const { unmount } = render(<FindingCard finding={finding} />);
    expect(screen.getByText(/Run a crossover experiment/)).toBeTruthy();
    unmount();

    render(<FindingCard finding={{ ...finding, nextAction: null }} />);
    expect(screen.getByText(/No action is justified by this evidence yet/)).toBeTruthy();
  });

  it("shows the reasoning behind the confidence grade, including its limitations", () => {
    render(<FindingCard finding={finding} />);
    expect(screen.getByText(/Based on 42 observations/)).toBeTruthy();
    expect(screen.getByText(/Found while scanning 98 comparisons/)).toBeTruthy();
  });

  it("reports feedback without mutating the finding", () => {
    const received: string[] = [];
    render(<FindingCard finding={finding} onFeedback={(id, verdict) => received.push(`${id}:${verdict}`)} />);
    fireEvent.click(screen.getByRole("button", { name: "Not useful" }));
    expect(received).toEqual(["f1:not-useful"]);
    expect(screen.getByText(finding.statement)).toBeTruthy();
  });

  it("has no accessibility violations", async () => {
    const { container } = render(<FindingCard finding={finding} onFeedback={() => {}} onDesignExperiment={() => {}} />);
    await expectNoAxeViolations(container);
  });

  it("never conveys status by colour alone", () => {
    render(<FindingCard finding={finding} />);
    // Each colour-coded state also carries a readable text label.
    expect(screen.getByText("controlled")).toBeTruthy();
    expect(screen.getByText("uncontrolled")).toBeTruthy();
    expect(screen.getByText(/Confidence: Moderate/)).toBeTruthy();
  });
});

describe("the app shell", () => {
  let pulse: Pulse;

  beforeAll(async () => {
    const harness = await createSyntheticPulse({ days: 180, seed: "discovery-suite" });
    pulse = harness.pulse;
    pulse.discover();
  });

  it("leads with the evidence, not with a dashboard", () => {
    render(<App pulse={pulse} />);
    expect(screen.getByRole("heading", { name: "What Pulse believes" })).toBeTruthy();
    expect(screen.getByText(/survived correction across \d+ comparisons/)).toBeTruthy();
    cleanup();
  });

  it("discloses the size of the search and the expected false discoveries", () => {
    render(<App pulse={pulse} />);
    expect(screen.getByText(/Expect roughly [\d.]+ of them to be false/)).toBeTruthy();
    cleanup();
  });

  it("exposes tabs with correct roles and selection state", () => {
    render(<App pulse={pulse} />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs.length).toBe(6);
    expect(tabs[0]!.getAttribute("aria-selected")).toBe("true");

    fireEvent.click(screen.getByRole("tab", { name: "Evidence" }));
    expect(screen.getByRole("tab", { name: "Evidence" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("heading", { name: "Personal evidence graph" })).toBeTruthy();

    fireEvent.click(screen.getByRole("tab", { name: "Sources & privacy" }));
    expect(screen.getByRole("tab", { name: "Sources & privacy" }).getAttribute("aria-selected")).toBe("true");
    cleanup();
  });

  it("shows per-source consent, what would be read, and a revoke control", () => {
    render(<App pulse={pulse} />);
    fireEvent.click(screen.getByRole("tab", { name: "Sources & privacy" }));
    expect(screen.getByText(/processes everything on this device/)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Reflect" })).toBeTruthy();
    expect(screen.getByText(/must be granted on its own/)).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /Revoke and delete all/ }).length).toBeGreaterThan(0);
    cleanup();
  });

  it("answers a suggested question in the Ask panel", () => {
    render(<App pulse={pulse} />);
    fireEvent.click(screen.getByRole("tab", { name: "Ask Pulse" }));
    fireEvent.click(screen.getByRole("button", { name: "When do I revise most effectively?" }));
    const answer = screen.getByText(/highest in the|I have \d+ sessions|come from only/);
    expect(answer).toBeTruthy();
    cleanup();
  });

  it("shows a real empty state rather than a fabricated one", async () => {
    const { pulse: empty } = await createSyntheticPulse({ days: 5, seed: "ui-empty" });
    empty.discover();
    render(<App pulse={empty} />);
    expect(screen.getByText(/Pulse would rather show you nothing/)).toBeTruthy();
    cleanup();
  });

  it("renders the timeline as a table with a caption and row headers", () => {
    render(<App pulse={pulse} />);
    fireEvent.click(screen.getByRole("tab", { name: "Timeline" }));
    const table = screen.getByRole("table");
    expect(within(table).getAllByRole("columnheader").length).toBe(4);
    expect(within(table).getAllByRole("rowheader").length).toBeGreaterThan(0);
    cleanup();
  });

  it("has no accessibility violations on the insights view", async () => {
    const { container } = render(<App pulse={pulse} />);
    await expectNoAxeViolations(container);
    cleanup();
  });

  it("has no accessibility violations on the sources view", async () => {
    const { container } = render(<App pulse={pulse} />);
    fireEvent.click(screen.getByRole("tab", { name: "Sources & privacy" }));
    await expectNoAxeViolations(container);
    cleanup();
  });

  it("has no accessibility violations on the Ask view, including its labelled input", async () => {
    const { container } = render(<App pulse={pulse} />);
    fireEvent.click(screen.getByRole("tab", { name: "Ask Pulse" }));
    expect(screen.getByLabelText(/Ask a question about your own data/)).toBeTruthy();
    await expectNoAxeViolations(container);
    cleanup();
  });

  it("never shows a causal claim for an observational finding", () => {
    render(<App pulse={pulse} />);
    const body = document.body.textContent ?? "";
    // Any use of "causes" must belong to a disclaimer, not to a claim.
    const claims = body.match(/\b(causes|caused|proves)\b/gi) ?? [];
    expect(claims).toEqual([]);
    expect(body).toMatch(/not a cause|does not establish|association/i);
    cleanup();
  });
});

describe("the deployed page survives a slow or failing boot", () => {
  it("ships a fallback inside #root so the page is never blank before React mounts", () => {
    // jsdom serves modules over http, so import.meta.url is not a file URL;
    // vitest runs with the app directory as cwd.
    const html = readFileSync(path.join(process.cwd(), "index.html"), "utf8");
    const root = html.match(/<div id="root">([\s\S]*?)<\/div>\s*<\/div>/);
    expect(root, "index.html must keep a fallback inside #root").not.toBeNull();
    expect(root?.[1]).toMatch(/role="status"/);
    expect(root?.[1]).toMatch(/Pulse/);
    // Boot markup is worthless if it needs the bundle to paint.
    expect(root?.[1]).not.toMatch(/<script/);
  });

  it("states a failed boot on the page instead of leaving the fallback up", () => {
    const container = document.createElement("div");
    container.innerHTML = '<div class="boot" role="status"><p>Generating a synthetic person</p></div>';

    renderBootFailure(container, new Error("connector registry is empty"));

    const alert = container.querySelector('[role="alert"]');
    expect(alert).not.toBeNull();
    expect(container.textContent).toContain("Pulse could not start");
    expect(container.textContent).toContain("connector registry is empty");
    expect(container.textContent).not.toContain("Generating a synthetic person");
    // Nothing left the browser, and the reader should be told so.
    expect(container.textContent).toMatch(/nothing was sent anywhere/);
  });

  it("reports a non-Error rejection as text rather than rendering it as markup", () => {
    const container = document.createElement("div");

    renderBootFailure(container, '<img src=x onerror="alert(1)">');

    expect(container.querySelector("img")).toBeNull();
    expect(container.textContent).toContain('<img src=x onerror="alert(1)">');
  });

  it("yields to a paint before the caller does its expensive work", async () => {
    const order: string[] = [];
    const frames = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      order.push("frame");
      callback(0);
      return 0;
    });

    const waited = afterPaint().then(() => order.push("resumed"));
    order.push("sync");
    await waited;

    expect(order).toEqual(["frame", "sync", "resumed"]);
    frames.mockRestore();
  });
});
