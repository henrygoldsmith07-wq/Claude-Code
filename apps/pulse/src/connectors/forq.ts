/**
 * Forq connector — meal and shopping planning.
 *
 * Nutrition is the classic confounded signal in personal analytics ("I ate
 * well and studied well" usually means "it was a good week"), so this
 * connector emits plan *adherence* alongside intake. Adherence is behavioural
 * and much less collinear with mood than macro totals are.
 */

import { defineReaderConnector } from "./sdk.js";
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

export function createForqConnector(reader: SourceReader<ForqRecord>): Connector {
  return defineReaderConnector<ForqRecord>({
    id: "forq",
    name: "Forq",
    version: "1.0.0",
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
