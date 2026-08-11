import { describe, it, expect, beforeEach, vi } from "vitest";
import { reflectSnapshot, PULSE_EVENT, PULSE_OPT_IN_KEY } from "./pulse";
import type { Entry } from "./types";

function entry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "e1",
    createdAt: new Date().toISOString(),
    title: "T",
    messages: [{ role: "user", content: "hi" }],
    status: "complete",
    summary: {
      trace: {
        event: "E",
        observations: ["o"],
        assumptions: ["a"],
        namedEmotion: "shame",
        alternativeInterpretations: ["alt"],
        intendedOutcome: "outcome",
        intendedAction: "action",
        predictedOutcome: "p",
        followUpAt: null,
        followUpNote: null,
      },
      coreEmotion: "shame",
      underlyingTriggers: [],
      possibleBiases: [],
      otherPerspective: "p",
      balancedAssessment: "b",
      cautionFlags: [],
      suggestedNextSteps: [],
      hedgedDisclaimer: null,
    },
    ...overrides,
  };
}

describe("reflectSnapshot", () => {
  it("counts without leaking verbatim text", () => {
    const s = reflectSnapshot([entry(), entry({ id: "e2" })]);
    expect(s.totalReflections).toBe(2);
    expect(s.completed).toBe(2);
    expect(s.summary).toBeTruthy();
    expect(JSON.stringify(s)).not.toMatch(/they think/i);
  });

  it("tracks unresolved due count dated correctly", () => {
    const past = entry({ id: "e-past", summary: { ...entry().summary!, trace: { ...entry().summary!.trace, followUpAt: "2020-01-01" } } });
    const future = entry({ id: "e-future", summary: { ...entry().summary!, trace: { ...entry().summary!.trace, followUpAt: "2099-01-01" } } });
    const s = reflectSnapshot([past, future], new Date("2026-01-02T12:00:00.000Z"));
    expect(s.unresolvedDue).toBe(1);
  });
});

describe("pulse opt-in gating", () => {
  beforeEach(() => {
    try { (globalThis as unknown as { window?: { localStorage?: { clear(): void } } }).window?.localStorage?.clear(); } catch { /* noop */ }
    vi.unstubAllGlobals();
  });

  it("emits snapshot via CustomEvent when window is available", async () => {
    const target = new EventTarget();
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    };
    const win = target as unknown as Window & { localStorage: typeof storage };
    (win as unknown as Record<string, unknown>).localStorage = storage;
    vi.stubGlobal("window", win);
    const spy = vi.fn();
    win.addEventListener(PULSE_EVENT, spy as EventListener);
    const { emitPulse } = await import("./pulse");
    emitPulse([entry()]);
    expect(spy).toHaveBeenCalledTimes(1);
    win.removeEventListener(PULSE_EVENT, spy as EventListener);
    vi.unstubAllGlobals();
  });

  it("isPulseOptIn and setPulseOptIn round-trip via window.localStorage", async () => {
    const store = new Map<string, string>();
    const storage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => { store.set(k, v); },
      removeItem: (k: string) => { store.delete(k); },
      clear: () => store.clear(),
    };
    vi.stubGlobal("window", { localStorage: storage } as unknown as Window & typeof globalThis);
    const { isPulseOptIn, setPulseOptIn } = await import("./pulse");
    setPulseOptIn(true);
    expect(isPulseOptIn()).toBe(true);
    expect(storage.getItem(PULSE_OPT_IN_KEY)).toBe("1");
    setPulseOptIn(false);
    expect(isPulseOptIn()).toBe(false);
    expect(storage.getItem(PULSE_OPT_IN_KEY)).toBeNull();
    vi.unstubAllGlobals();
  });
});
