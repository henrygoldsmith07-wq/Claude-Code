/**
 * Recommendation value.
 *
 * A recommendation is only valuable if it changes something. This tracker
 * records where each recommendation is in the funnel:
 *
 *   recommended -> accepted -> followed -> measured -> helped / didn't help
 *
 * Ranking optimises for what to say next; this measures whether any of it was
 * worth saying. The funnel is also the honest accounting that lets Pulse
 * report "80% of what I suggested did not help" rather than implying every
 * suggestion was a win.
 */

export type RecommendationStage = "recommended" | "accepted" | "followed" | "measured";

export interface RecommendationValue {
  recommendationId: string;
  stage: RecommendationStage;
  outcome: "helped" | "did-not-help" | null;
  recommendedAt: string;
  acceptedAt: string | null;
  followedAt: string | null;
  measuredAt: string | null;
}

export interface FunnelSummary {
  recommended: number;
  accepted: number;
  followed: number;
  measured: number;
  helped: number;
  didNotHelp: number;
  /** accepted / recommended */
  acceptanceRate: number;
  /** followed / accepted */
  followThroughRate: number;
  /** measured / recommended */
  measuredRate: number;
  /** helped / measured */
  helpRate: number;
  /** -1..1 — (helped - didNotHelp) / measured. Positive means recommendations net-help. */
  valueScore: number;
}

const STAGE_ORDER: Record<RecommendationStage, number> = {
  recommended: 0,
  accepted: 1,
  followed: 2,
  measured: 3,
};

export class RecommendationValueTracker {
  private values = new Map<string, RecommendationValue>();

  constructor(private readonly now: () => number = Date.now) {}

  recommended(id: string): RecommendationValue {
    return this.advance(id, "recommended", null);
  }

  accepted(id: string): RecommendationValue {
    return this.advance(id, "accepted", null);
  }

  followed(id: string): RecommendationValue {
    return this.advance(id, "followed", null);
  }

  recordOutcome(id: string, helped: boolean): RecommendationValue {
    return this.advance(id, "measured", helped ? "helped" : "did-not-help");
  }

  /** Stages are monotonic; a later call never regresses an earlier stage. */
  private advance(
    id: string,
    stage: RecommendationStage,
    outcome: "helped" | "did-not-help" | null,
  ): RecommendationValue {
    const at = new Date(this.now()).toISOString();
    let value = this.values.get(id);
    if (!value) {
      value = {
        recommendationId: id,
        stage: "recommended",
        outcome: null,
        recommendedAt: at,
        acceptedAt: null,
        followedAt: null,
        measuredAt: null,
      };
      this.values.set(id, value);
    }

    if (STAGE_ORDER[stage] <= STAGE_ORDER[value.stage]) {
      // Still accept an outcome recorded alongside a measured stage.
      if (stage === "measured" && outcome && value.outcome === null) value.outcome = outcome;
      return value;
    }

    value.stage = stage;
    if (stage === "accepted") value.acceptedAt = at;
    if (stage === "followed") value.followedAt = at;
    if (stage === "measured") {
      value.measuredAt = at;
      value.outcome = outcome ?? value.outcome;
    }
    return value;
  }

  valueOf(id: string): RecommendationValue | undefined {
    return this.values.get(id);
  }

  list(): RecommendationValue[] {
    return [...this.values.values()].sort((a, b) => a.recommendedAt.localeCompare(b.recommendedAt));
  }

  funnel(): FunnelSummary {
    const all = this.list();
    const recommended = all.length;
    const accepted = all.filter((value) => STAGE_ORDER[value.stage] >= STAGE_ORDER.accepted).length;
    const followed = all.filter((value) => STAGE_ORDER[value.stage] >= STAGE_ORDER.followed).length;
    const measured = all.filter((value) => value.stage === "measured").length;
    const helped = all.filter((value) => value.outcome === "helped").length;
    const didNotHelp = all.filter((value) => value.outcome === "did-not-help").length;
    const rate = (numerator: number, denominator: number): number => (denominator === 0 ? 0 : numerator / denominator);

    return {
      recommended,
      accepted,
      followed,
      measured,
      helped,
      didNotHelp,
      acceptanceRate: rate(accepted, recommended),
      followThroughRate: rate(followed, accepted),
      measuredRate: rate(measured, recommended),
      helpRate: rate(helped, measured),
      valueScore: measured === 0 ? 0 : (helped - didNotHelp) / measured,
    };
  }
}
