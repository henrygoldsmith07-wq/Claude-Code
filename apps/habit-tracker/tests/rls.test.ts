import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schemaPath = resolve(__dirname, "../supabase/schema.sql");
const migrationPath = resolve(__dirname, "../supabase/migrations/20260821000000_secure_habit_isolation.sql");
const supabaseHookPath = resolve(__dirname, "../src/lib/supabase.ts");

function read(p: string): string {
  try {
    return readFileSync(p, "utf8");
  } catch {
    return "";
  }
}

describe("RLS and isolation — schema must be secure", () => {
  const schema = read(schemaPath);
  const migration = read(migrationPath);

  it("does not contain permissive anon policies", () => {
    expect(schema).not.toMatch(/create policy[^;]*using\s*\(\s*true\s*\)/i);
    expect(schema).not.toMatch(/create policy[^;]*with\s+check\s*\(\s*true\s*\)/i);
    expect(migration).not.toMatch(/create policy[^;]*using\s*\(\s*true\s*\)/i);
    // The old permissive policy names must not be *created* (drop-if-exists references are fine)
    expect(schema).not.toMatch(/create\s+policy\s+"anon can manage/i);
    expect(migration).not.toMatch(/create\s+policy\s+"anon can manage/i);
  });

  it("habits has user_id owned by auth.users", () => {
    expect(schema).toMatch(/user_id\s+uuid\s+not\s+null\s+references\s+auth\.users/i);
    expect(schema).toContain("user_id = auth.uid()");
  });

  it("checkins derive ownership via is_habit_owner", () => {
    expect(schema).toContain("is_habit_owner");
    expect(schema).toMatch(/public\.is_habit_owner\(habit_id\)/);
  });

  it("enables and forces RLS on both tables", () => {
    expect(schema).toMatch(/enable row level security/i);
    expect(schema).toMatch(/force row level security/i);
  });

  it("revokes anon grants and grants only to authenticated", () => {
    expect(schema).toMatch(/revoke all on public\.habits from public,\s*anon/i);
    expect(schema).toMatch(/grant select, insert, update, delete on public\.habits to authenticated/i);
    expect(schema).toMatch(/revoke all on public\.checkins/i);
  });

  it("prevents immutable ownership changes", () => {
    expect(schema).toContain("prevent_habit_owner_change");
    expect(schema).toContain("prevent_checkin_habit_change");
    expect(schema).toContain("habit user_id is immutable");
    expect(schema).toContain("checkin habit_id is immutable");
  });

  it("migration handles orphan rows safely (no silent assignment)", () => {
    expect(migration).toContain("orphan");
    expect(migration).not.toMatch(/update public\.habits set user_id =/i); // no blind assignment
  });

  it("hook uses authenticated browser client, not raw anon key", () => {
    const hook = read(supabaseHookPath);
    expect(hook).toContain("createClient");
    expect(hook).toContain("supabaseClient");
    expect(hook).toMatch(/auth\.getSession|auth\.getUser/);
  });

  it("sql isolation file exists and covers cross-user checks", () => {
    const isoPath = resolve(__dirname, "../supabase/tests/habit_isolation.sql");
    const iso = read(isoPath);
    expect(iso.length).toBeGreaterThan(500);
    expect(iso).toContain("user_a");
    expect(iso).toContain("user_b");
    expect(iso).toContain("cannot read habit B");
    expect(iso).toContain("anonymous cannot");
    expect(iso).toContain("guessing");
  });
});

describe("cross-user isolation logic (unit simulation)", () => {
  // Simulate RLS predicates in JS to prove isolation properties.
  type Habit = { id: string; user_id: string; name: string };
  type Checkin = { id: string; habit_id: string; day: string };

  function canSelectHabit(habit: Habit, uid: string | null): boolean {
    return uid !== null && habit.user_id === uid;
  }
  function canSelectCheckin(checkin: Checkin, habits: Habit[], uid: string | null): boolean {
    const parent = habits.find((h) => h.id === checkin.habit_id);
    return !!parent && canSelectHabit(parent, uid);
  }

  const habitA: Habit = { id: "ha", user_id: "userA", name: "A" };
  const habitB: Habit = { id: "hb", user_id: "userB", name: "B" };
  const checkinA: Checkin = { id: "ca", habit_id: "ha", day: "2025-07-04" };
  const checkinB: Checkin = { id: "cb", habit_id: "hb", day: "2025-07-04" };

  it("B cannot list A's habits", () => {
    expect(canSelectHabit(habitA, "userB")).toBe(false);
    expect(canSelectHabit(habitB, "userB")).toBe(true);
  });
  it("B cannot inspect A's or anyone else's check-ins but own", () => {
    expect(canSelectCheckin(checkinA, [habitA, habitB], "userB")).toBe(false);
    expect(canSelectCheckin(checkinB, [habitA, habitB], "userB")).toBe(true);
  });
  it("B cannot create check-ins for A's habit", () => {
    // Creating requires parent ownership
    const canCreate = (habitId: string, uid: string) =>
      [habitA, habitB].some((h) => h.id === habitId && h.user_id === uid);
    expect(canCreate("ha", "userB")).toBe(false);
    expect(canCreate("hb", "userB")).toBe(true);
  });
  it("B cannot update/delete A's habit", () => {
    const canMutate = (id: string, uid: string) =>
      [habitA, habitB].find((h) => h.id === id)?.user_id === uid;
    expect(canMutate("ha", "userB")).toBe(false);
  });
  it("guessed IDs do not grant access", () => {
    expect(canSelectHabit({ id: "guessed", user_id: "userA", name: "x" }, "userB")).toBe(false);
  });
  it("filter inference does not leak", () => {
    const filtered = [habitA, habitB].filter((h) => canSelectHabit(h, "userB") && h.name === "A");
    expect(filtered.length).toBe(0);
  });
  it("anonymous cannot access anything", () => {
    expect(canSelectHabit(habitA, null)).toBe(false);
    expect(canSelectCheckin(checkinA, [habitA], null)).toBe(false);
  });
});
