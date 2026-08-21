"use client";

/**
 * Supabase client and the habit data hook — authenticated, offline-resilient.
 *
 * Security: every row is owned by auth.uid(). RLS is the enforcement boundary;
 * the anon key is public by design. Offline writes are queued, deduped, and
 * replayed on reconnect without duplicating check-ins.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { createClient, isSupabaseConfigured } from "./supabaseClient";
import { todayISO } from "./date";
import { bestStreak, completionRate, currentStreak, weekCounts } from "./streaks";
import { buildLocalMirror, clearLocalMirror, readPulseOptIn, writeLocalMirror, writePulseOptIn } from "./mirror";
import { dequeue, enqueue, readQueue, writeQueue } from "./storage";
import { buildExport, parseImportJSON } from "./exportImport";
import type { DbCheckin, DbHabit } from "./types";

export { isSupabaseConfigured };
export const HISTORY_WEEKS = 8;

// Keep a singleton browser client for the hook (created lazily to avoid SSR issues).
let _supabase: ReturnType<typeof createClient> | null = null;
function getSupabase() {
  if (!isSupabaseConfigured) return null;
  if (!_supabase) _supabase = createClient();
  return _supabase;
}
// Back-compat: some components import { supabase } directly.
export const supabase = isSupabaseConfigured ? getSupabase() : null;

export interface HabitView {
  id: string;
  name: string;
  colour: string;
  targetPerWeek: number;
  sortOrder: number;
  archived: boolean;
  createdAt: string;
  completedDays: Set<string>;
  doneToday: boolean;
  streak: number;
  best: number;
  weekCount: number;
  rate7: number;
  weeks: { weekStart: string; count: number }[];
}

export interface HabitInput {
  name: string;
  targetPerWeek: number;
  colour: string;
}

function isOnline(): boolean {
  try {
    // Node 21+ exposes a global navigator without .onLine; treat unknown as online.
    return typeof navigator !== "undefined" && typeof navigator.onLine === "boolean"
      ? navigator.onLine
      : true;
  } catch {
    return true;
  }
}

export function useHabitData() {
  const [habits, setHabits] = useState<DbHabit[] | null>(null);
  const [checkinRows, setCheckinRows] = useState<DbCheckin[]>([]);
  const [checkins, setCheckins] = useState<Map<string, Set<string>>>(new Map());
  const [error, setError] = useState<string | null>(null);
  const [pulseOptIn, setPulseOptInState] = useState<boolean>(() => readPulseOptIn());
  const [isOffline, setIsOffline] = useState<boolean>(() => !isOnline());
  const [queueSize, setQueueSize] = useState<number>(() => readQueue().length);

  const refresh = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;
    // Ensure we have a session; if not, clear data so no cross-user leak via cache.
    const { data: sessionData } = await client.auth.getSession();
    if (!sessionData.session) {
      setHabits([]);
      setCheckinRows([]);
      setCheckins(new Map());
      return;
    }
    const [habitResult, checkinResult] = await Promise.all([
      client.from("habits").select("*").order("sort_order", { ascending: true }),
      client.from("checkins").select("*").order("day", { ascending: true }),
    ]);
    if (habitResult.error) {
      setError(habitResult.error.message);
      return;
    }
    if (checkinResult.error) {
      setError(checkinResult.error.message);
      return;
    }
    const rows = checkinResult.data as DbCheckin[];
    const byHabit = new Map<string, Set<string>>();
    for (const row of rows) {
      if (!byHabit.has(row.habit_id)) byHabit.set(row.habit_id, new Set());
      if (row.completed) byHabit.get(row.habit_id)!.add(row.day);
    }
    setHabits(habitResult.data as DbHabit[]);
    setCheckinRows(rows);
    setCheckins(byHabit);
    setError(null);
  }, []);

  const flushQueue = useCallback(async () => {
    const client = getSupabase();
    if (!client) return;
    if (!isOnline()) return;
    const queue = readQueue();
    if (queue.length === 0) return;
    for (const item of [...queue]) {
      try {
        if (item.kind === "upsert_checkin") {
          const p = item.payload as { habit_id: string; day: string; completed: boolean };
          const { error } = await client
            .from("checkins")
            .upsert({ habit_id: p.habit_id, day: p.day, completed: p.completed }, { onConflict: "habit_id,day" });
          if (error) throw error;
        } else if (item.kind === "delete_checkin") {
          const p = item.payload as { habit_id: string; day: string };
          const { error } = await client.from("checkins").delete().eq("habit_id", p.habit_id).eq("day", p.day);
          if (error) throw error;
        } else if (item.kind === "insert_habit") {
          const p = item.payload as { name: string; target_per_week: number; colour: string; sort_order: number };
          const { error } = await client.from("habits").insert(p);
          if (error) throw error;
        } else if (item.kind === "update_habit") {
          const p = item.payload as { id: string; name: string; target_per_week: number; colour: string };
          const { error } = await client.from("habits").update({ name: p.name, target_per_week: p.target_per_week, colour: p.colour }).eq("id", p.id);
          if (error) throw error;
        } else if (item.kind === "delete_habit") {
          const p = item.payload as { id: string };
          const { error } = await client.from("habits").delete().eq("id", p.id);
          if (error) throw error;
        }
        dequeue(item.id);
      } catch {
        // Keep item for next retry, but bump attempts counter.
        const q = readQueue();
        const idx = q.findIndex((x) => x.id === item.id);
        if (idx !== -1) {
          q[idx].attempts += 1;
          writeQueue(q);
        }
        // Stop on first failure to preserve order.
        break;
      }
    }
    setQueueSize(readQueue().length);
    await refresh();
  }, [refresh]);

  // Track online/offline and auto-replay queue on reconnect.
  useEffect(() => {
    const onOnline = () => {
      setIsOffline(false);
      void flushQueue();
    };
    const onOffline = () => setIsOffline(true);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [flushQueue]);

  useEffect(() => {
    // Initial load: the one legitimate sync fetch in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (habits === null) return;
    if (readPulseOptIn()) writeLocalMirror(buildLocalMirror(habits, checkinRows, todayISO()));
    else clearLocalMirror();
  }, [habits, checkinRows, pulseOptIn]);

  const setPulseOptIn = useCallback((enabled: boolean) => {
    writePulseOptIn(enabled);
    setPulseOptInState(enabled);
  }, []);

  const toggle = useCallback(
    async (habitId: string, day: string, completed: boolean) => {
      // Optimistic UI
      setCheckins((current) => {
        const next = new Map(current);
        const days = new Set(next.get(habitId) ?? []);
        if (completed) days.add(day);
        else days.delete(day);
        next.set(habitId, days);
        return next;
      });
      setCheckinRows((current) => {
        const without = current.filter((row) => !(row.habit_id === habitId && row.day === day));
        if (!completed) return without;
        return [...without, { id: `${habitId}:${day}`, habit_id: habitId, day, completed: true, created_at: new Date().toISOString() }];
      });

      const client = getSupabase();
      if (!client) return;

      // If offline, queue and exit with clear signal.
      if (!isOnline()) {
        enqueue({ kind: completed ? "upsert_checkin" : "delete_checkin", payload: { habit_id: habitId, day, completed } });
        setQueueSize(readQueue().length);
        setError("Offline — change queued and will sync when reconnected.");
        return;
      }

      if (completed) {
        const { error } = await client.from("checkins").upsert({ habit_id: habitId, day, completed: true }, { onConflict: "habit_id,day" });
        if (error) {
          // Queue on failure for retry (e.g., transient network).
          enqueue({ kind: "upsert_checkin", payload: { habit_id: habitId, day, completed: true } });
          setQueueSize(readQueue().length);
          setError(error.message);
          await refresh();
        } else {
          setError(null);
        }
      } else {
        const { error } = await client.from("checkins").delete().eq("habit_id", habitId).eq("day", day);
        if (error) {
          enqueue({ kind: "delete_checkin", payload: { habit_id: habitId, day } });
          setQueueSize(readQueue().length);
          setError(error.message);
          await refresh();
        } else {
          setError(null);
        }
      }
    },
    [refresh],
  );

  const addHabit = useCallback(
    async (input: HabitInput) => {
      const client = getSupabase();
      if (!client) return;
      const trimmed = input.name.trim();
      if (!trimmed || trimmed.length > 80) {
        setError("Habit name must be 1-80 characters");
        return;
      }
      if (!isOnline()) {
        enqueue({ kind: "insert_habit", payload: { name: trimmed, target_per_week: input.targetPerWeek, colour: input.colour, sort_order: habits?.length ?? 0 } });
        setQueueSize(readQueue().length);
        setError("Offline — habit queued and will sync when reconnected.");
        // Optimistic placeholder
        const temp: DbHabit = {
          id: `temp-${Date.now()}`,
          user_id: "pending",
          name: trimmed,
          target_per_week: input.targetPerWeek,
          colour: input.colour,
          sort_order: habits?.length ?? 0,
          archived: false,
          created_at: new Date().toISOString(),
        };
        setHabits((c) => [...(c ?? []), temp]);
        return;
      }
      const { data, error } = await client
        .from("habits")
        .insert({ name: trimmed, target_per_week: input.targetPerWeek, colour: input.colour, sort_order: habits?.length ?? 0 })
        .select()
        .single();
      if (error) {
        // Queue for later retry if it looks like a network error
        if (error.message.toLowerCase().includes("network") || error.message.toLowerCase().includes("fetch")) {
          enqueue({ kind: "insert_habit", payload: { name: trimmed, target_per_week: input.targetPerWeek, colour: input.colour, sort_order: habits?.length ?? 0 } });
          setQueueSize(readQueue().length);
        }
        setError(error.message);
        return;
      }
      setHabits((current) => [...(current ?? []), data as DbHabit]);
      setError(null);
    },
    [habits?.length],
  );

  const updateHabit = useCallback(async (id: string, input: HabitInput) => {
    const client = getSupabase();
    if (!client) return;
    const trimmed = input.name.trim();
    if (!trimmed) {
      setError("Name required");
      return;
    }
    if (!isOnline()) {
      enqueue({ kind: "update_habit", payload: { id, name: trimmed, target_per_week: input.targetPerWeek, colour: input.colour } });
      setQueueSize(readQueue().length);
      setHabits((c) => (c ?? []).map((h) => (h.id === id ? { ...h, name: trimmed, target_per_week: input.targetPerWeek, colour: input.colour } : h)));
      setError("Offline — update queued.");
      return;
    }
    const { data, error } = await client.from("habits").update({ name: trimmed, target_per_week: input.targetPerWeek, colour: input.colour }).eq("id", id).select().single();
    if (error) {
      setError(error.message);
      return;
    }
    setHabits((current) => (current ?? []).map((habit) => (habit.id === id ? (data as DbHabit) : habit)));
    setError(null);
  }, []);

  const setArchived = useCallback(async (id: string, archived: boolean) => {
    const client = getSupabase();
    if (!client) return;
    // Archived is just an update; we treat offline same as updateHabit.
    if (!isOnline()) {
      enqueue({ kind: "update_habit", payload: { id, archived } as unknown as { id: string; name: string; target_per_week: number; colour: string } });
      setQueueSize(readQueue().length);
      setHabits((c) => (c ?? []).map((h) => (h.id === id ? { ...h, archived } : h)));
      setError("Offline — archive queued.");
      return;
    }
    const { error } = await client.from("habits").update({ archived }).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setHabits((current) => (current ?? []).map((habit) => (habit.id === id ? { ...habit, archived } : habit)));
    setError(null);
  }, []);

  const removeHabit = useCallback(async (id: string) => {
    const client = getSupabase();
    if (!client) return;
    // Optimistic
    const prevHabits = habits;
    const prevRows = checkinRows;
    const prevMap = checkins;
    setHabits((current) => (current ?? []).filter((habit) => habit.id !== id));
    setCheckins((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
    setCheckinRows((current) => current.filter((row) => row.habit_id !== id));

    if (!isOnline()) {
      enqueue({ kind: "delete_habit", payload: { id } });
      setQueueSize(readQueue().length);
      setError("Offline — delete queued.");
      return;
    }
    const { error } = await client.from("habits").delete().eq("id", id);
    if (error) {
      // Revert on failure
      if (prevHabits) setHabits(prevHabits);
      setCheckinRows(prevRows);
      setCheckins(prevMap);
      setError(error.message);
      return;
    }
    setError(null);
  }, [habits, checkinRows, checkins]);

  const exportData = useCallback(async () => {
    const client = getSupabase();
    const userId = (await client?.auth.getUser())?.data.user?.id ?? null;
    return buildExport({ habits: habits ?? [], checkins: checkinRows, pulseOptIn, userId });
  }, [habits, checkinRows, pulseOptIn]);

  const importData = useCallback(
    async (json: string) => {
      const parsed = parseImportJSON(json);
      if (!parsed.ok) {
        setError(parsed.error);
        return { ok: false as const, error: parsed.error };
      }
      const client = getSupabase();
      if (!client) return { ok: false as const, error: "Supabase not configured" };
      const { data: userData } = await client.auth.getUser();
      if (!userData.user) return { ok: false as const, error: "Not authenticated" };

      // Import is transactional in the UI: delete existing? No — we upsert.
      // For each habit, insert with new user_id (imported habits are reassigned to importer).
      for (const h of parsed.data.habits) {
        const { error } = await client.from("habits").upsert(
          {
            id: h.id,
            user_id: userData.user.id,
            name: h.name,
            target_per_week: h.target_per_week,
            colour: h.colour,
            sort_order: h.sort_order,
            archived: h.archived,
          },
          { onConflict: "id" },
        );
        if (error) {
          setError(error.message);
          return { ok: false as const, error: error.message };
        }
      }
      for (const c of parsed.data.checkins) {
        // Only import if habit now belongs to user (RLS will enforce anyway)
        const { error } = await client.from("checkins").upsert({ habit_id: c.habit_id, day: c.day, completed: c.completed }, { onConflict: "habit_id,day" });
        if (error) {
          setError(error.message);
          return { ok: false as const, error: error.message };
        }
      }
      writePulseOptIn(parsed.data.settings.pulseOptIn);
      setPulseOptInState(parsed.data.settings.pulseOptIn);
      await refresh();
      return { ok: true as const };
    },
    [refresh],
  );

  const views: HabitView[] = useMemo(() => {
    const today = todayISO();
    return (habits ?? []).map((habit) => {
      const completedDays = checkins.get(habit.id) ?? new Set<string>();
      const weekCount = weekCounts([...completedDays], today, 1)[0]?.count ?? 0;
      return {
        id: habit.id,
        name: habit.name,
        colour: habit.colour,
        targetPerWeek: habit.target_per_week,
        sortOrder: habit.sort_order,
        archived: habit.archived,
        createdAt: habit.created_at,
        completedDays,
        doneToday: completedDays.has(today),
        streak: currentStreak([...completedDays], today),
        best: bestStreak([...completedDays]),
        weekCount,
        rate7: completionRate([...completedDays], 7, today),
        weeks: weekCounts([...completedDays], today, HISTORY_WEEKS),
      };
    });
  }, [habits, checkins]);

  return {
    views,
    habits: habits ?? [],
    checkinRows,
    loading: habits === null,
    error,
    isOffline,
    queueSize,
    flushQueue,
    refresh,
    pulseOptIn,
    setPulseOptIn,
    toggle,
    addHabit,
    updateHabit,
    setArchived,
    removeHabit,
    exportData,
    importData,
  };
}
