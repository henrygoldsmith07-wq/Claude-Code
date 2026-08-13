import { lessonFor } from "./lessons";
import { stateFor } from "./mastery";
import { checkPracticeRequest } from "./safety";
import { scenariosForSkill } from "./scenarios";
import { getSkill, prerequisitesOf } from "./skills";
import type { Id, SimulationScenario, UserSkillState } from "./types";

// ---------------------------------------------------------------------------
// The coach.
//
// The question users actually ask is "what should I say?". Answering it
// directly is the single most damaging thing this product could do: it
// produces a line for one situation, teaches nothing, and creates a habit of
// opening the app instead of speaking.
//
// So every question is routed: identify the underlying skill, name the
// principle, then offer practice. The user still gets a concrete example —
// withholding one is just unhelpful — but it is framed as an illustration of
// the principle, and the offer of a simulation follows immediately.
//
// This module resolves the routing deterministically. The model (when present)
// only rewrites the explanation to fit the user's own words and history.
// ---------------------------------------------------------------------------

export interface CoachRouting {
  /** The user's problem restated as a trainable skill. */
  skillId: Id;
  /** Why this skill was chosen — shown so the routing is not a black box. */
  diagnosis: string;
  technique: string;
  principle: string;
  example: string;
  /** A scenario the user can start immediately, when one exists for the skill. */
  practiceScenario: SimulationScenario | null;
  /** Prerequisite worth mentioning when it is clearly missing. */
  foundation?: { skillId: Id; rationale: string };
}

interface Rule {
  patterns: RegExp[];
  skillId: Id;
  diagnosis: string;
  technique: string;
}

const RULES: Rule[] = [
  {
    patterns: [/conversations? (?:keep )?(?:dying|dies|dry up|drying|stall)/i, /run out of things to say/i, /don'?t know what to say next/i, /awkward silence/i],
    skillId: "conv.follow-up",
    diagnosis: "Conversations that stall are usually a follow-up problem rather than a material problem — the next thing to say was in what they just said.",
    technique: "Listen → pick a detail → ask about that detail → relate if it fits → hand attention back.",
  },
  {
    patterns: [/don'?t know how to start/i, /can'?t start (?:a )?conversation/i, /approach(?:ing)? (?:people|someone)/i, /break the ice/i],
    skillId: "conv.start",
    diagnosis: "Starting is usually blocked by the bar being set too high — you are searching for something interesting rather than something easy to answer.",
    technique: "Use the shared situation, keep it under ten words, and accept a boring opener.",
  },
  {
    patterns: [/interview/i, /asking too many questions/i, /interrogat/i],
    skillId: "conv.balance",
    diagnosis: "Question after question with nothing offered turns a conversation into an interview. The fix is disclosure, not fewer questions.",
    technique: "After two questions, offer something of your own before the third.",
  },
  {
    patterns: [/talk too much/i, /dominat/i, /ramble|rambling/i],
    skillId: "conv.balance",
    diagnosis: "Over-talking is usually a landing problem: turns have no ending, so they keep going.",
    technique: "End longer turns with a question. It gives the turn a landing point.",
  },
  {
    patterns: [/can'?t say no/i, /always say yes/i, /people take advantage/i, /too agreeable/i],
    skillId: "asrt.no",
    diagnosis: "Saying yes when you mean no is usually about the length of the run-up: the longer the preamble, the more negotiable the answer sounds.",
    technique: "Decline in the first sentence, give at most one reason, stop.",
  },
  {
    patterns: [/speak up in meetings/i, /never say anything in (?:groups|meetings)/i, /quiet in groups/i, /don'?t contribute/i],
    skillId: "conf.groups",
    diagnosis: "The cost of the first contribution rises the longer you wait, so the problem compounds within a single meeting.",
    technique: "Contribute in the first ten minutes. Agreeing with someone and adding one sentence counts.",
  },
  {
    patterns: [/join(?:ing)? (?:a )?(?:group|conversation)/i, /people already talking/i, /standing on the edge/i],
    skillId: "grp.joining",
    diagnosis: "Groups reject entries that reset the conversation, not entries from people they do not know.",
    technique: "Listen for twenty seconds, then enter on the topic already running.",
  },
  {
    patterns: [/(?:get )?interrupted/i, /talked over/i, /can'?t get a word in/i],
    skillId: "grp.recover-interrupt",
    diagnosis: "Being talked over is common; not returning to the point is what makes it costly.",
    technique: "Reclaim once, level tone: \"just to finish that thought…\". Once, not twice.",
  },
  {
    patterns: [/nervous|anxious before/i, /dread(?:ing)? (?:social|events|parties)/i, /overthink/i],
    skillId: "conf.nervousness",
    diagnosis: "Waiting to feel calm before speaking keeps the anxiety intact — approach is what reduces it, and it needs repetition rather than intensity.",
    technique: "Arrive early, one opener ready, speak within the first five minutes regardless of how you feel.",
  },
  {
    patterns: [/make friends/i, /acquaintances? (?:but|never)/i, /people don'?t (?:invite|include) me/i],
    skillId: "rel.invitations",
    diagnosis: "Friendships form from repeated meeting outside the default setting, which usually requires someone to make the specific proposal.",
    technique: "Specific activity, specific day, and make declining explicitly fine.",
  },
  {
    patterns: [/keep in touch/i, /lost touch/i, /drift(?:ed)? apart/i],
    skillId: "rel.contact",
    diagnosis: "Contact lapses because the imagined required gesture is too large, so nothing gets sent.",
    technique: "Two lines about something specific they told you. That is the whole message.",
  },
  {
    patterns: [/disagree/i, /avoid conflict/i, /back down/i],
    skillId: "asrt.disagree",
    diagnosis: "Disagreement that skips the restatement gets heard as dismissal, which is why it escalates.",
    technique: "Restate their point, name the specific difference, keep the tone level.",
  },
  {
    patterns: [/take criticism|handle criticism|defensive/i],
    skillId: "asrt.criticism",
    diagnosis: "Most immediate responses to criticism defend against something that was not said.",
    technique: "Ask for the specific example before responding at all.",
  },
  {
    patterns: [/comfort|support (?:someone|a friend)/i, /don'?t know what to say when (?:someone|they)/i, /upset\b/i],
    skillId: "emp.validation",
    diagnosis: "Advice gets rejected until the person believes their reaction has been accepted.",
    technique: "Say the reaction makes sense given what happened. Then stop — no 'but', no 'at least'.",
  },
  {
    patterns: [/messages? (?:sound|read|come across)/i, /tone (?:in|of) (?:my )?(?:messages|texts|emails)/i, /passive aggressive/i],
    skillId: "dig.tone",
    diagnosis: "You read your own messages in your own tone of voice; the recipient only has the words.",
    technique: "Re-read as the most uncharitable possible reader before sending.",
  },
  {
    patterns: [/eye contact/i],
    skillId: "nv.eye-contact",
    diagnosis: "People told to make more eye contact usually over-correct into a stare, which reads as intensity.",
    technique: "Look while they speak, break away while thinking, return at the end of your turn.",
  },
  {
    patterns: [/talk too fast|speaking too quickly|people ask me to repeat/i],
    skillId: "nv.pace",
    diagnosis: "Uniform fast speech flattens meaning — the listener cannot tell which part mattered.",
    technique: "Slow down for the one sentence carrying your point, and pause after it.",
  },
  {
    patterns: [/give feedback|tell (?:them|someone) (?:that )?their work/i],
    skillId: "asrt.feedback",
    diagnosis: "Trait-based feedback cannot be acted on, so it produces defensiveness rather than change.",
    technique: "Situation, observable behaviour, impact, request. Four short parts.",
  },
  {
    patterns: [/lead|leading (?:a|the) (?:team|group|meeting)/i, /run(?:ning)? (?:a )?meeting/i],
    skillId: "lead.facilitation",
    diagnosis: "Discussions fail by drifting rather than by lacking ideas; the midpoint summary is what converts talk into decisions.",
    technique: "State the purpose, summarise at the midpoint, close with a decision and an owner.",
  },
  {
    patterns: [/apolog/i, /messed up|said the wrong thing/i],
    skillId: "diff.apologising",
    diagnosis: "Apologies fail by continuing past the point: explaining intent reads as excuse-making.",
    technique: "What you did, its effect, what changes. Then stop.",
  },
];

export type CoachResult =
  | { kind: "routed"; routing: CoachRouting }
  | { kind: "refused"; message: string; reasons: string[] };

/**
 * Route a free-text question to a skill and a principle. Returns a refusal for
 * requests the product will not serve — with a concrete alternative, because a
 * bare refusal helps nobody.
 */
export function route(question: string, states: UserSkillState[]): CoachResult {
  const safety = checkPracticeRequest(question);
  if (safety.verdict === "block" || safety.verdict === "rewrite" || safety.verdict === "support") {
    return { kind: "refused", message: safety.message ?? "I can't help with that one.", reasons: safety.reasons };
  }

  const rule = RULES.find((item) => item.patterns.some((pattern) => pattern.test(question)));
  const skillId = rule?.skillId ?? fallbackSkill(question, states);
  const skill = getSkill(skillId);
  const lesson = lessonFor(skillId);
  const byId = new Map(states.map((state) => [state.skillId, state]));

  // Name a missing foundation when one is clearly below threshold — routing
  // someone to "conflict resolution" while they cannot yet disagree at all
  // wastes their week.
  const foundation = prerequisitesOf(skillId)
    .map((dep) => ({ dep, mastery: byId.get(dep.requires)?.mastery ?? 0 }))
    .filter((entry) => entry.mastery < entry.dep.minMastery * 0.7)
    .sort((a, b) => a.mastery - b.mastery)[0];

  const scenarios = scenariosForSkill(skillId);

  return {
    kind: "routed",
    routing: {
      skillId,
      diagnosis: rule?.diagnosis ?? `This looks like a ${skill?.name.toLowerCase() ?? "communication"} problem.`,
      technique: rule?.technique ?? lesson.concept,
      principle: lesson.concept,
      example: lesson.example,
      practiceScenario: scenarios[0] ?? null,
      foundation: foundation
        ? { skillId: foundation.dep.requires, rationale: foundation.dep.rationale }
        : undefined,
    },
  };
}

/**
 * With no rule match, route to the user's most goal-relevant weak skill rather
 * than answering the question directly. Being told "here is the skill this
 * probably belongs to" is more useful than a generic paragraph.
 */
function fallbackSkill(question: string, states: UserSkillState[]): Id {
  const lower = question.toLowerCase();
  const scored = states
    .map((state) => {
      const skill = getSkill(state.skillId);
      if (!skill) return null;
      const words = skill.name.toLowerCase().split(/\s+/);
      const hits = words.filter((word) => word.length > 3 && lower.includes(word)).length;
      return { state, skill, hits };
    })
    .filter((entry): entry is { state: UserSkillState; skill: NonNullable<ReturnType<typeof getSkill>>; hits: number } => entry !== null)
    .sort((a, b) => b.hits - a.hits || a.state.mastery - b.state.mastery);
  return scored[0]?.state.skillId ?? "conv.follow-up";
}

/** One-line summary of where the user currently stands on the routed skill. */
export function contextLine(skillId: Id, states: UserSkillState[]): string {
  const state = states.find((item) => item.skillId === skillId);
  const skill = getSkill(skillId);
  if (!state || !skill) return "";
  if (state.attemptCount === 0) return `You have not practised ${skill.name.toLowerCase()} here yet.`;
  return `You are ${stateFor(state.mastery)} on ${skill.name.toLowerCase()} — ${state.attemptCount} session${state.attemptCount === 1 ? "" : "s"} so far.`;
}
