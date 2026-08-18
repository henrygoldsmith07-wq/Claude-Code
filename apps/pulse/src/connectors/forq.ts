/**
 * Forq connector — meal and shopping planning.
 *
 * Nutrition is the classic confounded signal in personal analytics ("I ate
 * well and studied well" usually means "it was a good week"), so this
 * connector emits plan *adherence* alongside intake. Adherence is behavioural
 * and much less collinear with mood than macro totals are.
 */

import { defineReaderConnector } from "./sdk.js";
import { createSameOriginReader, type StorageLike } from "./same-origin.js";
import type { Connector, ConnectorScope, EmittedEventSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";

export interface ForqMealRecord {
  kind: "meal";
  id: string;
  loggedAt: string;
  slot: "breakfast" | "lunch" | "dinner" | "snack";
  energyKcal?: number;
  proteinG?: number;
  carbsG?: number;
  fatG?: number;
  /** True when the meal matched what was planned for that slot. */
  matchedPlan?: boolean;
  homeCooked?: boolean;
  /**
   * True when the source recorded only a date and the time was assumed. The
   * quality scorer discounts these and the lag analysis excludes them from
   * within-day timing questions.
   */
  timeEstimated?: boolean;
  timezone?: string;
}

export interface ForqPlanRecord {
  kind: "plan-day";
  id: string;
  dateISO: string;
  closedAt: string;
  plannedMeals: number;
  completedMeals: number;
  shopSpend?: number;
  timezone?: string;
}

export type ForqRecord = ForqMealRecord | ForqPlanRecord;

const SCOPES: ConnectorScope[] = [
  { id: "meals", description: "Logged meals: slot, macros and whether they matched the plan", readsContent: false },
  { id: "plan", description: "Daily plan completion and shopping spend", readsContent: false },
];

const EMITS: EmittedEventSpec[] = [
  {
    type: "forq.meal",
    category: "wellbeing",
    description: "A logged meal",
    metrics: [
      { key: "energy_kcal", unit: "count", description: "Energy", range: { min: 0, max: 6000 } },
      { key: "protein_g", unit: "count", description: "Protein", range: { min: 0, max: 400 } },
      { key: "carbs_g", unit: "count", description: "Carbohydrate", range: { min: 0, max: 900 } },
      { key: "fat_g", unit: "count", description: "Fat", range: { min: 0, max: 400 } },
      { key: "plan_match", unit: "ratio", description: "1 when the meal matched the plan", range: { min: 0, max: 1 } },
    ],
  },
  {
    type: "forq.plan_day",
    category: "wellbeing",
    description: "End-of-day plan adherence",
    metrics: [
      { key: "plan_adherence", unit: "ratio", description: "Completed / planned meals", range: { min: 0, max: 1 } },
      { key: "planned_meals", unit: "count", description: "Meals planned", range: { min: 0, max: 12 } },
      { key: "shop_spend", unit: "count", description: "Shopping spend for the day", range: { min: 0, max: 1000 } },
    ],
  },
];

export function mapForqRecord(record: ForqRecord): RawEventInput[] {
  if (record.kind === "meal") {
    const metrics: Record<string, number> = {};
    if (typeof record.energyKcal === "number") metrics.energy_kcal = record.energyKcal;
    if (typeof record.proteinG === "number") metrics.protein_g = record.proteinG;
    if (typeof record.carbsG === "number") metrics.carbs_g = record.carbsG;
    if (typeof record.fatG === "number") metrics.fat_g = record.fatG;
    if (record.matchedPlan !== undefined) metrics.plan_match = record.matchedPlan ? 1 : 0;
    if (Object.keys(metrics).length === 0) return []; // Nothing measurable was logged.

    return [
      {
        source: "forq",
        sourceEventId: record.id,
        type: "forq.meal",
        category: "wellbeing",
        occurredAt: record.loggedAt,
        ...(record.timezone ? { timezone: record.timezone } : {}),
        subject: record.slot,
        metrics,
        attributes: {
          slot: record.slot,
          ...(record.homeCooked !== undefined ? { home_cooked: record.homeCooked } : {}),
          ...(record.timeEstimated ? { time_estimated: true } : {}),
        },
      },
    ];
  }

  if (record.plannedMeals <= 0) return [];
  const metrics: Record<string, number> = {
    plan_adherence: Math.min(1, record.completedMeals / record.plannedMeals),
    planned_meals: record.plannedMeals,
  };
  if (typeof record.shopSpend === "number") metrics.shop_spend = record.shopSpend;

  return [
    {
      source: "forq",
      sourceEventId: record.id,
      type: "forq.plan_day",
      category: "wellbeing",
      occurredAt: record.closedAt,
      ...(record.timezone ? { timezone: record.timezone } : {}),
      subject: "plan",
      metrics,
      attributes: { local_date: record.dateISO },
    },
  ];
}

/** Where Forq keeps its state when both apps are served from one origin. */
export const FORQ_STORAGE_KEY = "forq-state-v2";

/** Local hour assumed for each slot when Forq recorded only a date. */
const SLOT_HOURS: Record<string, number> = { breakfast: 8, lunch: 13, dinner: 19, snack: 16 };

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isSlot(value: string): value is ForqMealRecord["slot"] {
  return value === "breakfast" || value === "lunch" || value === "dinner" || value === "snack";
}

/**
 * Pull Pulse records out of Forq's persisted state.
 *
 * Forq logs a cooked meal as `{ recipeId, date }` — no time, no slot, no id and
 * no macros. Three consequences, each handled rather than papered over:
 *
 *  - **Slot** is recovered by looking the recipe up in that day's plan, which is
 *    keyed `plan[date][slot]`. A meal cooked off-plan has no recoverable slot,
 *    and since the slot is what the event is *about*, guessing one would invent
 *    the finding. Those are left out of meal events and still counted in the
 *    day's completions, where they genuinely belong.
 *  - **Time** is assumed from the slot and flagged `timeEstimated`, so the
 *    engine discounts it instead of trusting a time Forq never recorded.
 *  - **Identity** is the date, slot and recipe together, which is stable across
 *    syncs and is what dedup needs.
 *
 * Plan-days are only emitted for dates already past. Today's plan is still being
 * worked through, and scoring adherence at noon would report a shortfall that is
 * just the afternoon not having happened yet.
 */
export function selectForqRecords(state: unknown): ForqRecord[] {
  const store = (state ?? {}) as {
    plan?: Record<string, Record<string, unknown>>;
    cooked?: unknown;
    shops?: unknown;
    day?: unknown;
  };
  const plan = (store.plan ?? {}) as Record<string, Record<string, unknown>>;
  const cooked = Array.isArray(store.cooked) ? store.cooked : [];
  const shops = Array.isArray(store.shops) ? store.shops : [];
  const today = typeof store.day === "string" && DATE_ONLY.test(store.day) ? store.day : null;

  const records: ForqRecord[] = [];
  const cookedByDate = new Map<string, number>();

  for (const raw of cooked) {
    const entry = raw as { recipeId?: unknown; date?: unknown };
    if (typeof entry.date !== "string" || !DATE_ONLY.test(entry.date)) continue;
    cookedByDate.set(entry.date, (cookedByDate.get(entry.date) ?? 0) + 1);
    if (typeof entry.recipeId !== "string") continue;

    const dayPlan = plan[entry.date] ?? {};
    const slot = Object.keys(dayPlan).find(
      (candidate) => isSlot(candidate) && dayPlan[candidate] === entry.recipeId,
    );
    if (slot === undefined || !isSlot(slot)) continue; // Off-plan: no slot to speak of.

    const hour = String(SLOT_HOURS[slot] ?? 12).padStart(2, "0");
    records.push({
      kind: "meal",
      id: `${entry.date}:${slot}:${entry.recipeId}`,
      loggedAt: `${entry.date}T${hour}:00:00.000Z`,
      slot,
      matchedPlan: true,
      homeCooked: true, // Forq's `cooked` log is by definition food made at home.
      timeEstimated: true,
    });
  }

  const spendByDate = new Map<string, number>();
  for (const raw of shops) {
    const trip = raw as { date?: unknown; total?: unknown };
    if (typeof trip.date !== "string" || !DATE_ONLY.test(trip.date)) continue;
    if (typeof trip.total !== "number" || !Number.isFinite(trip.total)) continue;
    spendByDate.set(trip.date, (spendByDate.get(trip.date) ?? 0) + trip.total);
  }

  for (const [date, dayPlan] of Object.entries(plan)) {
    if (!DATE_ONLY.test(date)) continue;
    if (today !== null && date >= today) continue; // Still in progress.
    const plannedMeals = Object.keys(dayPlan ?? {}).filter(
      (slot) => isSlot(slot) && Boolean(dayPlan[slot]),
    ).length;
    if (plannedMeals === 0) continue;

    const spend = spendByDate.get(date);
    records.push({
      kind: "plan-day",
      id: `plan:${date}`,
      dateISO: date,
      // A day-level fact, so the day's own boundary is the honest timestamp.
      closedAt: `${date}T23:59:59.999Z`,
      plannedMeals,
      completedMeals: cookedByDate.get(date) ?? 0,
      ...(spend !== undefined ? { shopSpend: spend } : {}),
    });
  }

  return records;
}

/**
 * A Forq connector reading the real app's storage at a shared origin.
 *
 * Unlike Arise and Reflect, Forq has no Pulse opt-in of its own, so the gate is
 * Pulse's own per-connector grant — the same one the health, wearable and
 * calendar sources rely on. If Forq later grows its own flag, pass it as
 * `consent` and it becomes the stricter of the two.
 */
export function createForqSameOriginConnector(
  options: { storage?: StorageLike | null } = {},
): Connector {
  return createForqConnector(
    createSameOriginReader<ForqRecord>({
      key: FORQ_STORAGE_KEY,
      label: "Forq",
      select: selectForqRecords,
      ...(options.storage !== undefined ? { storage: options.storage } : {}),
      timestampOf: (record) => (record.kind === "meal" ? record.loggedAt : record.closedAt),
    }),
  );
}

export function createForqConnector(reader: SourceReader<ForqRecord>): Connector {
  return defineReaderConnector<ForqRecord>({
    id: "forq",
    name: "Forq",
    version: "2.0.0",
    category: "wellbeing",
    description: "Meal logs, macros and daily plan adherence.",
    scopes: SCOPES,
    emits: EMITS,
    maxBackfillDays: 1095,
    reader,
    map: (record) => mapForqRecord(record),
    timestampOf: (record) => (record.kind === "meal" ? record.loggedAt : record.closedAt),
  });
}
