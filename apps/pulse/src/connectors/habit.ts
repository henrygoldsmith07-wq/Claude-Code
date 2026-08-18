/**
 * Habit connector — the habit-tracker app.
 *
 * Habit stores its rows in Supabase, not localStorage, so unlike the sibling
 * apps there is no same-origin state to read: the reader fetches the `habits`
 * and `checkins` tables over PostgREST and the connector maps them.
 *
 * The subtle part is what the connector emits. The app only writes a row when
 * a habit is *done* (unticking deletes it), so the checkins table contains
 * completions and nothing else. A connector that mapped only those rows would
 * make "didn't do the habit" invisible — and then Pulse could never ask
 * whether mood or study accuracy differs on done vs not-done days. So the
 * reader synthesises one record per habit per day from the habit's creation
 * date, marking completion from the checkins table. Today is excluded: the
 * day is still in progress, and calling it missed at noon would report a
 * shortfall that is just the afternoon not having happened yet.
 */

import { defineReaderConnector } from "./sdk.js";
import type { Connector, ConnectorScope, EmittedEventSpec, SourceReader } from "./types.js";
import type { RawEventInput } from "../events/normalise.js";
import { addDays } from "../events/time.js";

/** One habit on one calendar day. */
export interface HabitDayRecord {
  kind: "day";
  id: string;
  habitId: string;
  habitName: string;
  targetPerWeek: number;
  colour: string;
  archived: boolean;
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  completed: boolean;
  /** When the app recorded the completion, when one exists. */
  completedAt?: string;
  timezone?: string;
}

/** Row shapes as PostgREST returns them. */
export interface HabitSupabaseRow {
  id: string;
  name: string;
  target_per_week: number;
  colour: string;
  sort_order: number;
  archived: boolean;
  created_at: string;
}

export interface HabitCheckinRow {
  id: string;
  habit_id: string;
  /** The local calendar day, as a date. */
  day: string;
  completed: boolean;
  created_at: string;
}

export interface HabitSupabaseState {
  habits?: readonly HabitSupabaseRow[];
  checkins?: readonly HabitCheckinRow[];
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function isDateOnly(value: unknown): value is string {
  return typeof value === "string" && DATE_ONLY.test(value);
}

/**
 * Synthesise one record per habit per day, from the habit's creation through
 * yesterday. `todayISO` is excluded because the day is still in progress.
 */
export function selectHabitRecords(state: unknown, todayISO: string): HabitDayRecord[] {
  const store = (state ?? {}) as HabitSupabaseState;
  if (!Array.isArray(store.habits)) return [];

  const checkinsByHabit = new Map<string, Map<string, HabitCheckinRow>>();
  if (Array.isArray(store.checkins)) {
    for (const checkin of store.checkins) {
      if (typeof checkin?.habit_id !== "string" || !isDateOnly(checkin.day)) continue;
      if (!checkinsByHabit.has(checkin.habit_id)) checkinsByHabit.set(checkin.habit_id, new Map());
      checkinsByHabit.get(checkin.habit_id)!.set(checkin.day, checkin);
    }
  }

  const records: HabitDayRecord[] = [];
  for (const habit of store.habits) {
    // `created_at` is a full instant from PostgREST; the habit starts existing
    // on its creation *date*.
    if (typeof habit?.id !== "string" || typeof habit.name !== "string" || typeof habit.created_at !== "string") continue;
    const createdDate = habit.created_at.slice(0, 10);
    if (!isDateOnly(createdDate)) continue;
    const targetPerWeek = typeof habit.target_per_week === "number" ? habit.target_per_week : 3;
    const colour = typeof habit.colour === "string" ? habit.colour : "#6366f1";
    const archived = habit.archived === true;
    const checkins = checkinsByHabit.get(habit.id) ?? new Map();

    let day = createdDate;
    while (day < todayISO) {
      const checkin = checkins.get(day);
      records.push({
        kind: "day",
        id: `${habit.id}:${day}`,
        habitId: habit.id,
        habitName: habit.name,
        targetPerWeek,
        colour,
        archived,
        day,
        completed: checkin?.completed === true,
        ...(checkin?.created_at ? { completedAt: checkin.created_at } : {}),
      });
      day = addDays(day, 1);
    }
  }

  records.sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : a.id < b.id ? -1 : 1));
  return records;
}

const SCOPES: ConnectorScope[] = [
  {
    id: "checkins",
    description: "Habit check-ins: which habits you completed on which days, and each habit's weekly target.",
    readsContent: false,
  },
];

const EMITS: EmittedEventSpec[] = [
  {
    type: "habit.checkin",
    category: "wellbeing",
    description: "Whether a habit was completed on a given day",
    metrics: [
      { key: "completed", unit: "ratio", description: "1 when the habit was done that day, 0 otherwise", range: { min: 0, max: 1 } },
    ],
  },
];

/** A missed day is a day-level fact, so the honest timestamp is the day's end. */
function dayEnd(day: string): string {
  return `${day}T23:59:59.999Z`;
}

export function mapHabitRecord(record: HabitDayRecord): RawEventInput[] {
  return [
    {
      source: "habit",
      sourceEventId: `${record.habitId}:${record.day}`,
      type: "habit.checkin",
      category: "wellbeing",
      occurredAt: record.completedAt ?? dayEnd(record.day),
      ...(record.timezone ? { timezone: record.timezone } : {}),
      subject: record.habitId,
      metrics: { completed: record.completed ? 1 : 0 },
      attributes: {
        habit_id: record.habitId,
        habit_name: record.habitName,
        target_per_week: record.targetPerWeek,
        colour: record.colour,
        archived: record.archived,
        time_estimated: record.completedAt === undefined,
      },
    },
  ];
}

export function habitRecordTimestamp(record: HabitDayRecord): string {
  return record.completedAt ?? dayEnd(record.day);
}

export function createHabitConnector(reader: SourceReader<HabitDayRecord>): Connector {
  return defineReaderConnector<HabitDayRecord>({
    id: "habit",
    name: "Habit",
    version: "1.0.0",
    category: "wellbeing",
    description: "Habit check-ins from the Habit tracker: which habits you kept and which you skipped.",
    scopes: SCOPES,
    emits: EMITS,
    maxBackfillDays: 1095,
    cadence: "daily",
    reader,
    map: (record) => mapHabitRecord(record),
    timestampOf: habitRecordTimestamp,
  });
}

export interface HabitSupabaseConnectorOptions {
  /** PostgREST base, e.g. `https://<project>.supabase.co`. */
  url: string;
  anonKey: string;
  fetcher?: typeof fetch;
  /** Zone the app records its `day` values in. Defaults to UTC. */
  timezone?: string;
}

/**
 * Reader over the app's Supabase project. The schema's RLS is permissive by
 * design (the anon key is the whole access story for these personal apps), so
 * reading with the anon key is the same access the app itself uses.
 */
export function createHabitSupabaseConnector(options: HabitSupabaseConnectorOptions): Connector {
  const url = options.url.replace(/\/+$/, "");
  const fetcher = options.fetcher ?? globalThis.fetch;
  const headers = {
    apikey: options.anonKey,
    authorization: `Bearer ${options.anonKey}`,
    accept: "application/json",
  };

  async function fetchState(): Promise<HabitSupabaseState> {
    if (typeof fetcher !== "function") throw new Error("Fetch is unavailable in this environment");
    const [habitsResponse, checkinsResponse] = await Promise.all([
      fetcher(`${url}/rest/v1/habits?select=*`, { headers }),
      fetcher(`${url}/rest/v1/checkins?select=*&order=day.asc`, { headers }),
    ]);
    if (!habitsResponse.ok) throw new Error(`Habit habits table returned HTTP ${habitsResponse.status}`);
    if (!checkinsResponse.ok) throw new Error(`Habit checkins table returned HTTP ${checkinsResponse.status}`);
    const habits = (await habitsResponse.json()) as unknown;
    const checkins = (await checkinsResponse.json()) as unknown;
    return { habits: habits as HabitSupabaseState["habits"], checkins: checkins as HabitSupabaseState["checkins"] };
  }

  const reader: SourceReader<HabitDayRecord> = {
    async read(since, limit) {
      const state = await fetchState();
      const today = todayInZone(options.timezone ?? "UTC");
      const records = selectHabitRecords(state, today);
      const cutoff = since ? Date.parse(since) : -Infinity;
      const eligible = records.filter((record) => Date.parse(habitRecordTimestamp(record)) >= cutoff);
      const capped = Math.max(0, Math.floor(limit));
      return { records: eligible.slice(0, capped), hasMore: eligible.length > capped };
    },
    async probe() {
      try {
        const state = await fetchState();
        return {
          ok: true,
          message: `${state.habits?.length ?? 0} habits, ${state.checkins?.length ?? 0} check-ins readable`,
          latestAt: null,
        };
      } catch (error) {
        return { ok: false, message: error instanceof Error ? error.message : String(error), latestAt: null };
      }
    },
  };

  return createHabitConnector(reader);
}

function todayInZone(timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return parts;
}

