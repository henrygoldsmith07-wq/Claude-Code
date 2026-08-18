import { clamp } from "./descriptive.js";

/** Controls exposed by the advanced statistical inspector. */
export interface StatisticalInspectorOptions {
  /** False-discovery rate used by Benjamini-Hochberg. */
  fdrLevel: number;
  /** Minimum standardised effect worth showing. */
  minEffect: number;
  /** Event windows used for exposure-window questions. */
  exposureWindowsHours: readonly number[];
  /** Maximum lag considered for daily relationships. */
  maxLagDays: number;
}

const DEFAULT_EXPOSURE_WINDOWS = [4, 24] as const;

export function createDefaultStatisticalInspectorOptions(): StatisticalInspectorOptions {
  return {
    fdrLevel: 0.05,
    minEffect: 0.2,
    exposureWindowsHours: [...DEFAULT_EXPOSURE_WINDOWS],
    maxLagDays: 2,
  };
}

/** Keeps UI-supplied values within the supported, auditable analysis range. */
export function normaliseStatisticalInspectorOptions(
  input: Partial<StatisticalInspectorOptions> = {},
): StatisticalInspectorOptions {
  const windows = [...new Set(
    (input.exposureWindowsHours ?? DEFAULT_EXPOSURE_WINDOWS)
      .filter((value) => Number.isFinite(value) && value > 0 && value <= 168)
      .map((value) => Math.round(value)),
  )].sort((a, b) => a - b);

  return {
    fdrLevel: clamp(finiteOr(input.fdrLevel, 0.05), 0.01, 0.2),
    minEffect: clamp(finiteOr(input.minEffect, 0.2), 0.05, 1.5),
    exposureWindowsHours: windows.length ? windows : [...DEFAULT_EXPOSURE_WINDOWS],
    maxLagDays: Math.round(clamp(finiteOr(input.maxLagDays, 2), 0, 14)),
  };
}

export function sameStatisticalInspectorOptions(
  left: StatisticalInspectorOptions,
  right: StatisticalInspectorOptions,
): boolean {
  return (
    left.fdrLevel === right.fdrLevel &&
    left.minEffect === right.minEffect &&
    left.maxLagDays === right.maxLagDays &&
    left.exposureWindowsHours.length === right.exposureWindowsHours.length &&
    left.exposureWindowsHours.every((value, index) => value === right.exposureWindowsHours[index])
  );
}

function finiteOr(value: number | undefined, fallback: number): number {
  return value !== undefined && Number.isFinite(value) ? value : fallback;
}
