import type { BehaviourKey, Id } from "./types";

/**
 * The skill graph is intentionally broader than the transcript evaluator.
 * These links are the small, auditable bridge between a measured behaviour and
 * the skill or mission that should train it. A missing entry is allowed: the
 * evaluator can still report the behaviour without pretending it belongs to a
 * skill the scenario did not exercise.
 */
const SKILL_BEHAVIOURS: Partial<Record<Id, BehaviourKey>> = {
  "conv.open-questions": "questionQuality",
  "conv.follow-up": "followUpQuality",
  "conv.active-listening": "listening",
  "conv.balance": "reciprocity",
  "conv.transitions": "topicTransitions",
  "conf.opinions": "assertiveness",
  "conf.groups": "contribution",
  "grp.joining": "floorEntry",
  "grp.contributing": "contribution",
  "grp.no-interrupt": "interruptionHandling",
  "grp.recover-interrupt": "interruptionHandling",
  "grp.include": "inclusion",
  "emp.validation": "empathy",
  "emp.hold-off-solving": "empathy",
  "asrt.no": "assertiveness",
  "asrt.requests": "assertiveness",
  "asrt.boundaries": "assertiveness",
  "asrt.disagree": "assertiveness",
  "asrt.feedback": "assertiveness",
  "lead.clarity": "clarity",
  "lead.constructive-feedback": "assertiveness",
};

export function behaviourForSkill(skillId: Id): BehaviourKey | undefined {
  return SKILL_BEHAVIOURS[skillId];
}

export function skillForBehaviour(behaviour: BehaviourKey): Id | undefined {
  return Object.entries(SKILL_BEHAVIOURS).find(([, candidate]) => candidate === behaviour)?.[0];
}

export function behaviourLabel(behaviour: BehaviourKey): string {
  const labels: Record<BehaviourKey, string> = {
    relevance: "staying with what they said",
    listening: "showing you listened",
    followUpQuality: "follow-up questions",
    reciprocity: "give and take",
    clarity: "clarity",
    assertiveness: "stating your position",
    empathy: "acknowledging how they felt",
    topicTransitions: "signposted topic changes",
    questionQuality: "question quality",
    contribution: "contribution",
    interruptionHandling: "handling interruptions",
    inclusion: "including others",
    floorEntry: "entering the floor",
  };
  return labels[behaviour];
}

