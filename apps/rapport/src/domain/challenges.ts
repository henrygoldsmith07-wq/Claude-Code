import { requireSkill } from "./skills";
import type { Challenge, ChallengeAttempt, Id, TrainingContext, UserSkillState } from "./types";
import type { BehaviourKey } from "./types";
import { behaviourForSkill, behaviourLabel } from "./behaviours";

// ---------------------------------------------------------------------------
// Real-world challenges — the part that decides whether any of this transfers.
//
// Every challenge is written so that completion depends only on what the user
// does. "Ask one open question" is completable; "have a good conversation" is
// not, because it grades the other person's response. That rule is enforced by
// scripts/validate-content.mjs, not just by convention.
//
// Nothing here asks the user to approach strangers in isolated places, press
// after a no, extract commitments, or run a technique on someone. Challenges
// that would need those to succeed are simply not in the set.
// ---------------------------------------------------------------------------

function challenge(
  id: string,
  skillId: Id,
  difficulty: 1 | 2 | 3 | 4 | 5,
  fields: Omit<Challenge, "id" | "skillId" | "difficulty">,
): Challenge {
  const behaviour = fields.behaviour ?? behaviourForSkill(skillId);
  return { id, skillId, difficulty, ...fields, ...(behaviour ? { behaviour } : {}) };
}

const SOCIAL: TrainingContext[] = ["social", "work", "study"];
const ANY: TrainingContext[] = ["work", "study", "social", "family", "strangers", "online"];

export const CHALLENGES: Challenge[] = [
  // --- Easy ----------------------------------------------------------------
  challenge("ch.greet-first", "conf.initiative", 1, {
    objective: "Greet three people before they greet you.",
    context: "Anywhere you already see people: work, class, the gym, a shop.",
    completionCriteria: ["You spoke first", "Three separate people", "A greeting, not just eye contact"],
    harderVariant: "Add one sentence after the greeting — a comment on the situation.",
    reflectionPrompt: "Which of the three was hardest to go first with, and why?",
    contexts: ANY,
  }),
  challenge("ch.one-open-question", "conv.open-questions", 1, {
    objective: "Ask one open question — how, what or which — in a conversation today.",
    context: "Any conversation lasting more than a few seconds.",
    completionCriteria: ["The question could not be answered with yes or no", "You asked it out loud"],
    easierVariant: "Prepare the question in advance and use it when the moment arrives.",
    harderVariant: "Ask an open question of someone you would normally only exchange pleasantries with.",
    reflectionPrompt: "How long did they talk for compared with a usual answer?",
    contexts: ANY,
  }),
  challenge("ch.one-follow-up", "conv.follow-up", 2, {
    objective: "Ask one genuine follow-up question about a detail the other person mentioned.",
    context: "Any conversation where the other person says something specific.",
    completionCriteria: [
      "The question referred to something they actually said",
      "You asked it before changing the subject",
    ],
    easierVariant: "Repeat back the detail first, then ask about it.",
    harderVariant: "Ask two follow-ups over the course of the conversation, offering something of your own in between.",
    reflectionPrompt: "What detail did you pick, and what made you notice it?",
    contexts: ANY,
  }),
  challenge("ch.reflect-once", "conv.active-listening", 2, {
    objective: "Say back the gist of what someone told you, in your own words, once.",
    context: "A conversation where someone describes a situation or a problem.",
    completionCriteria: ["You summarised their point in one sentence", "You did it before adding your own view"],
    harderVariant: "Reflect the feeling as well as the content, tentatively.",
    reflectionPrompt: "What did they do immediately after you reflected it back?",
    contexts: ANY,
  }),
  challenge("ch.name-use", "conv.remembering", 2, {
    objective: "Use someone's name once in conversation, and recall one thing they told you previously.",
    context: "Anyone you have spoken to before.",
    completionCriteria: ["You used their name naturally", "You referred back to something specific from before"],
    easierVariant: "Just the callback — skip the name.",
    reflectionPrompt: "How did referring back change the start of the conversation?",
    contexts: ANY,
  }),
  challenge("ch.settle-posture", "nv.posture", 1, {
    objective: "In one conversation, turn your body towards the person and keep your hands still.",
    context: "Any face-to-face conversation.",
    completionCriteria: ["Shoulders turned towards them", "You noticed and settled fidgeting at least once"],
    reflectionPrompt: "Did the conversation feel different, or only look different?",
    contexts: ["work", "study", "social", "family"],
  }),
  challenge("ch.message-first-line", "dig.messaging", 1, {
    objective: "Send one message with the ask in the first line.",
    context: "Any message where you need something.",
    completionCriteria: ["The request is in the first sentence", "The context comes after it"],
    harderVariant: "Do it for a message you have been putting off.",
    reflectionPrompt: "How quickly did they reply compared with usual?",
    contexts: ["work", "study", "online"],
  }),

  // --- Intermediate --------------------------------------------------------
  challenge("ch.short-conversation", "conv.start", 3, {
    objective: "Start a conversation and keep it going for three exchanges.",
    context: "Someone you see regularly but rarely talk to.",
    completionCriteria: ["You opened", "At least three back-and-forth exchanges", "You ended it deliberately"],
    easierVariant: "Aim for one exchange, then leave warmly.",
    harderVariant: "Keep it going for five exchanges without asking two questions in a row.",
    reflectionPrompt: "Where did it nearly stall, and what kept it going?",
    contexts: SOCIAL,
  }),
  challenge("ch.state-opinion", "conf.opinions", 3, {
    objective: "State one opinion without hedging it, and give one reason.",
    context: "A discussion where you would usually stay neutral.",
    completionCriteria: ["You used 'I think' or equivalent", "One reason given", "You did not immediately soften it"],
    easierVariant: "State the opinion to one person rather than a group.",
    harderVariant: "State it when you know at least one person present disagrees.",
    reflectionPrompt: "What happened after you said it? What did you expect to happen?",
    contexts: ANY,
  }),
  challenge("ch.group-contribute", "conf.groups", 3, {
    objective: "Contribute once in the first ten minutes of a group conversation.",
    context: "A meeting, seminar, or group of friends.",
    completionCriteria: ["You spoke within the first ten minutes", "Unprompted — nobody asked you directly"],
    easierVariant: "Agree with someone and add one sentence.",
    harderVariant: "Contribute twice, the second time building on someone else's point.",
    reflectionPrompt: "How did contributing early change the rest of the meeting for you?",
    contexts: ["work", "study", "social"],
  }),
  challenge("ch.join-group", "grp.joining", 3, {
    objective: "Join a conversation already in progress by contributing on the current topic.",
    context: "A break, a kitchen, an event — wherever people are already talking.",
    completionCriteria: ["You listened first", "Your first contribution was on the topic in play", "No apology for joining"],
    easierVariant: "Join a group of two people you already know.",
    harderVariant: "Join a group where you know at most one person.",
    reflectionPrompt: "How long did you listen before speaking? Was it long enough?",
    contexts: ["work", "study", "social"],
  }),
  challenge("ch.invite", "rel.invitations", 3, {
    objective: "Invite someone to a specific activity at a specific time.",
    context: "Someone you get on with but rarely see outside the default setting.",
    completionCriteria: ["Specific activity, day and rough time", "You made declining explicitly fine", "You sent it"],
    easierVariant: "Suggest joining something already happening rather than proposing a new thing.",
    harderVariant: "Invite someone you have wanted to know better but never approached socially.",
    reflectionPrompt: "What did you expect the answer to be before you asked?",
    contexts: ["work", "study", "social", "online"],
  }),
  challenge("ch.say-no", "asrt.no", 3, {
    objective: "Decline one request with a clear no and at most one reason.",
    context: "Any request you would normally accept reluctantly.",
    completionCriteria: ["The no came in the first sentence", "One reason at most", "You did not offer a substitute you did not want"],
    easierVariant: "Say \"let me check and come back to you\", then decline by message.",
    harderVariant: "Decline in person, to someone who usually pushes.",
    reflectionPrompt: "How much of the discomfort was before saying it, and how much after?",
    contexts: ANY,
  }),
  challenge("ch.make-request", "asrt.requests", 3, {
    objective: "Ask directly for something you have been hinting at.",
    context: "Work, a flatmate, a friend — anywhere a hint has not worked.",
    completionCriteria: ["Stated as a request, not a hint", "Said what and by when", "You did not apologise for asking"],
    easierVariant: "Make the request by message first.",
    harderVariant: "Make it to someone more senior than you.",
    reflectionPrompt: "What was the actual response, versus the one you had rehearsed for?",
    contexts: ANY,
  }),
  challenge("ch.validate", "emp.validation", 3, {
    objective: "Validate someone's reaction before offering anything else — and add no 'but'.",
    context: "Someone tells you about something frustrating or disappointing.",
    completionCriteria: ["You said their reaction made sense", "No 'at least' and no 'but' straight after", "You waited before advising"],
    harderVariant: "Do it when you privately think they are overreacting.",
    reflectionPrompt: "What did they say next? Did they move on faster or slower than usual?",
    contexts: ANY,
  }),
  challenge("ch.ask-vent-or-solve", "emp.hold-off-solving", 3, {
    objective: "Ask someone whether they want ideas or just to talk it through.",
    context: "Someone brings you a problem.",
    completionCriteria: ["You asked before offering solutions", "You did what they said they wanted"],
    reflectionPrompt: "Which did they choose? Was it what you assumed?",
    contexts: ANY,
  }),
  challenge("ch.reclaim", "grp.recover-interrupt", 4, {
    objective: "After being interrupted, return to your point once, calmly.",
    context: "Any meeting or group conversation with fast talkers.",
    completionCriteria: ["You returned to the point", "Level tone", "You let it go if the group had moved on"],
    easierVariant: "Return to the point after the meeting, one-to-one.",
    reflectionPrompt: "How did the group respond when you came back to it?",
    contexts: ["work", "study", "social"],
  }),
  challenge("ch.maintain-contact", "rel.contact", 2, {
    objective: "Message one person about something specific they told you last time.",
    context: "Someone you have not spoken to in a while.",
    completionCriteria: ["The message references something specific", "You sent it without waiting for a reason"],
    harderVariant: "Do it with someone you have been avoiding messaging because too much time has passed.",
    reflectionPrompt: "Was the gap as significant to them as it felt to you?",
    contexts: ["social", "online"],
  }),
  challenge("ch.end-well", "conv.ending", 3, {
    objective: "End one conversation deliberately, naming something you valued in it.",
    context: "Any conversation you would normally let fade out.",
    completionCriteria: ["You signalled the ending", "You named something specific from the conversation"],
    reflectionPrompt: "Did ending on purpose feel abrupt, or clearer than usual?",
    contexts: SOCIAL,
  }),
  challenge("ch.tone-check", "dig.tone", 2, {
    objective: "Re-read one message as an uncharitable reader before sending, and adjust it.",
    context: "Any work or group-chat message written quickly.",
    completionCriteria: ["You re-read before sending", "You changed at least one thing, or confirmed it was fine"],
    reflectionPrompt: "What did you change? Would the original have been misread?",
    contexts: ["work", "study", "online"],
  }),

  // --- Advanced ------------------------------------------------------------
  challenge("ch.facilitate", "grp.facilitate", 5, {
    objective: "Facilitate a group discussion to a decision: purpose, midpoint summary, decision and owner.",
    context: "A meeting, group project or a group choosing between options.",
    completionCriteria: [
      "You stated the purpose at the start",
      "You summarised at the midpoint",
      "The group ended with a decision and someone owning it",
    ],
    easierVariant: "Do only the midpoint summary.",
    reflectionPrompt: "Which of the three moves was hardest, and what happened when you made it?",
    contexts: ["work", "study"],
  }),
  challenge("ch.resolve-disagreement", "diff.conflict", 5, {
    objective: "Work a disagreement towards a workable next step rather than a winner.",
    context: "An ongoing disagreement where the relationship matters more than the point.",
    completionCriteria: [
      "You restated their position before giving yours",
      "You named a shared interest",
      "You proposed a concrete next step",
    ],
    easierVariant: "Restate their position accurately and stop there for now.",
    reflectionPrompt: "What was the shared interest underneath the positions?",
    contexts: ["work", "study", "social", "family"],
  }),
  challenge("ch.introduce-people", "rel.friendship", 4, {
    objective: "Introduce two people to each other, with one sentence about each that gives them something to talk about.",
    context: "Any setting where you know two people who do not know each other.",
    completionCriteria: ["You introduced both by name", "You gave each a hook about the other", "You let the conversation continue without you steering it"],
    easierVariant: "Introduce them with names only.",
    reflectionPrompt: "Did they keep talking after you stepped back?",
    contexts: SOCIAL,
  }),
  challenge("ch.constructive-feedback", "asrt.feedback", 5, {
    objective: "Give one piece of feedback using situation, behaviour, impact and a request.",
    context: "Something recurring that you have been tolerating.",
    completionCriteria: [
      "You described observable behaviour, not character",
      "You named the impact",
      "You ended with a specific request",
    ],
    easierVariant: "Write it out in the four parts and send it as a message.",
    reflectionPrompt: "Which part was hardest to say, and did you soften it?",
    contexts: ["work", "study", "family"],
  }),
  challenge("ch.hold-boundary", "asrt.boundaries", 5, {
    objective: "State a limit and repeat it unchanged when it is pushed once.",
    context: "A recurring request that has become an assumption.",
    completionCriteria: ["One clear sentence", "Repeated calmly, not escalated", "You did not add new justifications"],
    easierVariant: "State the limit in writing.",
    reflectionPrompt: "What did you feel the urge to add the second time? Did you add it?",
    contexts: ANY,
  }),
  challenge("ch.take-lead", "lead.initiative", 5, {
    objective: "When a group stalls, propose a structure or a first step, and name what needs deciding.",
    context: "Group project, team meeting, or a group of friends failing to make a plan.",
    completionCriteria: ["You proposed something concrete", "You named the decision to be made", "You did not wait to be asked"],
    easierVariant: "Propose it to one person in the group first, and let them raise it.",
    reflectionPrompt: "How did the group respond to being given a structure?",
    contexts: ["work", "study", "social"],
  }),
  challenge("ch.include-quiet", "grp.include", 4, {
    objective: "Bring one quiet person into a group conversation by name, then leave a three-second pause.",
    context: "Any group with someone who has not spoken.",
    completionCriteria: ["You used their name and an open question", "You left a pause afterwards", "You did not fill the silence"],
    reflectionPrompt: "How long did the pause feel? How long was it actually?",
    contexts: ["work", "study", "social"],
  }),
  challenge("ch.apologise", "diff.apologising", 4, {
    objective: "Apologise for something specific in three sentences: what you did, its effect, what changes.",
    context: "Anything outstanding — a missed commitment, a sharp message.",
    completionCriteria: ["Named the action", "Named the effect on them", "No explanation of your intentions"],
    reflectionPrompt: "What did you want to add that you left out?",
    contexts: ANY,
  }),
];

const BY_ID = new Map<Id, Challenge>(CHALLENGES.map((item) => [item.id, item]));

export function getChallenge(id: Id): Challenge | undefined {
  return BY_ID.get(id);
}

export function challengesForSkill(skillId: Id): Challenge[] {
  return CHALLENGES.filter((item) => item.skillId === skillId);
}

export interface ChallengeSelection {
  challenge: Challenge;
  /** Which variant to present, if the user's level suggests one. */
  variant: "standard" | "easier" | "harder";
  reason: string;
}

/**
 * Pick a challenge for a skill, sized to the user and avoiding recent repeats.
 * When the skill has no hand-written challenge, one is derived from the skill's
 * behaviours — so every skill in the graph is practisable in the real world,
 * which is the whole point of the product.
 */
export function selectChallenge(
  skillId: Id,
  state: UserSkillState,
  history: ChallengeAttempt[],
  contexts: TrainingContext[],
  targetBehaviour?: BehaviourKey,
): ChallengeSelection {
  const recent = new Set(
    history
      .slice(-12)
      .filter((attempt) => attempt.completedAt || attempt.skippedAt)
      .map((attempt) => attempt.challengeId),
  );

  const target = Math.round(Math.min(5, Math.max(1, state.difficultyTolerance)));
  const candidates = challengesForSkill(skillId);
  const behaviourMatched = targetBehaviour ? candidates.filter((item) => item.behaviour === targetBehaviour) : candidates;
  const candidatePool = behaviourMatched.length > 0 ? behaviourMatched : candidates;
  const relevant = candidatePool.filter((item) => item.contexts.some((c) => contexts.includes(c)));
  const pool = (relevant.length > 0 ? relevant : candidatePool).filter((item) => !recent.has(item.id));
  const usable = pool.length > 0 ? pool : candidatePool;

  if (usable.length === 0) {
    return {
      challenge: deriveChallenge(skillId, target as 1 | 2 | 3 | 4 | 5),
      variant: "standard",
      reason: targetBehaviour
        ? `Built from this skill's behaviours to practise ${behaviourLabel(targetBehaviour)} — there is no fixed mission for it yet.`
        : "Built from this skill's behaviours — there is no fixed challenge for it yet.",
    };
  }

  const best = usable.reduce((chosen, item) =>
    Math.abs(item.difficulty - target) < Math.abs(chosen.difficulty - target) ? item : chosen,
  );

  if (best.difficulty > target + 1 && best.easierVariant) {
    return {
      challenge: best,
      variant: "easier",
      reason: targetBehaviour && best.behaviour === targetBehaviour
        ? `Targets ${behaviourLabel(targetBehaviour)} with a slightly smaller step.`
        : "Slightly scaled down to match where you are with this skill.",
    };
  }
  if (best.difficulty < target - 1 && best.harderVariant) {
    return {
      challenge: best,
      variant: "harder",
      reason: targetBehaviour && best.behaviour === targetBehaviour
        ? `Steps up ${behaviourLabel(targetBehaviour)} because the last level looked comfortable.`
        : "Stepped up — you have been handling this level comfortably.",
    };
  }
  return {
    challenge: best,
    variant: "standard",
    reason: targetBehaviour && best.behaviour === targetBehaviour
      ? `Targets the measured weakness: ${behaviourLabel(targetBehaviour)}.`
      : "Matches the level you have been managing recently.",
  };
}

/** Text actually shown, honouring the chosen variant. */
export function objectiveText(selection: ChallengeSelection): string {
  if (selection.variant === "easier" && selection.challenge.easierVariant) return selection.challenge.easierVariant;
  if (selection.variant === "harder" && selection.challenge.harderVariant) return selection.challenge.harderVariant;
  return selection.challenge.objective;
}

/**
 * A challenge generated from a skill's behaviour list. Deterministic, so it is
 * available offline and identical every time — and marked `generated` so the
 * UI can be honest about where it came from.
 */
export function deriveChallenge(skillId: Id, difficulty: 1 | 2 | 3 | 4 | 5): Challenge {
  const skill = requireSkill(skillId);
  const [first, second] = skill.behaviours;
  return {
    id: `ch.derived.${skillId}.${difficulty}`,
    skillId,
    behaviour: behaviourForSkill(skillId),
    difficulty,
    objective: first ? `Today, do this once: ${lowerFirst(first)}.` : `Practise ${skill.name.toLowerCase()} once today.`,
    context: `Wherever it fits naturally: ${skill.contexts.join(", ")}.`,
    completionCriteria: skill.behaviours.slice(0, 2),
    harderVariant: second ? `Do it twice, and add: ${lowerFirst(second)}.` : undefined,
    reflectionPrompt: "What made it easier or harder than you expected?",
    contexts: skill.contexts,
    generated: true,
  };
}

function lowerFirst(text: string): string {
  return text.charAt(0).toLowerCase() + text.slice(1);
}

/**
 * Swapping a challenge is free and unlimited. Skipping is recorded as a signal
 * about fit — never as a failure, and never counted against a streak.
 */
export function replaceChallenge(
  attempt: ChallengeAttempt,
  state: UserSkillState,
  history: ChallengeAttempt[],
  contexts: TrainingContext[],
): ChallengeSelection {
  const excluded = [...history, { ...attempt, skippedAt: new Date().toISOString() }];
  return selectChallenge(attempt.challenge.skillId, state, excluded, contexts);
}

