import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { checkFeedbackLanguage, checkForDistress } from "@/domain/safety";

// ---------------------------------------------------------------------------
// Accessibility and interface-contract checks.
//
// These are source-level assertions rather than a rendered audit: they catch
// the regressions that actually happen in this codebase — an icon-only button
// shipped without a label, a hard-coded colour that breaks in dark mode, a
// positive tabindex — cheaply enough to run on every commit. A rendered pass
// (axe in Playwright) belongs in e2e; this is the tripwire.
// ---------------------------------------------------------------------------

function sourceFiles(directory: string, extensions = [".tsx", ".ts"]): string[] {
  const entries = readdirSync(directory);
  return entries.flatMap((entry) => {
    const path = join(directory, entry);
    if (statSync(path).isDirectory()) return sourceFiles(path, extensions);
    return extensions.some((extension) => path.endsWith(extension)) ? [path] : [];
  });
}

const UI_FILES = [...sourceFiles("src/app"), ...sourceFiles("src/components")];
const read = (path: string) => readFileSync(path, "utf8");

describe("accessibility contracts", () => {
  it("never uses a positive tabindex", () => {
    for (const file of UI_FILES) {
      expect(read(file), file).not.toMatch(/tabIndex=\{[1-9]/);
    }
  });

  it("labels every icon-only control", () => {
    // Buttons whose children are only an icon component must carry an
    // aria-label or aria-labelledby.
    for (const file of UI_FILES) {
      const source = read(file);
      const iconOnly = source.match(/<(?:button|Button)[^>]*>\s*<[A-Z]\w+ size=\{\d+\}[^>]*\/>\s*<\/(?:button|Button)>/g) ?? [];
      for (const match of iconOnly) {
        expect(match, `${file}: icon-only control without a label`).toMatch(/aria-label|aria-labelledby/);
      }
    }
  });

  it("marks decorative icons as hidden from assistive technology", () => {
    for (const file of UI_FILES) {
      const source = read(file);
      const icons = source.match(/<(?:ArrowRight|ArrowLeft|Check|X|RefreshCw|Send|Mic|Square|BarChart3|CalendarCheck|MessageCircle|Network|Sparkles)\s[^>]*\/>/g) ?? [];
      for (const icon of icons) {
        expect(icon, `${file}: ${icon}`).toMatch(/aria-hidden/);
      }
    }
  });

  it("uses theme tokens rather than hard-coded colours", () => {
    for (const file of UI_FILES) {
      // layout.tsx is the one exception: the browser-chrome themeColor must be
      // a literal, because it is read before any stylesheet loads.
      if (file.endsWith("layout.tsx")) continue;
      const source = read(file);
      // Hex colours in components break dark mode; the palette lives in globals.css.
      const hexes = source.match(/#[0-9a-fA-F]{3,8}\b/g) ?? [];
      expect(hexes, `${file}: hard-coded colours ${hexes.join(", ")}`).toHaveLength(0);
    }
  });

  it("gives the app a skip link and a main landmark", () => {
    const layout = read("src/app/layout.tsx");
    expect(layout).toMatch(/skip-link/);
    expect(layout).toMatch(/<main/);
    expect(layout).toMatch(/id="main"/);
    expect(layout).toMatch(/lang="en-GB"/);
  });

  it("marks the current page for screen readers, not just visually", () => {
    const nav = read("src/components/nav.tsx");
    expect(nav).toMatch(/aria-current/);
    expect(nav).toMatch(/aria-label="Primary"/);
  });

  it("keeps mobile navigation targets large enough to hit", () => {
    const nav = read("src/components/nav.tsx");
    expect(nav).toMatch(/min-h-\[5[6-9]px\]|min-h-\[6\dpx\]/);
  });

  it("announces the live transcript in practice conversations", () => {
    const runner = read("src/components/simulation-runner.tsx");
    expect(runner).toMatch(/aria-live/);
    expect(runner).toMatch(/role="log"/);
  });

  it("supports reduced motion at the root, independently of the OS setting", () => {
    const css = read("src/app/globals.css");
    expect(css).toMatch(/prefers-reduced-motion/);
    expect(css).toMatch(/\[data-reduced-motion="true"\]/);
  });

  it("defines a complete dark palette rather than patching individual colours", () => {
    const css = read("src/app/globals.css");
    const tokensIn = (pattern: RegExp): string[] => {
      const block = css.match(pattern)?.[1] ?? "";
      return [...block.matchAll(/--([\w-]+):/g)].map((match) => match[1] ?? "");
    };
    const light = tokensIn(/:root\s*\{([\s\S]*?)\}/);
    const dark = tokensIn(/:root\[data-theme="dark"\]\s*\{([\s\S]*?)\}/);
    for (const token of light) {
      if (token === "radius") continue;
      expect(dark, `--${token} has no dark-mode value`).toContain(token);
    }
  });

  it("never removes focus outlines", () => {
    const css = read("src/app/globals.css");
    expect(css).not.toMatch(/outline:\s*none/);
    expect(css).toMatch(/:focus-visible/);
  });

  it("labels every form control", () => {
    for (const file of UI_FILES) {
      const source = read(file);
      const inputs = source.match(/<(?:input|textarea|TextInput|TextArea)\s[^>]*>/g) ?? [];
      for (const input of inputs) {
        const hasId = /id=/.test(input);
        const hasAria = /aria-label/.test(input);
        expect(hasId || hasAria, `${file}: unlabelled control ${input.slice(0, 60)}`).toBe(true);
      }
    }
  });
});

describe("copy contracts", () => {
  /**
   * Visible prose only: JSX text nodes plus the attributes a user can read.
   * Scanning raw source would flag class names and the comments that explain
   * these very rules, which is how a check like this stops being run.
   */
  function visibleCopy(file: string): string {
    const source = read(file).replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const textNodes = [...source.matchAll(/>([^<>{}]{4,})</g)].map((match) => match[1] ?? "");
    const attributes = [...source.matchAll(/(?:placeholder|title|aria-label|subtitle|label|body)=\{?"([^"]{4,})"/g)].map(
      (match) => match[1] ?? "",
    );
    return [...textNodes, ...attributes].join("\n");
  }

  it("never presents a single overall ability score", () => {
    for (const file of UI_FILES) {
      expect(visibleCopy(file), file).not.toMatch(/social score|overall score|ability score|social rating/i);
    }
  });

  it("never uses loss framing about streaks", () => {
    for (const file of UI_FILES) {
      expect(visibleCopy(file), file).not.toMatch(/don'?t break your streak|you lost your streak|streak broken/i);
    }
  });

  it("keeps trait language out of the interface", () => {
    for (const file of UI_FILES) {
      const verdict = checkFeedbackLanguage(visibleCopy(file));
      expect(verdict.verdict, `${file}: ${verdict.reasons.join(", ")}`).toBe("ok");
    }
  });

  it("tells the user where their data goes wherever they type something private", () => {
    const reflection = read("src/components/reflection-form.tsx");
    expect(reflection).toMatch(/stays on this device|leave this device/i);
  });
});

describe("safety gate false positives", () => {
  // Both of these were real bugs found by the content validator: substring
  // matching fired "fit" on "fits", and a bare "end it" fired the crisis
  // response on "end it deliberately".
  it("does not read ordinary copy as distress", () => {
    const ordinary = [
      "Hold your share of the conversation and end it deliberately.",
      "End the conversation warmly rather than letting it fade.",
      "I want to end this project on a high.",
    ];
    for (const text of ordinary) expect(checkForDistress(text), text).toBeNull();
  });

  it("still catches genuine disclosures", () => {
    for (const text of ["I've been thinking about ending it all", "I want to end my life"]) {
      expect(checkForDistress(text)?.verdict, text).toBe("support");
    }
  });

  it("does not read 'fits' as a comment about appearance", () => {
    expect(checkFeedbackLanguage("Relate something of your own if it genuinely fits.").verdict).toBe("ok");
    expect(checkFeedbackLanguage("You looked very fit in that meeting.").verdict).toBe("block");
  });
});
