"use client";

/**
 * Supabase client and the habit data hook.
 *
 * The client is env-gated: without NEXT_PUBLIC_SUPABASE_URL and
 * NEXT_PUBLIC_SUPABASE_ANON_KEY the app still runs and shows setup
 * instructions instead of data. The hook owns the only state the UI needs —
 * habits plus their check-ins — and derives everything else (streaks, weekly
 * progress, history) with the pure functions in `streaks.ts`.
 */

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { todayISO } from "./date";
import { bestStreak, completionRate, currentStreak, weekCounts } from "./streaks";
import { buildLocalMirror, writeLocalMirror } from "./mirror";
import type { DbCheckin, DbHabit } from "./types";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase: SupabaseClient | null =
  supabaseUrl && supabaseAnonKey ? createClient(supabaseUrl, supabaseAnonKey) : null;

/** How far back the history view looks, in weeks. */
export const HISTORY_WEEKS = 8;

/** A habit with its check-in log and everything derived from it. */
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
  /** Completed days in the current Sunday-start week. */
  weekCount: number;
  /** Completion share of the last 7 days, 0..1. */
  rate7: number;
  /** Completed days per week, oldest first, for the history table. */
  weeks: { weekStart: string; count: number }[];
}

export interface HabitInput {
  name: string;
  targetPerWeek: number;
  colour: string;
}

export function useHabitData() {
  const [habits, setHabits] = useState<DbHabit[] | null>(null);
  // The raw check-in rows, kept alongside the derived day-map so the Pulse
  // mirror can carry timestamps instead of flattening them away.
  const [checkinRows, setCheckinRows] = useState<DbCheckin[]>([]);
  const [checkins, setCheckins] = useState<Map<string, Set<string>>>(new Map());
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!supabase) return;
    const [habitResult, checkinResult] = await Promise.all([
      supabase.from("habits").select("*").order("sort_order", { ascending: true }),
      // The whole log, not a recent window: the history table slices its own
      // eight weeks in the memo below, but the Pulse mirror and the all-time
      // best streak need every day that was ever checked off.
      supabase.from("checkins").select("*").order("day", { ascending: true }),
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

  useEffect(() => {
    // The initial load is the one legitimate sync setState in an effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  // Mirror every loaded state into localStorage for Pulse's same-origin
  // connector, so Pulse can connect without this project's credentials.
  useEffect(() => {
    if (habits === null) return;
    writeLocalMirror(buildLocalMirror(habits, checkinRows, todayISO()));
  }, [habits, checkinRows]);

  /** Optimistically flips today's check-in, then persists; reverts on failure. */
  const toggle = useCallback(
    async (habitId: string, day: string, completed: boolean) => {
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
        return [
          ...without,
          {
            id: `${habitId}:${day}`,
            habit_id: habitId,
            day,
            completed: true,
            created_at: new Date().toISOString(),
          },
        ];
      });
      if (!supabase) return;
      if (completed) {
        const { error } = await supabase.from("checkins").upsert(
          { habit_id: habitId, day, completed: true },
          { onConflict: "habit_id,day" },
        );
        if (error) {
          setError(error.message);
          await refresh();
        }
      } else {
        const { error } = await supabase
          .from("checkins")
          .delete()
          .eq("habit_id", habitId)
          .eq("day", day);
        if (error) {
          setError(error.message);
          await refresh();
        }
      }
    },
    [refresh],
  );

  const addHabit = useCallback(
    async (input: HabitInput) => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from("habits")
        .insert({
          name: input.name.trim(),
          target_per_week: input.targetPerWeek,
          colour: input.colour,
          sort_order: habits?.length ?? 0,
        })
        .select()
        .single();
      if (error) {
        setError(error.message);
        return;
      }
      setHabits((current) => [...(current ?? []), data as DbHabit]);
    },
    [habits?.length],
  );

  const updateHabit = useCallback(
    async (id: string, input: HabitInput) => {
      if (!supabase) return;
      const { data, error } = await supabase
        .from("habits")
        .update({ name: input.name.trim(), target_per_week: input.targetPerWeek, colour: input.colour })
        .eq("id", id)
        .select()
        .single();
      if (error) {
        setError(error.message);
        return;
      }
      setHabits((current) =>
        (current ?? []).map((habit) => (habit.id === id ? (data as DbHabit) : habit)),
      );
    },
    [],
  );

  const setArchived = useCallback(async (id: string, archived: boolean) => {
    if (!supabase) return;
    const { error } = await supabase.from("habits").update({ archived }).eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setHabits((current) =>
      (current ?? []).map((habit) => (habit.id === id ? { ...habit, archived } : habit)),
    );
  }, []);

  const removeHabit = useCallback(async (id: string) => {
    if (!supabase) return;
    const { error } = await supabase.from("habits").delete().eq("id", id);
    if (error) {
      setError(error.message);
      return;
    }
    setHabits((current) => (current ?? []).filter((habit) => habit.id !== id));
    setCheckins((current) => {
      const next = new Map(current);
      next.delete(id);
      return next;
    });
    setCheckinRows((current) => current.filter((row) => row.habit_id !== id));
  }, []);

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
    loading: habits === null,
    error,
    toggle,
    addHabit,
    updateHabit,
    setArchived,
    removeHabit,
  };
}
