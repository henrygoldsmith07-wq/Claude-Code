// Pulse integration for Reflect — explicit opt-in only.
// When the user enables it, Reflect emits aggregated, non-sensitive snapshots
// to the Pulse aggregator via a CustomEvent. No content is sent by default.

import type { Entry } from "./types";
import { calibrationFor, longitudinalSummary } from "./longitudinal";

export const PULSE_EVENT = "reflect:pulse";

export interface ReflectPulseSnapshot {
  at: string;
  totalReflections: number;
  completed: number;
  reviewed: number;
  calibration: ReturnType<typeof calibrationFor>;
  summary: string; // longitudinalSummary — counts only, no verbatim entry text
  unresolvedDue: number;
}

export function reflectSnapshot(entries: Entry[], now = new Date()): ReflectPulseSnapshot {
  const totalReflections = entries.length;
  const completed = entries.filter((e) => e.status === "complete" && e.summary).length;
  const reviewed = entries.filter((e) => e.longitudinalReview?.assumptionVerdict).length;
  const calibration = calibrationFor(entries);
  const summary = longitudinalSummary(entries);
  const unresolvedDue = entries.filter((e) => {
    if (!e.summary || e.longitudinalReview?.assumptionVerdict) return false;
    const d = e.summary.trace.followUpAt ? new Date(e.summary.trace.followUpAt) : null;
    if (!d || Number.isNaN(d.getTime())) return false;
    const t = new Date(now); t.setHours(0,0,0,0); d.setHours(0,0,0,0);
    return d.getTime() <= t.getTime();
  }).length;
  return { at: new Date(now).toISOString(), totalReflections, completed, reviewed, calibration, summary, unresolvedDue };
}

export function emitPulse(entries: Entry[]): void {
  if (typeof window === "undefined") return;
  const snapshot = reflectSnapshot(entries);
  window.dispatchEvent(new CustomEvent(PULSE_EVENT, { detail: snapshot }));
}

// LocalStorage key that gates Pulse — off by default, explicit opt-in
export const PULSE_OPT_IN_KEY = "reflectPulseOptIn";

export function isPulseOptIn(): boolean {
  if (typeof window === "undefined") return false;
  try { return window.localStorage.getItem(PULSE_OPT_IN_KEY) === "1"; } catch { return false; }
}
export function setPulseOptIn(v: boolean): void {
  if (typeof window === "undefined") return;
  try {
    if (v) window.localStorage.setItem(PULSE_OPT_IN_KEY, "1");
    else window.localStorage.removeItem(PULSE_OPT_IN_KEY);
  } catch { /* ignore */ }
}
