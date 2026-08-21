import type { DbCheckin, DbHabit, HabitExportV1 } from "./types";

/**
 * Build a structured export containing habits, checkins, settings, version.
 * The export is the user's durable backup and import source.
 */
export function buildExport(args: {
  habits: DbHabit[];
  checkins: DbCheckin[];
  pulseOptIn: boolean;
  userId?: string | null;
  exportedAt?: string;
}): HabitExportV1 {
  return {
    version: 1,
    exportedAt: args.exportedAt ?? new Date().toISOString(),
    userId: args.userId ?? undefined,
    habits: args.habits.map(sanitizeHabit),
    checkins: args.checkins.map(sanitizeCheckin),
    settings: { pulseOptIn: Boolean(args.pulseOptIn) },
  };
}

export function serializeExport(exp: HabitExportV1): string {
  return JSON.stringify(exp, null, 2);
}

export type ImportResult =
  | { ok: true; data: HabitExportV1 }
  | { ok: false; error: string };

export function validateImport(raw: unknown): ImportResult {
  if (typeof raw !== "object" || raw === null) return { ok: false, error: "export must be an object" };
  const o = raw as Record<string, unknown>;
  if (o.version !== 1) return { ok: false, error: "unsupported version (expected 1)" };
  if (typeof o.exportedAt !== "string" || Number.isNaN(Date.parse(o.exportedAt))) {
    return { ok: false, error: "exportedAt must be an ISO date" };
  }
  if (!Array.isArray(o.habits)) return { ok: false, error: "habits must be an array" };
  if (!Array.isArray(o.checkins)) return { ok: false, error: "checkins must be an array" };
  if (typeof o.settings !== "object" || o.settings === null) return { ok: false, error: "settings missing" };
  const settings = o.settings as Record<string, unknown>;
  if (typeof settings.pulseOptIn !== "boolean") return { ok: false, error: "settings.pulseOptIn must be boolean" };

  for (const h of o.habits) {
    const err = validateHabit(h);
    if (err) return { ok: false, error: `habit: ${err}` };
  }
  for (const c of o.checkins) {
    const err = validateCheckin(c, o.habits as DbHabit[]);
    if (err) return { ok: false, error: `checkin: ${err}` };
  }

  // Check uniqueness: one checkin per habit per day
  const seen = new Set<string>();
  for (const c of o.checkins as DbCheckin[]) {
    const key = `${c.habit_id}:${c.day}`;
    if (seen.has(key)) return { ok: false, error: `duplicate checkin for ${key}` };
    seen.add(key);
  }

  return { ok: true, data: o as unknown as HabitExportV1 };
}

export function parseImportJSON(json: string): ImportResult {
  try {
    const parsed = JSON.parse(json);
    return validateImport(parsed);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "invalid JSON" };
  }
}

function sanitizeHabit(h: DbHabit): DbHabit {
  return {
    id: String(h.id),
    user_id: String(h.user_id),
    name: String(h.name).trim().slice(0, 80),
    target_per_week: clampInt(h.target_per_week, 1, 7, 3),
    colour: isHexColor(h.colour) ? h.colour : "#6366f1",
    sort_order: Number.isFinite(h.sort_order) ? h.sort_order : 0,
    archived: Boolean(h.archived),
    created_at: isISODate(h.created_at) ? h.created_at : new Date().toISOString(),
  };
}

function sanitizeCheckin(c: DbCheckin): DbCheckin {
  return {
    id: String(c.id),
    habit_id: String(c.habit_id),
    day: String(c.day),
    completed: Boolean(c.completed),
    created_at: isISODate(c.created_at) ? c.created_at : new Date().toISOString(),
  };
}

function validateHabit(h: unknown): string | null {
  if (typeof h !== "object" || h === null) return "must be object";
  const o = h as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id) return "id required";
  if (typeof o.name !== "string" || o.name.trim().length === 0 || o.name.trim().length > 80) return "name 1-80 chars";
  if (!Number.isInteger(o.target_per_week) || (o.target_per_week as number) < 1 || (o.target_per_week as number) > 7) return "target_per_week 1-7";
  if (typeof o.colour !== "string" || !isHexColor(o.colour)) return "colour hex";
  if (typeof o.sort_order !== "number" || !Number.isFinite(o.sort_order)) return "sort_order number";
  if (typeof o.archived !== "boolean") return "archived boolean";
  if (typeof o.created_at !== "string" || Number.isNaN(Date.parse(o.created_at))) return "created_at ISO";
  // user_id optional on import: will be reassigned to importing user
  if (o.user_id !== undefined && typeof o.user_id !== "string") return "user_id string";
  return null;
}

function validateCheckin(c: unknown, habits: DbHabit[]): string | null {
  if (typeof c !== "object" || c === null) return "must be object";
  const o = c as Record<string, unknown>;
  if (typeof o.id !== "string" || !o.id) return "id required";
  if (typeof o.habit_id !== "string" || !o.habit_id) return "habit_id required";
  if (typeof o.day !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(o.day)) return "day YYYY-MM-DD";
  if (typeof o.completed !== "boolean") return "completed boolean";
  if (typeof o.created_at !== "string" || Number.isNaN(Date.parse(o.created_at))) return "created_at ISO";
  if (!habits.some((h) => h.id === o.habit_id)) return `habit_id ${o.habit_id} not in habits`;
  // Validate date is real
  const d = new Date(`${o.day}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "day invalid date";
  return null;
}

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  if (typeof v !== "number" || !Number.isInteger(v)) return fallback;
  return Math.max(min, Math.min(max, v));
}
function isHexColor(s: unknown): boolean {
  return typeof s === "string" && /^#[0-9A-Fa-f]{6}$/.test(s);
}
function isISODate(s: unknown): boolean {
  return typeof s === "string" && !Number.isNaN(Date.parse(s));
}
