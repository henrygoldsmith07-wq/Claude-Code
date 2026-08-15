import { checkPracticeRequest } from "./safety";
import { STYLE_PROFILES } from "./simulator";
import { getSkill } from "./skills";
import type {
  BehaviourKey,
  CommunicationStyle,
  Id,
  SimulatedCharacter,
  SimulationScenario,
  UserSkillState,
} from "./types";

// ---------------------------------------------------------------------------
// Scenario library and scenario builder.
//
// The library covers the situations the brief names, each written so the
// objective is something the user does rather than a reaction they extract.
// Characters carry background facts because a conversation with someone who
// has nothing to say is not practice, it is a wall.
//
// The builder turns "I need to contribute more during a group project" into a
// runnable scenario without a model: it matches the description to skills, then
// to a template, then dials difficulty from the user's current level. When a
// model is available it improves the prose (see src/ai/tasks.ts) — but the
// structure, the characters and the evaluation criteria are decided here, so a
// generated scenario is never able to invent its own success conditions.
// ---------------------------------------------------------------------------

function character(
  id: string,
  name: string,
  style: CommunicationStyle,
  role: string,
  background: string[],
  interests: string[],
  overrides: Partial<Pick<SimulatedCharacter, "openness" | "reciprocity">> = {},
): SimulatedCharacter {
  const profile = STYLE_PROFILES[style];
  return {
    id,
    name,
    style,
    role,
    background,
    interests,
    openness: overrides.openness ?? profile.volunteering,
    reciprocity: overrides.reciprocity ?? profile.asksBack,
  };
}

export const SCENARIOS: SimulationScenario[] = [
  {
    id: "sc.new-person",
    title: "Meeting someone new",
    context: "A work social event. You have arrived alone and are standing near the drinks table with one other person.",
    skillIds: ["conv.start", "conv.open-questions"],
    objective: "Open a conversation and keep it going for a few exchanges.",
    difficulty: 2,
    characters: [
      character("ch.jo", "Jo", "friendly", "someone from another team", [
        "I moved over from the Bristol office in January.",
        "I'm still working out who does what here.",
      ], ["cycling", "cooking"]),
    ],
    branches: ["small talk about the event", "what each of you does", "how long you have been there"],
    evaluationCriteria: ["relevance", "questionQuality", "reciprocity", "contribution"],
    authoredBy: "system",
  },
  {
    id: "sc.short-answers",
    title: "Someone giving short answers",
    context: "You are waiting for a meeting to start, sitting next to a colleague you do not know well.",
    skillIds: ["conv.follow-up", "conv.silence"],
    objective: "Find something worth following up without it turning into an interview.",
    difficulty: 4,
    characters: [
      character("ch.sam", "Sam", "quiet", "a colleague from a different team", [
        "I've been here about two years.",
        "I mostly work on the reporting side.",
        "I was in Manchester before this.",
      ], ["running", "old films"], { openness: 0.12 }),
    ],
    branches: ["what they work on", "how long they have been there", "the meeting itself"],
    evaluationCriteria: ["followUpQuality", "questionQuality", "reciprocity", "listening"],
    authoredBy: "system",
  },
  {
    id: "sc.talkative",
    title: "Someone who does not stop talking",
    context: "A colleague has caught you in the kitchen and is mid-flow about their weekend.",
    skillIds: ["conv.balance", "grp.recover-interrupt"],
    objective: "Hold your share of the conversation and end it deliberately.",
    difficulty: 4,
    characters: [
      character("ch.alex", "Alex", "talkative", "a colleague you see most days", [
        "We drove down to Cornwall and the car broke down twice.",
        "My brother's staying with us at the moment.",
        "I've started doing a pottery class on Wednesdays.",
      ], ["pottery", "long drives", "true crime podcasts"]),
    ],
    branches: ["the trip", "the house guest", "the class", "back to work"],
    evaluationCriteria: ["contribution", "topicTransitions", "assertiveness", "clarity"],
    authoredBy: "system",
  },
  {
    id: "sc.join-group",
    title: "Joining a group already talking",
    context: "Three people are talking near the coffee machine about a project that has just been delayed.",
    skillIds: ["grp.joining", "conf.joining"],
    objective: "Join the conversation on the topic already in play.",
    difficulty: 4,
    characters: [
      character("ch.priya", "Priya", "direct", "a project lead", [
        "The delay came from procurement, not from us.",
        "I found out on Friday afternoon.",
      ], ["climbing"]),
      character("ch.tom", "Tom", "enthusiastic", "a developer on the project", [
        "I've been rebuilding the import step all week.",
      ], ["board games", "cycling"]),
    ],
    branches: ["what caused the delay", "what happens now", "who else is affected"],
    evaluationCriteria: ["relevance", "contribution", "topicTransitions", "floorEntry"],
    authoredBy: "system",
  },
  {
    id: "sc.group-project",
    title: "Contributing in a group project",
    context: "A project meeting where two people are doing most of the talking and a decision needs making.",
    skillIds: ["conf.groups", "grp.contributing"],
    objective: "Contribute at least twice, including one point that moves the decision along.",
    difficulty: 4,
    characters: [
      character("ch.dan", "Dan", "talkative", "a teammate with strong opinions", [
        "I think we should just go with the first option.",
        "I've done something like this before and it worked.",
      ], ["five-a-side"]),
      character("ch.mei", "Mei", "uncertain", "a teammate who defers", [
        "I don't mind either way really.",
        "I was worried about the timeline but I might be wrong.",
      ], ["baking"]),
    ],
    branches: ["which option to pick", "the timeline", "who does what"],
    evaluationCriteria: ["contribution", "assertiveness", "relevance", "clarity", "inclusion"],
    authoredBy: "system",
  },
  // -------------------------------------------------------------------------
  // Multi-party scenarios.
  //
  // Three characters rather than two, because two is not really a group: with
  // one other voice the floor still comes back to the user by default, and the
  // behaviours worth training here — getting in, bringing someone else in —
  // only exist once the conversation can carry on without you.
  // -------------------------------------------------------------------------
  {
    id: "sc.group-discussion",
    title: "A discussion where two people dominate",
    context:
      "A team catch-up about how to split the next piece of work. Two people are talking freely and a third has said almost nothing.",
    skillIds: ["grp.contributing", "grp.include", "conf.groups"],
    objective: "Say something of your own, and bring in the person who has not spoken.",
    difficulty: 4,
    characters: [
      character("ch.marc", "Marc", "talkative", "a teammate who thinks out loud", [
        "I'd rather we split it by component than by feature.",
        "I did it the other way on the last project and it was a mess.",
      ], ["running", "podcasts"]),
      character("ch.nadia", "Nadia", "direct", "a teammate who wants a decision", [
        "We said we'd decide this by Thursday.",
        "I don't mind which way, I mind that it keeps moving.",
      ], ["cycling"]),
      character("ch.ben", "Ben", "quiet", "a teammate who rarely speaks first", [
        "I've done the import side before.",
        "I think the component split hides the dependency problem.",
      ], ["chess"], { openness: 0.1, reciprocity: 0.15 }),
    ],
    branches: ["how to split the work", "the Thursday deadline", "who picks up the import side"],
    evaluationCriteria: ["contribution", "inclusion", "floorEntry", "relevance"],
    authoredBy: "system",
  },
  {
    id: "sc.interview-panel",
    title: "A two-person interview panel",
    context:
      "An interview for a role you want. Two interviewers are taking turns, and one asks noticeably harder follow-ups than the other.",
    skillIds: ["conf.speaking-clearly", "conf.nervousness", "conv.storytelling"],
    objective: "Answer clearly, and ask them something of your own before the end.",
    difficulty: 4,
    characters: [
      character("ch.rachel", "Rachel", "friendly", "the hiring manager", [
        "I've been running this team for about three years.",
        "We're growing the team by four people this year.",
      ], ["gardening"]),
      character("ch.imran", "Imran", "direct", "a senior engineer on the panel", [
        "I care more about how you decide things than what you've shipped.",
        "The last person in this role struggled with the ambiguity.",
      ], ["climbing"], { reciprocity: 0.2 }),
    ],
    branches: ["a project you led", "how you handle disagreement", "questions you have for them"],
    evaluationCriteria: ["clarity", "assertiveness", "questionQuality", "inclusion"],
    authoredBy: "system",
  },
  {
    id: "sc.difficult-conversation",
    title: "Raising a problem with two people who disagree",
    context:
      "You have asked for ten minutes with two colleagues about work that keeps arriving late. They do not agree with each other about the cause.",
    skillIds: ["diff.conflict", "asrt.disagree", "asrt.feedback"],
    objective: "State the problem as you see it and stay with it while they disagree.",
    difficulty: 5,
    characters: [
      character("ch.karen", "Karen", "direct", "a colleague who thinks the process is fine", [
        "The dates were always provisional.",
        "Nobody told me it was blocking anything.",
      ], ["swimming"], { reciprocity: 0.15 }),
      character("ch.owen", "Owen", "uncertain", "a colleague who half agrees with you", [
        "I did think it was getting tight.",
        "I didn't want to make it a whole thing.",
      ], ["photography"]),
    ],
    branches: ["whether the dates were firm", "what happens next time", "who needed to know"],
    evaluationCriteria: ["assertiveness", "clarity", "empathy", "floorEntry"],
    authoredBy: "system",
  },
  {
    id: "sc.seminar",
    title: "Speaking up in a seminar",
    context:
      "A seminar of about a dozen people. Two students answer almost every question, and the discussion moves quickly between points.",
    skillIds: ["grp.joining", "conf.opinions", "conf.groups"],
    objective: "Make one point of your own while the discussion is still on it.",
    difficulty: 5,
    characters: [
      character("ch.tutor", "Ella", "friendly", "the tutor running the seminar", [
        "I'd rather hear from more of you than hear more from a few.",
        "There isn't a right answer to this one.",
      ], ["opera"]),
      character("ch.jonas", "Jonas", "enthusiastic", "a student who answers first", [
        "I read the follow-up paper as well as the set one.",
        "I think the second argument undercuts the first.",
      ], ["debating"]),
      character("ch.lin", "Lin", "talkative", "a student who builds on every point", [
        "That's basically what the third chapter says.",
        "I'd push that further, actually.",
      ], ["film"]),
    ],
    branches: ["what the reading actually argued", "whether the argument holds", "an example from outside the text"],
    evaluationCriteria: ["floorEntry", "contribution", "relevance", "clarity"],
    authoredBy: "system",
  },
  {
    id: "sc.saying-no",
    title: "Declining a request",
    context: "A colleague asks you to take on a piece of work you do not have capacity for. They ask twice.",
    skillIds: ["asrt.no", "asrt.boundaries"],
    objective: "Decline clearly and hold the decline when it is pushed once.",
    difficulty: 3,
    characters: [
      character("ch.chris", "Chris", "direct", "a colleague under pressure", [
        "I'm covering two projects at the moment.",
        "The deadline is Thursday and I'm out Wednesday.",
      ], ["squash"], { reciprocity: 0.2 }),
    ],
    branches: ["the initial ask", "the push-back", "an alternative"],
    evaluationCriteria: ["assertiveness", "clarity", "empathy"],
    authoredBy: "system",
  },
  {
    id: "sc.disagreement",
    title: "Disagreeing with someone senior",
    context: "Your manager has proposed an approach you think will not work. You are one-to-one.",
    skillIds: ["asrt.disagree", "conf.opinions"],
    objective: "State your disagreement clearly while showing you understood their position.",
    difficulty: 5,
    characters: [
      character("ch.robin", "Robin", "direct", "your manager", [
        "I want this out before the end of the quarter.",
        "We tried the slower approach last year and it stalled.",
      ], ["sailing"], { reciprocity: 0.35 }),
    ],
    branches: ["the timeline", "the risk", "a compromise"],
    evaluationCriteria: ["assertiveness", "listening", "relevance", "clarity"],
    authoredBy: "system",
  },
  {
    id: "sc.receiving-criticism",
    title: "Receiving criticism",
    context: "A colleague tells you that something you did caused them a problem.",
    skillIds: ["asrt.criticism", "emp.perspective"],
    objective: "Understand the specific complaint before responding to it.",
    difficulty: 4,
    characters: [
      character("ch.nina", "Nina", "direct", "a colleague you work with weekly", [
        "I had to redo the section because the numbers changed after I'd written it.",
        "This is the second time it's happened.",
      ], ["gardening"], { reciprocity: 0.3 }),
    ],
    branches: ["what specifically happened", "the impact", "what changes"],
    evaluationCriteria: ["listening", "empathy", "assertiveness", "relevance"],
    authoredBy: "system",
  },
  {
    id: "sc.supporting",
    title: "Supporting someone who is struggling",
    context: "A friend messages you about a bad week at work and asks if you have a minute.",
    skillIds: ["emp.validation", "emp.hold-off-solving"],
    objective: "Acknowledge how they feel before offering anything else.",
    difficulty: 3,
    characters: [
      character("ch.lee", "Lee", "uncertain", "a close friend", [
        "I got passed over for the thing I'd been working towards.",
        "I found out from someone else, not from my manager.",
      ], ["climbing", "photography"]),
    ],
    branches: ["what happened", "how they feel about it", "what they do next"],
    evaluationCriteria: ["empathy", "listening", "relevance", "followUpQuality"],
    authoredBy: "system",
  },
  {
    id: "sc.invitation",
    title: "Inviting someone to something",
    context: "You get on well with someone at your gym and want to suggest coffee afterwards.",
    skillIds: ["rel.invitations", "conf.initiative"],
    objective: "Make a specific invitation that is easy to decline.",
    difficulty: 3,
    characters: [
      character("ch.jamie", "Jamie", "friendly", "someone you see at the gym most weeks", [
        "I'm usually here Tuesdays and Thursdays.",
        "I work shifts so my week moves around.",
      ], ["running", "coffee"]),
    ],
    branches: ["small talk", "the invitation", "arranging the details"],
    evaluationCriteria: ["assertiveness", "clarity", "reciprocity"],
    authoredBy: "system",
  },
  {
    id: "sc.messaging",
    title: "A message that landed badly",
    context: "A message you sent has been read as sharper than you intended, and the reply is cool.",
    skillIds: ["dig.tone", "diff.misunderstanding"],
    objective: "Repair the misunderstanding without over-apologising.",
    difficulty: 4,
    characters: [
      character("ch.rae", "Rae", "quiet", "a colleague you message often", [
        "I read your message before a meeting and it put me on edge.",
      ], ["cycling"], { openness: 0.2 }),
    ],
    branches: ["what they read into it", "what you meant", "how you leave it"],
    evaluationCriteria: ["empathy", "clarity", "listening"],
    authoredBy: "system",
  },
  {
    id: "sc.interrupted",
    title: "Being interrupted in a meeting",
    context: "You are making a point in a meeting and are cut off twice by the same person.",
    skillIds: ["grp.recover-interrupt", "conf.groups"],
    objective: "Return to your point once, calmly, and finish it.",
    difficulty: 4,
    characters: [
      character("ch.marcus", "Marcus", "talkative", "a colleague who talks over people", [
        "I've got a hard stop at half past.",
        "I already spoke to the client about this.",
      ], ["golf"], { reciprocity: 0.15 }),
      character("ch.ella", "Ella", "friendly", "the meeting chair", [
        "We need a decision by the end of this.",
      ], ["running"]),
    ],
    branches: ["the interruption", "reclaiming the point", "the decision"],
    evaluationCriteria: ["assertiveness", "contribution", "clarity"],
    authoredBy: "system",
  },
  {
    id: "sc.feedback",
    title: "Giving someone feedback",
    context: "Someone you work with keeps sending work late, and it has started affecting your deadlines.",
    skillIds: ["asrt.feedback", "lead.constructive-feedback"],
    objective: "Describe the behaviour and its impact, and make a specific request.",
    difficulty: 5,
    characters: [
      character("ch.theo", "Theo", "uncertain", "a colleague you rely on", [
        "I've been picking up extra work since Kim left.",
        "I know it's been late, I've been struggling to keep up.",
      ], ["running"]),
    ],
    branches: ["naming the pattern", "their explanation", "what changes"],
    evaluationCriteria: ["clarity", "assertiveness", "empathy", "listening"],
    authoredBy: "system",
  },
  {
    id: "sc.awkward",
    title: "An awkward moment",
    context: "You have just misremembered someone's name in front of two other people.",
    skillIds: ["conf.recovery", "diff.embarrassment"],
    objective: "Recover and stay in the conversation.",
    difficulty: 3,
    characters: [
      character("ch.kit", "Kit", "friendly", "someone you have met twice before", [
        "We met at the training day in March.",
      ], ["swimming"]),
    ],
    branches: ["the correction", "carrying on", "what you were talking about"],
    evaluationCriteria: ["relevance", "contribution", "clarity"],
    authoredBy: "system",
  },
  {
    id: "sc.asking-help",
    title: "Asking for help",
    context: "You are stuck on something at work and have been avoiding asking for two days.",
    skillIds: ["asrt.requests", "conf.initiative"],
    objective: "Ask directly, with enough context for them to help.",
    difficulty: 3,
    characters: [
      character("ch.ade", "Ade", "distracted", "a busy colleague who knows the system", [
        "I'm in and out of meetings today.",
        "I built the original version of this two years ago.",
      ], ["cricket"], { openness: 0.3 }),
    ],
    branches: ["getting their attention", "explaining the problem", "agreeing next steps"],
    evaluationCriteria: ["clarity", "assertiveness", "relevance"],
    authoredBy: "system",
  },
  {
    id: "sc.presentation-questions",
    title: "Questions after a presentation",
    context: "You have just presented and are taking questions, one of which is sceptical.",
    skillIds: ["lead.clarity", "asrt.criticism"],
    objective: "Answer clearly without becoming defensive.",
    difficulty: 5,
    characters: [
      character("ch.hugh", "Hugh", "direct", "someone in the audience", [
        "I've seen three versions of this proposal in two years.",
      ], ["chess"], { reciprocity: 0.2 }),
    ],
    branches: ["the sceptical question", "the follow-up", "closing"],
    evaluationCriteria: ["clarity", "listening", "assertiveness"],
    authoredBy: "system",
  },
];

const BY_ID = new Map<Id, SimulationScenario>(SCENARIOS.map((item) => [item.id, item]));

export function getScenario(id: Id): SimulationScenario | undefined {
  return BY_ID.get(id);
}

export function scenariosForSkill(skillId: Id): SimulationScenario[] {
  return SCENARIOS.filter((item) => item.skillIds.includes(skillId));
}

/**
 * Pick a scenario for a skill at the right level, and adapt its characters to
 * the delivered difficulty: at high difficulty the same scenario runs with a
 * less forthcoming version of the character rather than a different one.
 */
export function selectScenario(skillId: Id, state: UserSkillState, recentScenarioIds: Id[]): SimulationScenario | null {
  const candidates = scenariosForSkill(skillId);
  if (candidates.length === 0) return null;
  const unseen = candidates.filter((item) => !recentScenarioIds.includes(item.id));
  const pool = unseen.length > 0 ? unseen : candidates;
  const target = state.difficultyTolerance;
  const chosen = pool.reduce((best, item) =>
    Math.abs(item.difficulty - target) < Math.abs(best.difficulty - target) ? item : best,
  );
  return chosen;
}

/** Scale a scenario's characters to a delivered difficulty without changing who they are. */
export function atDifficulty(scenario: SimulationScenario, difficulty: 1 | 2 | 3 | 4 | 5): SimulationScenario {
  const hardness = (difficulty - scenario.difficulty) * 0.12;
  return {
    ...scenario,
    difficulty,
    characters: scenario.characters.map((item) => ({
      ...item,
      openness: clamp01(item.openness - hardness),
      reciprocity: clamp01(item.reciprocity - hardness),
    })),
  };
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

// --- Scenario builder ------------------------------------------------------

const DESCRIPTION_RULES: { pattern: RegExp; skillIds: Id[]; criteria: BehaviourKey[]; template: Id }[] = [
  { pattern: /\bgroup project|team meeting|contribute more|speak up in (?:a )?(?:group|meeting)\b/i, skillIds: ["conf.groups", "grp.contributing"], criteria: ["contribution", "assertiveness", "relevance"], template: "sc.group-project" },
  { pattern: /\bsay no|turn (?:them|it) down|decline|too much work\b/i, skillIds: ["asrt.no"], criteria: ["assertiveness", "clarity", "empathy"], template: "sc.saying-no" },
  { pattern: /\bdisagree|push back|argue|different view\b/i, skillIds: ["asrt.disagree"], criteria: ["assertiveness", "listening", "clarity"], template: "sc.disagreement" },
  { pattern: /\bcriticis|feedback (?:from|about) me|told off|performance review\b/i, skillIds: ["asrt.criticism"], criteria: ["listening", "empathy", "assertiveness"], template: "sc.receiving-criticism" },
  { pattern: /\bgive (?:them )?feedback|late work|not pulling their weight\b/i, skillIds: ["asrt.feedback"], criteria: ["clarity", "assertiveness", "empathy"], template: "sc.feedback" },
  { pattern: /\bsupport|upset|struggling|bad news|comfort\b/i, skillIds: ["emp.validation", "emp.hold-off-solving"], criteria: ["empathy", "listening", "relevance"], template: "sc.supporting" },
  { pattern: /\binvit|ask (?:them|him|her) (?:out|to)|coffee|meet up\b/i, skillIds: ["rel.invitations"], criteria: ["assertiveness", "clarity", "reciprocity"], template: "sc.invitation" },
  { pattern: /\bsmall talk|start(?:ing)? (?:a )?conversation|new people|networking\b/i, skillIds: ["conv.start", "conv.open-questions"], criteria: ["questionQuality", "reciprocity", "relevance"], template: "sc.new-person" },
  { pattern: /\bshort answers|conversation (?:dies|dries up)|run out of things\b/i, skillIds: ["conv.follow-up"], criteria: ["followUpQuality", "questionQuality", "listening"], template: "sc.short-answers" },
  { pattern: /\bjoin(?:ing)? (?:a )?(?:group|conversation)|break the ice at\b/i, skillIds: ["grp.joining"], criteria: ["relevance", "contribution"], template: "sc.join-group" },
  { pattern: /\binterrupt|talk over|cut off\b/i, skillIds: ["grp.recover-interrupt"], criteria: ["assertiveness", "contribution"], template: "sc.interrupted" },
  { pattern: /\bask(?:ing)? for help|stuck\b/i, skillIds: ["asrt.requests"], criteria: ["clarity", "assertiveness"], template: "sc.asking-help" },
  { pattern: /\bmessage|text|email|chat|tone\b/i, skillIds: ["dig.tone"], criteria: ["clarity", "empathy"], template: "sc.messaging" },
  { pattern: /\bpresent(?:ation|ing)?|questions after|q&a\b/i, skillIds: ["lead.clarity"], criteria: ["clarity", "listening", "assertiveness"], template: "sc.presentation-questions" },
];

export interface BuildScenarioInput {
  description: string;
  difficulty: 1 | 2 | 3 | 4 | 5;
  /** Used only to title the scenario; never stored beyond the scenario itself. */
  now: string;
}

export type BuildScenarioResult =
  | { ok: true; scenario: SimulationScenario }
  | { ok: false; message: string; reasons: string[] };

/**
 * Build a runnable scenario from a free-text description. Deterministic: the
 * same description always produces the same structure, which is what makes the
 * "replay at higher difficulty" feature meaningful.
 */
export function buildScenario(input: BuildScenarioInput): BuildScenarioResult {
  const safety = checkPracticeRequest(input.description);
  if (safety.verdict !== "ok") {
    return { ok: false, message: safety.message ?? "That can't be turned into practice here.", reasons: safety.reasons };
  }

  const rule = DESCRIPTION_RULES.find((item) => item.pattern.test(input.description));
  const template = rule ? getScenario(rule.template) : undefined;
  const base = template ?? SCENARIOS[0];
  if (!base) return { ok: false, message: "No scenario template available.", reasons: ["no-template"] };

  const skillIds = rule?.skillIds ?? base.skillIds;
  const criteria = rule?.criteria ?? base.evaluationCriteria;
  const primary = skillIds[0] ? getSkill(skillIds[0]) : undefined;

  const scenario: SimulationScenario = {
    ...atDifficulty(base, input.difficulty),
    id: `sc.user.${hash(input.description)}`,
    title: titleFrom(input.description),
    context: `${input.description.trim()}${input.description.trim().endsWith(".") ? "" : "."} ${base.context}`,
    skillIds,
    objective: primary ? `Practise ${primary.name.toLowerCase()}: ${primary.summary}` : base.objective,
    evaluationCriteria: criteria,
    authoredBy: "user",
    safetyCheckedAt: input.now,
  };
  return { ok: true, scenario };
}

function titleFrom(description: string): string {
  const trimmed = description.trim().replace(/\s+/g, " ");
  const short = trimmed.length <= 60 ? trimmed : `${trimmed.slice(0, 57)}…`;
  return short.charAt(0).toUpperCase() + short.slice(1);
}

function hash(text: string): string {
  let value = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(36);
}
