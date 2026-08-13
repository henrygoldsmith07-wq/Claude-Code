import { initialSkillState } from "./mastery";
import { SKILLS, getSkill } from "./skills";
import type {
  Assessment,
  AssessmentAnswer,
  Id,
  IsoInstant,
  SkillDomain,
  TrainingContext,
  TrainingIntensity,
  UserSkillState,
} from "./types";

// ---------------------------------------------------------------------------
// Onboarding.
//
// Seven questions, about ninety seconds. Every one of them has to earn its
// place by changing what the user is asked to do tomorrow — a long quiz that
// produces a generic plan is worse than no quiz.
//
// What this deliberately does not do: produce a verdict. There is no score, no
// percentile, and no "you are socially anxious". The output is a set of priors
// with wide uncertainty, stated as guesses, which the first week of actual
// evidence will overwrite.
// ---------------------------------------------------------------------------

export interface AssessmentOption {
  value: string;
  label: string;
  /** Skills this answer says something about, and in which direction. */
  signals?: { skillId?: Id; domain?: SkillDomain; masteryDelta?: number; confidenceDelta?: number }[];
}

export interface AssessmentQuestion {
  id: string;
  prompt: string;
  /** Why the user is being asked. Shown inline — no dark-pattern data collection. */
  purpose: string;
  kind: "single" | "multi" | "text";
  options?: AssessmentOption[];
  /** Multi-select questions cap selections so the profile stays discriminating. */
  maxSelections?: number;
  optional?: boolean;
}

const DOMAIN_CHOICES: { value: SkillDomain; label: string }[] = [
  { value: "conversation", label: "Keeping conversations going" },
  { value: "confidence", label: "Speaking up and taking initiative" },
  { value: "group", label: "Groups and meetings" },
  { value: "assertiveness", label: "Saying no and setting limits" },
  { value: "relationships", label: "Making and keeping friends" },
  { value: "empathy", label: "Listening and supporting people" },
  { value: "difficult", label: "Conflict and awkward moments" },
  { value: "digital", label: "Messaging and group chats" },
  { value: "leadership", label: "Leading and giving feedback" },
  { value: "non-verbal", label: "Voice, eye contact and presence" },
];

export const ONBOARDING_QUESTIONS: AssessmentQuestion[] = [
  {
    id: "goals",
    prompt: "What would you like to get better at?",
    purpose: "Sets what your training is built around. You can change this any time.",
    kind: "multi",
    maxSelections: 3,
    options: DOMAIN_CHOICES.map((choice) => ({
      value: choice.value,
      label: choice.label,
      signals: [{ domain: choice.value, masteryDelta: -0.06, confidenceDelta: -0.08 }],
    })),
  },
  {
    id: "hard-situations",
    prompt: "Which of these do you find hardest right now?",
    purpose: "Tells the app which situations to simulate first.",
    kind: "multi",
    maxSelections: 3,
    options: [
      { value: "starting", label: "Starting a conversation with someone new", signals: [{ skillId: "conv.start", masteryDelta: -0.12, confidenceDelta: -0.18 }] },
      { value: "keeping-going", label: "Keeping a conversation going", signals: [{ skillId: "conv.follow-up", masteryDelta: -0.14, confidenceDelta: -0.14 }] },
      { value: "groups", label: "Speaking up in a group", signals: [{ skillId: "conf.groups", masteryDelta: -0.14, confidenceDelta: -0.2 }] },
      { value: "joining", label: "Joining a conversation already happening", signals: [{ skillId: "grp.joining", masteryDelta: -0.14, confidenceDelta: -0.18 }] },
      { value: "saying-no", label: "Saying no or pushing back", signals: [{ skillId: "asrt.no", masteryDelta: -0.14, confidenceDelta: -0.18 }] },
      { value: "silence", label: "Silences and pauses", signals: [{ skillId: "conv.silence", masteryDelta: -0.12, confidenceDelta: -0.16 }] },
      { value: "conflict", label: "Disagreements", signals: [{ skillId: "asrt.disagree", masteryDelta: -0.12, confidenceDelta: -0.16 }] },
      { value: "inviting", label: "Inviting someone to do something", signals: [{ skillId: "rel.invitations", masteryDelta: -0.14, confidenceDelta: -0.16 }] },
      { value: "messaging", label: "Messages and replies", signals: [{ skillId: "dig.messaging", masteryDelta: -0.1, confidenceDelta: -0.12 }] },
    ],
  },
  {
    id: "comfortable",
    prompt: "Which of these already feel fine?",
    purpose: "Stops the app training things you can already do.",
    kind: "multi",
    maxSelections: 4,
    options: [
      { value: "listening", label: "Listening to people", signals: [{ skillId: "conv.active-listening", masteryDelta: 0.14, confidenceDelta: 0.14 }] },
      { value: "one-to-one", label: "One-to-one conversations", signals: [{ skillId: "conv.balance", masteryDelta: 0.1, confidenceDelta: 0.12 }] },
      { value: "opinions", label: "Saying what I think", signals: [{ skillId: "conf.opinions", masteryDelta: 0.14, confidenceDelta: 0.14 }] },
      { value: "support", label: "Supporting people who are struggling", signals: [{ skillId: "rel.support", masteryDelta: 0.12, confidenceDelta: 0.12 }] },
      { value: "humour", label: "Making people laugh", signals: [{ skillId: "conv.humour", masteryDelta: 0.14, confidenceDelta: 0.12 }] },
      { value: "written", label: "Writing messages and emails", signals: [{ skillId: "dig.messaging", masteryDelta: 0.14, confidenceDelta: 0.12 }] },
      { value: "leading", label: "Taking the lead when needed", signals: [{ skillId: "lead.initiative", masteryDelta: 0.12, confidenceDelta: 0.12 }] },
      { value: "known-people", label: "Talking to people I already know well", signals: [{ skillId: "conv.remembering", masteryDelta: 0.1, confidenceDelta: 0.1 }] },
    ],
  },
  {
    id: "group-vs-one",
    prompt: "Which is harder for you?",
    purpose: "Groups and one-to-one need different practice; this sets the balance.",
    kind: "single",
    options: [
      { value: "group-much-harder", label: "Groups are much harder", signals: [{ domain: "group", masteryDelta: -0.12, confidenceDelta: -0.18 }] },
      { value: "group-somewhat", label: "Groups are a bit harder", signals: [{ domain: "group", masteryDelta: -0.06, confidenceDelta: -0.1 }] },
      { value: "similar", label: "About the same" },
      { value: "one-harder", label: "One-to-one is harder", signals: [{ domain: "conversation", masteryDelta: -0.08, confidenceDelta: -0.12 }] },
    ],
  },
  {
    id: "intensity",
    prompt: "How much training do you want?",
    purpose: "Sets session length. Missing days never costs you anything.",
    kind: "single",
    options: [
      { value: "light", label: "Light — a few minutes, most days" },
      { value: "steady", label: "Steady — around 10 minutes a day" },
      { value: "focused", label: "Focused — 15–20 minutes a day" },
    ],
  },
  {
    id: "contexts",
    prompt: "Where do most of your conversations happen?",
    purpose: "Real-world challenges are written for the settings you are actually in.",
    kind: "multi",
    maxSelections: 4,
    options: [
      { value: "work", label: "Work" },
      { value: "study", label: "School or university" },
      { value: "social", label: "Friends and social events" },
      { value: "family", label: "Family" },
      { value: "strangers", label: "Shops, gyms, public places" },
      { value: "online", label: "Online and messaging" },
    ],
  },
  {
    id: "goal-statement",
    prompt: "In your own words, what would be different if this worked?",
    purpose: "Kept as you wrote it and shown back in your weekly review. Never rewritten.",
    kind: "text",
    optional: true,
  },
];

export interface AssessmentResult {
  states: UserSkillState[];
  intensity: TrainingIntensity;
  contexts: TrainingContext[];
  goalDomains: SkillDomain[];
  goalStatement: string;
  /** Skills the answers spoke to directly — the recommender starts here. */
  prioritySkillIds: Id[];
}

function answerValues(answers: AssessmentAnswer[], questionId: string): string[] {
  const answer = answers.find((a) => a.questionId === questionId);
  if (!answer) return [];
  if (Array.isArray(answer.value)) return answer.value;
  return [String(answer.value)];
}

/**
 * Turn answers into priors. Deltas are small on purpose: after three
 * simulations and one real attempt, evidence should dominate what someone
 * clicked during onboarding.
 */
export function buildInitialProfile(userId: Id, assessment: Assessment, now: IsoInstant): AssessmentResult {
  const states = new Map<Id, UserSkillState>(
    SKILLS.map((skill) => [skill.id, initialSkillState(userId, skill.id, now)]),
  );
  const priority = new Set<Id>();

  const apply = (
    signals: NonNullable<AssessmentOption["signals"]>,
  ) => {
    for (const signal of signals) {
      const targets = signal.skillId
        ? [signal.skillId]
        : signal.domain
          ? SKILLS.filter((skill) => skill.domain === signal.domain).map((skill) => skill.id)
          : [];
      for (const id of targets) {
        const state = states.get(id);
        if (!state) continue;
        // Domain-wide signals are diluted; a whole domain is a blunter claim
        // than a specific skill.
        const scale = signal.skillId ? 1 : 0.5;
        states.set(id, {
          ...state,
          mastery: clamp01(state.mastery + (signal.masteryDelta ?? 0) * scale),
          confidence: clamp01(state.confidence + (signal.confidenceDelta ?? 0) * scale),
          // Onboarding is weak evidence, so uncertainty stays wide.
          masteryUncertainty: 0.28,
          confidenceUncertainty: 0.26,
        });
        if (signal.skillId) priority.add(id);
      }
    }
  };

  for (const question of ONBOARDING_QUESTIONS) {
    const values = answerValues(assessment.answers, question.id);
    for (const value of values) {
      const option = question.options?.find((o) => o.value === value);
      if (option?.signals) apply(option.signals);
    }
  }

  const goalDomains = answerValues(assessment.answers, "goals").filter((value): value is SkillDomain =>
    SKILLS.some((skill) => skill.domain === value),
  );
  const contexts = answerValues(assessment.answers, "contexts") as TrainingContext[];
  const intensityValue = answerValues(assessment.answers, "intensity")[0];
  const intensity: TrainingIntensity =
    intensityValue === "light" || intensityValue === "focused" ? intensityValue : "steady";
  const goalStatement = answerValues(assessment.answers, "goal-statement")[0] ?? "";

  // Priority skills: those directly signalled, plus the most approachable
  // skills in each chosen domain, so a domain-only answer still yields a plan.
  for (const domain of goalDomains) {
    const easiest = SKILLS.filter((skill) => skill.domain === domain)
      .sort((a, b) => a.baseDifficulty - b.baseDifficulty)
      .slice(0, 2);
    for (const skill of easiest) priority.add(skill.id);
  }

  return {
    states: [...states.values()],
    intensity,
    contexts: contexts.length > 0 ? contexts : ["social", "work"],
    goalDomains,
    goalStatement,
    prioritySkillIds: [...priority].filter((id) => getSkill(id) !== undefined),
  };
}

export function sessionMinutesFor(intensity: TrainingIntensity): number {
  return intensity === "light" ? 5 : intensity === "focused" ? 18 : 10;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

/**
 * What the app is prepared to say about the profile it just built. Phrased as
 * a plan, not a diagnosis — this string is the first thing a new user reads and
 * it sets the whole tone of the product.
 */
export function describeProfile(result: AssessmentResult): string {
  const named = result.prioritySkillIds
    .map((id) => getSkill(id)?.name)
    .filter((name): name is string => Boolean(name))
    .slice(0, 3);
  if (named.length === 0) return "Your first week will sample a few skills to see where practice helps most.";
  return `Starting with ${named.join(", ")}. These are guesses from your answers — the first week of practice will correct them.`;
}
