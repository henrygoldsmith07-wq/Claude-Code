import type { CommandWord, Id, IsoInstant, MisconceptionTag, Mistake } from "./types";

/**
 * A durable, learner-specific view of repeated errors. The raw Mistake rows
 * remain the audit trail; this aggregation is the decision layer used by the
 * planner, recommender and Progress screen.
 */
export interface ErrorModelEntry {
  key: string;
  label: string;
  category: Mistake["category"];
  misconception?: MisconceptionTag;
  command?: CommandWord;
  frequency: number;
  openCount: number;
  resolvedCount: number;
  marksLost: number;
  /** Marks lost weighted toward recent evidence, useful for prioritisation. */
  severity: number;
  subjectIds: Id[];
  topicIds: Id[];
  firstSeenAt: IsoInstant;
  lastSeenAt: IsoInstant;
  retests: number;
  successfulRetests: number;
  /** Null means there has not been a targeted retest yet. */
  improvementRate: number | null;
  /** 0–1 recency weight; this is not a probability of being wrong. */
  recencyWeight: number;
  status: "emerging" | "recurring" | "improving" | "resolved";
  examples: string[];
}

interface ErrorAccumulator {
  key: string;
  category: Mistake["category"];
  misconception?: MisconceptionTag;
  command?: CommandWord;
  mistakes: Mistake[];
}

function meaningfulMisconception(value: Mistake["misconception"]): value is MisconceptionTag {
  return Boolean(value && value !== "other");
}

function meaningfulCommand(value: Mistake["command"]): value is CommandWord {
  return Boolean(value && value !== "other");
}

function keyFor(mistake: Mistake): Pick<ErrorAccumulator, "key" | "category" | "misconception" | "command"> {
  if (meaningfulMisconception(mistake.misconception)) {
    return {
      key: `misconception:${mistake.misconception}`,
      category: mistake.category,
      misconception: mistake.misconception,
    };
  }
  if (meaningfulCommand(mistake.command)) {
    return {
      key: `command:${mistake.command}`,
      category: mistake.category,
      command: mistake.command,
    };
  }
  return { key: `category:${mistake.category}`, category: mistake.category };
}

function humanise(value: string): string {
  return value.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function labelFor(group: Pick<ErrorAccumulator, "category" | "misconception" | "command">): string {
  if (group.misconception) return `${humanise(group.misconception)} errors`;
  if (group.command) return `"${group.command}" command-word errors`;
  return `${humanise(group.category)} errors`;
}

function daysBetween(older: IsoInstant, newer: IsoInstant): number {
  const a = Date.parse(older);
  const b = Date.parse(newer);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

function unique(values: string[], limit = 4): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].slice(0, limit);
}

/** Aggregate raw mistakes without discarding examples or the original rows. */
export function buildErrorModel(input: { mistakes: Mistake[]; now?: Date }): ErrorModelEntry[] {
  const now = (input.now ?? new Date()).toISOString();
  const groups = new Map<string, ErrorAccumulator>();

  for (const mistake of input.mistakes) {
    if (!mistake.id || mistake.marksLost <= 0) continue;
    const key = keyFor(mistake);
    const group = groups.get(key.key) ?? { ...key, mistakes: [] };
    group.mistakes.push(mistake);
    groups.set(key.key, group);
  }

  return [...groups.values()]
    .map((group): ErrorModelEntry => {
      const rows = [...group.mistakes].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
      const first = rows[0]!;
      const last = rows[rows.length - 1]!;
      const retests = rows.reduce((sum, row) => sum + (row.retestCount ?? 0), 0);
      const successfulRetests = rows.filter((row) => row.resolved && (row.retestCount ?? 0) > 0).length;
      const improvementRate = retests ? Math.round((successfulRetests / retests) * 100) / 100 : null;
      const recencyWeight = Math.round(Math.exp(-daysBetween(last.createdAt, now) / 45) * 100) / 100;
      const marksLost = Math.round(rows.reduce((sum, row) => sum + Math.max(0, row.marksLost), 0) * 10) / 10;
      const openCount = rows.filter((row) => !row.resolved).length;
      const resolvedCount = rows.length - openCount;
      const status: ErrorModelEntry["status"] = improvementRate != null && improvementRate >= 0.6
        ? "improving"
        : openCount === 0
          ? "resolved"
          : rows.length >= 2
            ? "recurring"
            : "emerging";

      return {
        key: group.key,
        label: labelFor(group),
        category: group.category,
        misconception: group.misconception,
        command: group.command,
        frequency: rows.length,
        openCount,
        resolvedCount,
        marksLost,
        severity: Math.round(marksLost * (0.5 + recencyWeight * 0.5) * 10) / 10,
        subjectIds: [...new Set(rows.map((row) => row.subjectId))],
        topicIds: [...new Set(rows.map((row) => row.topicId))],
        firstSeenAt: first.createdAt,
        lastSeenAt: last.createdAt,
        retests,
        successfulRetests,
        improvementRate,
        recencyWeight,
        status,
        examples: unique(rows.flatMap((row) => [row.description, row.point ?? ""])),
      };
    })
    .sort((a, b) => b.severity - a.severity || b.frequency - a.frequency || b.lastSeenAt.localeCompare(a.lastSeenAt));
}

export function actionableErrors(model: ErrorModelEntry[], subjectId?: Id, limit = 5): ErrorModelEntry[] {
  return model
    .filter((entry) => (!subjectId || entry.subjectIds.includes(subjectId)) && entry.openCount > 0)
    .slice(0, limit);
}

