/**
 * Insight feedback.
 *
 * The loop that stops Pulse from being annoying: what the user marks as
 * useless is downweighted, what they act on is upweighted, and what they mute
 * disappears. Feedback affects *ranking only* — it never changes a statistic
 * or hides a caveat, because a finding the user dislikes is not thereby wrong.
 */

import { clamp } from "../statistics/descriptive.js";

export type FeedbackVerdict = "useful" | "not-useful" | "already-knew" | "wrong" | "acted-on";

export interface FeedbackEntry {
  /** Finding or recommendation id. */
  targetId: string;
  verdict: FeedbackVerdict;
  at: string;
  /** Metrics the target was about, so feedback can generalise to a topic. */
  metricIds: string[];
  note?: string;
}

const VERDICT_WEIGHT: Record<FeedbackVerdict, number> = {
  "acted-on": 0.35,
  useful: 0.2,
  "already-knew": -0.15,
  "not-useful": -0.3,
  wrong: -0.4,
};

export class FeedbackStore {
  private entries: FeedbackEntry[] = [];
  private dismissed = new Set<string>();
  private mutedTopics = new Set<string>();

  constructor(private readonly now: () => number = Date.now) {}

  record(targetId: string, verdict: FeedbackVerdict, metricIds: readonly string[] = [], note?: string): FeedbackEntry {
    const entry: FeedbackEntry = {
      targetId,
      verdict,
      at: new Date(this.now()).toISOString(),
      metricIds: [...metricIds],
      ...(note !== undefined ? { note } : {}),
    };
    this.entries.push(entry);
    // "Wrong" and "not useful" retire that specific insight; the topic stays open.
    if (verdict === "not-useful" || verdict === "wrong") this.dismissed.add(targetId);
    return entry;
  }

  dismiss(targetId: string): void {
    this.dismissed.add(targetId);
  }

  muteTopic(metricId: string): void {
    this.mutedTopics.add(metricId);
  }

  unmuteTopic(metricId: string): void {
    this.mutedTopics.delete(metricId);
  }

  isDismissed(targetId: string): boolean {
    return this.dismissed.has(targetId);
  }

  isTopicMuted(metricId: string): boolean {
    return this.mutedTopics.has(metricId);
  }

  /**
   * Multiplier applied to relevance, from accumulated feedback on the same
   * metrics. Bounded to [0.2, 1.5] so no amount of clicking can bury a
   * genuinely important finding or promote a trivial one indefinitely.
   */
  relevanceMultiplier(metricIds: readonly string[]): number {
    if (metricIds.length === 0) return 1;
    const relevant = this.entries.filter((entry) => entry.metricIds.some((id) => metricIds.includes(id)));
    if (relevant.length === 0) return 1;
    const adjustment = relevant.reduce((acc, entry) => acc + VERDICT_WEIGHT[entry.verdict], 0);
    return clamp(1 + adjustment / Math.sqrt(relevant.length), 0.2, 1.5);
  }

  list(): FeedbackEntry[] {
    return [...this.entries];
  }

  /**
   * Summary for the improvement loop: which metrics keep producing insights
   * the user rejects. A metric that is consistently "already knew" is a
   * candidate for demotion in the catalogue.
   */
  problemTopics(): { metricId: string; negative: number; total: number }[] {
    const counts = new Map<string, { negative: number; total: number }>();
    for (const entry of this.entries) {
      for (const metricId of entry.metricIds) {
        const bucket = counts.get(metricId) ?? { negative: 0, total: 0 };
        bucket.total += 1;
        if (VERDICT_WEIGHT[entry.verdict] < 0) bucket.negative += 1;
        counts.set(metricId, bucket);
      }
    }
    return [...counts.entries()]
      .map(([metricId, bucket]) => ({ metricId, ...bucket }))
      .filter((row) => row.total >= 3 && row.negative / row.total >= 0.6)
      .sort((a, b) => b.negative - a.negative);
  }

  toSnapshot(): { entries: FeedbackEntry[]; dismissed: string[]; mutedTopics: string[] } {
    return { entries: this.list(), dismissed: [...this.dismissed], mutedTopics: [...this.mutedTopics] };
  }

  static fromSnapshot(
    snapshot: { entries: FeedbackEntry[]; dismissed: string[]; mutedTopics: string[] },
    now: () => number = Date.now,
  ): FeedbackStore {
    const store = new FeedbackStore(now);
    store.entries = [...snapshot.entries];
    store.dismissed = new Set(snapshot.dismissed);
    store.mutedTopics = new Set(snapshot.mutedTopics);
    return store;
  }
}
