import { describe, expect, it } from "vitest";
import { buildExport, parseImportJSON, validateImport } from "../src/lib/exportImport";
import { enqueue, readQueue, safeGetJSON } from "../src/lib/storage";
import { buildLocalMirror, clearLocalMirror, readPulseOptIn, writeLocalMirror, writePulseOptIn, HABIT_STORAGE_KEY, PULSE_OPT_IN_KEY } from "../src/lib/mirror";
import type { DbHabit, DbCheckin } from "../src/lib/types";

function fakeStorage(): Storage & { store: Map<string, string> } {
  const store = new Map<string, string>();
  return {
    store,
    length: 0,
    clear() { store.clear(); },
    getItem(k: string) { return store.get(k) ?? null; },
    setItem(k: string, v: string) { store.set(k, v); },
    removeItem(k: string) { store.delete(k); },
    key(i: number) { return [...store.keys()][i] ?? null; },
  } as unknown as Storage & { store: Map<string, string> };
}

describe("corrupted storage handling", () => {
  it("clears corrupted queue and returns empty", () => {
    const s = fakeStorage();
    s.setItem("habit-tracker-offline-queue-v1", "not-json{{{");
    expect(readQueue(s as unknown as Storage)).toEqual([]);
    expect(s.store.has("habit-tracker-offline-queue-v1")).toBe(false);
  });

  it("clears corrupted JSON for safeGetJSON", () => {
    const s = fakeStorage();
    s.setItem("test-key", "{bad");
    expect(safeGetJSON("test-key", { ok: true }, s as unknown as Storage)).toEqual({ ok: true });
    expect(s.store.has("test-key")).toBe(false);
  });

  it("mirror helpers survive blocked storage", () => {
    const blocked: Storage = {
      getItem() { throw new Error("blocked"); },
      setItem() { throw new Error("blocked"); },
      removeItem() { throw new Error("blocked"); },
    } as unknown as Storage;
    expect(readPulseOptIn(blocked)).toBe(false);
    expect(() => writePulseOptIn(true, blocked)).not.toThrow();
    expect(() => writeLocalMirror(buildLocalMirror([], [], "2025-07-04"), blocked)).not.toThrow();
    expect(() => clearLocalMirror(blocked)).not.toThrow();
  });

  it("queue dedup keeps only latest per habit:day", () => {
    const s = fakeStorage();
    enqueue({ kind: "upsert_checkin", payload: { habit_id: "h1", day: "2025-07-04", completed: true } }, s as unknown as Storage);
    enqueue({ kind: "upsert_checkin", payload: { habit_id: "h1", day: "2025-07-04", completed: false } }, s as unknown as Storage);
    const q = readQueue(s as unknown as Storage);
    // Should be only 1 entry for that key (latest), not 2.
    expect(q.length).toBe(1);
    expect((q[0].payload as { completed: boolean }).completed).toBe(false);
  });

  it("different days not deduped", () => {
    const s = fakeStorage();
    enqueue({ kind: "upsert_checkin", payload: { habit_id: "h1", day: "2025-07-04" } }, s as unknown as Storage);
    enqueue({ kind: "upsert_checkin", payload: { habit_id: "h1", day: "2025-07-05" } }, s as unknown as Storage);
    expect(readQueue(s as unknown as Storage).length).toBe(2);
  });
});

describe("export/import validation", () => {
  const habit: DbHabit = { id: "h1", user_id: "u1", name: "Run", target_per_week: 3, colour: "#6366f1", sort_order: 0, archived: false, created_at: "2025-07-01T00:00:00.000Z" };
  const checkin: DbCheckin = { id: "c1", habit_id: "h1", day: "2025-07-04", completed: true, created_at: "2025-07-04T10:00:00.000Z" };

  it("builds export with version, habits, checkins, settings", () => {
    const exp = buildExport({ habits: [habit], checkins: [checkin], pulseOptIn: true, userId: "u1" });
    expect(exp.version).toBe(1);
    expect(exp.habits).toHaveLength(1);
    expect(exp.checkins).toHaveLength(1);
    expect(exp.settings.pulseOptIn).toBe(true);
    expect(exp.userId).toBe("u1");
    expect(() => JSON.parse(JSON.stringify(exp))).not.toThrow();
  });

  it("round-trips through JSON", () => {
    const exp = buildExport({ habits: [habit], checkins: [checkin], pulseOptIn: false });
    const json = JSON.stringify(exp);
    const parsed = parseImportJSON(json);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data.habits[0].name).toBe("Run");
  });

  it("rejects unsupported version", () => {
    expect(validateImport({ version: 2, exportedAt: new Date().toISOString(), habits: [], checkins: [], settings: { pulseOptIn: false } }).ok).toBe(false);
  });

  it("rejects duplicate checkins", () => {
    const exp = buildExport({ habits: [habit], checkins: [checkin, { ...checkin, id: "c2" }], pulseOptIn: false });
    expect(validateImport(exp).ok).toBe(false);
  });

  it("rejects invalid habit name", () => {
    const badHabit = { ...habit, name: "" };
    const exp = { version: 1, exportedAt: new Date().toISOString(), habits: [badHabit], checkins: [], settings: { pulseOptIn: false } };
    expect(validateImport(exp).ok).toBe(false);
  });

  it("rejects orphan checkin (habit_id not in habits)", () => {
    const orphan: DbCheckin = { id: "c2", habit_id: "missing", day: "2025-07-05", completed: true, created_at: new Date().toISOString() };
    const exp = { version: 1, exportedAt: new Date().toISOString(), habits: [habit], checkins: [orphan], settings: { pulseOptIn: false } };
    expect(validateImport(exp).ok).toBe(false);
  });

  it("rejects malformed JSON", () => {
    expect(parseImportJSON("not json").ok).toBe(false);
  });

  it("clears pulse mirror on opt-out", () => {
    const s = fakeStorage();
    writeLocalMirror(buildLocalMirror([habit], [checkin], "2025-07-04"), s as unknown as Storage);
    expect(s.store.has(HABIT_STORAGE_KEY)).toBe(true);
    writePulseOptIn(false, s as unknown as Storage);
    expect(s.store.get(PULSE_OPT_IN_KEY)).toBe("0");
    expect(s.store.has(HABIT_STORAGE_KEY)).toBe(false);
  });
});
