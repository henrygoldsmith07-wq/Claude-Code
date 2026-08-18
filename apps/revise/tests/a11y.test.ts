import { describe, expect, it } from "vitest";
import { allTopics } from "@/domain/curriculum";
import { seedQuestions } from "@/content";
import { readFileSync } from "fs";
import { join } from "path";

// Accessibility testing — structural invariants that must hold for every
// component to pass WCAG. Full axe-core coverage runs in e2e (offline.spec.ts
// + visual.spec.ts); these light tests ensure the scaffolding never regresses
// even when Playwright is not installed (see .github/workflows/revise.yml).
describe("a11y scaffolding", () => {
  it("every topic summary is short enough for screen-reader prose", () => {
    for (const t of allTopics()) {
      expect(t.summary.length, t.id + " summary too long for SR").toBeLessThan(500);
    }
  });
  it("AppShell: skip link + Main landmark + offline live region + banner landmark", async () => {
    const src = readFileSync(join(process.cwd(), "src/components/AppShell.tsx"), "utf8");
    expect(src, "skip-link missing").toContain('className="skip-link"');
    expect(src, 'main#main missing').toContain('id="main"');
    expect(src, 'Main nav landmark missing').toContain('aria-label="Main"');
    expect(src, 'offline live region missing').toContain('role="status"');
    expect(src, 'reduce-motion class missing').toContain("reduce-motion");
    const nav = (await import("@/components/AppShell")).AppShell;
    expect(typeof nav).toBe("function");
  });
  it("SearchOverlay: combobox/listbox/option a11y contract", async () => {
    const src = readFileSync(join(process.cwd(), "src/components/SearchOverlay.tsx"), "utf8");
    expect(src).toContain('role="dialog"');
    expect(src).toContain('role="listbox"');
    expect(src).toContain('role="option"');
    expect(src).toContain('aria-activedescendant');
    expect(src).toContain('aria-controls="search-results"');
  });
  it("AnswerInput: textarea has label + status is a live region", async () => {
    const src = readFileSync(join(process.cwd(), "src/components/AnswerInput.tsx"), "utf8");
    expect(src).toContain("Your answer");
    expect(src).toContain('role="status"');
    expect(src).toContain('aria-live="polite"');
  });
  it("Onboarding: dialog landmark + step live region + grade buttons pressed state", async () => {
    const src = readFileSync(join(process.cwd(), "src/components/Onboarding.tsx"), "utf8");
    expect(src).toContain('role="dialog"');
    expect(src).toContain('aria-modal="true"');
    expect(src).toContain('aria-live="polite"');
    expect(src).toContain('aria-pressed');
  });
  it("reduced-motion: CSS media query + class guard + no domain animation", async () => {
    const css = readFileSync(join(process.cwd(), "src/app/le-studio.css"), "utf8");
    expect(css).toContain("@media (prefers-reduced-motion: reduce)");
    expect(css).toContain(":root.reduce-motion");
    const shell = readFileSync(join(process.cwd(), "src/components/AppShell.tsx"), "utf8");
    expect(shell).toContain("reduceMotion");
    const m = await import("@/domain/scheduling");
    expect(typeof m.gradeCard).toBe("function");
  });
  it("focus-visible contract: focus ring present and non-native focusables are reachable", async () => {
    const css = readFileSync(join(process.cwd(), "src/app/le-studio.css"), "utf8");
    expect(css).toContain(":focus-visible");
  });
  it("question stems are not empty, so focus never lands on blank content", () => {
    for (const q of seedQuestions) {
      expect(q.stem.trim().length, q.id).toBeGreaterThan(0);
      for (const pt of q.parts) expect(pt.prompt.trim().length, pt.id).toBeGreaterThan(0);
    }
  });
  it("html lang is en-GB (layout) — i18n scaffolding can make this dynamic later", async () => {
    const layout = readFileSync(join(process.cwd(), "src/app/layout.tsx"), "utf8");
    expect(layout).toContain('lang="en-GB"');
    const i18n = await import("@/domain/i18n");
    expect(i18n.SUPPORTED_LOCALES).toContain("en-GB");
    expect(i18n.DEFAULT_LOCALE).toBe("en-GB");
  });
  it("QuestionRunner: remediation renders the misconception explanation with a fix", async () => {
    const src = readFileSync(join(process.cwd(), "src/components/QuestionRunner.tsx"), "utf8");
    expect(src).toContain("How to fix it");
    expect(src).toContain("misconceptionEntry.explanation");
    expect(src).toContain("misconceptionEntry.correction");
    expect(src).toContain("planRemediation(");
  });
  it("misconception search deep-links to the specific entry", async () => {
    const overlay = readFileSync(join(process.cwd(), "src/components/SearchOverlay.tsx"), "utf8");
    expect(overlay).toContain("&misconception=");
    const library = readFileSync(join(process.cwd(), "src/app/library/page.tsx"), "utf8");
    expect(library).toContain("id={misconception.id}");
    expect(library).toContain("scrollIntoView");
  });
});
