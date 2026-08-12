import { SKILL_DOMAINS } from "./types";
import type { Id, Skill, SkillDependency, SkillDomain, TrainingContext } from "./types";

// ---------------------------------------------------------------------------
// The skill graph.
//
// Skills are defined by observable behaviours, never by traits. "Handling
// nervousness" is a set of things a person does (arrive early, name the
// feeling, speak on the first pause) — not a measure of how anxious they are.
// That distinction is what makes the graph trainable and keeps the app from
// grading personalities.
//
// Dependencies are soft. A prerequisite below its threshold biases the
// recommender towards the earlier skill; it never locks content. People arrive
// with uneven profiles, and a hard gate would insult half of them.
// ---------------------------------------------------------------------------

type SkillSeed = Omit<Skill, "domain"> & { domain?: SkillDomain };

function domainSkills(domain: SkillDomain, seeds: SkillSeed[]): Skill[] {
  return seeds.map((seed) => ({ ...seed, domain }));
}

const ALL: TrainingContext[] = ["work", "study", "social", "family", "strangers", "online"];
const FACE_TO_FACE: TrainingContext[] = ["work", "study", "social", "family", "strangers"];

const CONVERSATION = domainSkills("conversation", [
  {
    id: "conv.start",
    name: "Starting conversations",
    summary: "Open an exchange with a low-stakes remark or question rather than waiting to be approached.",
    behaviours: [
      "Speaks first within the first minute of a natural opportunity",
      "Uses the shared situation as the opener rather than a rehearsed line",
      "Keeps the opener short enough that the other person can answer easily",
    ],
    baseDifficulty: 2,
    contexts: FACE_TO_FACE,
  },
  {
    id: "conv.open-questions",
    name: "Open questions",
    summary: "Ask questions that cannot be answered with one word, so the other person has room to talk.",
    behaviours: [
      "Asks how/what/which questions rather than yes-no ones",
      "Asks about experience and reasons rather than facts alone",
      "Avoids stacking two questions into one",
    ],
    baseDifficulty: 2,
    contexts: ALL,
  },
  {
    id: "conv.follow-up",
    name: "Follow-up questions",
    summary: "Pick a detail from what was just said and ask about that, instead of changing subject.",
    behaviours: [
      "References a specific noun or feeling from the previous turn",
      "Explores before relating a comparable experience of their own",
      "Asks at most one follow-up before offering something back",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "conv.active-listening",
    name: "Active listening",
    summary: "Show, in words, that the previous turn landed — before adding anything new.",
    behaviours: [
      "Reflects back the gist in their own words",
      "Names the other person's stated feeling without diagnosing it",
      "Waits for the end of the thought before responding",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "conv.balance",
    name: "Conversational balance",
    summary: "Keep speaking time roughly even, adjusting to whoever is holding back.",
    behaviours: [
      "Notices when their share of talking passes about two thirds",
      "Hands the floor back with a question after a longer turn",
      "Fills less of the silence when the other person is mid-thought",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "conv.transitions",
    name: "Topic transitions",
    summary: "Move to a new topic with a visible bridge instead of a jump.",
    behaviours: [
      "Links the new topic to something already said",
      "Signals the change (\"that reminds me…\")",
      "Checks the current topic is finished before moving",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "conv.ending",
    name: "Ending conversations",
    summary: "Close an exchange warmly and on purpose rather than letting it fade.",
    behaviours: [
      "Signals the ending before leaving (\"I should get back, but…\")",
      "Names something specific they valued in the exchange",
      "Leaves a door open where appropriate",
    ],
    baseDifficulty: 3,
    contexts: FACE_TO_FACE,
  },
  {
    id: "conv.remembering",
    name: "Remembering details",
    summary: "Retain and later reuse specifics the other person mentioned.",
    behaviours: [
      "Refers back to a detail from an earlier conversation",
      "Asks how a previously mentioned event went",
      "Uses names accurately",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "conv.storytelling",
    name: "Storytelling",
    summary: "Tell a short anecdote with a point, sized to the moment.",
    behaviours: [
      "Opens with the situation in one sentence",
      "Keeps it under about a minute unless invited to continue",
      "Ends on the point rather than trailing off",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
  {
    id: "conv.humour",
    name: "Humour",
    summary: "Use light humour that includes rather than targets anyone.",
    behaviours: [
      "Jokes about the situation rather than a person present",
      "Reads whether the last attempt landed before trying again",
      "Moves on quickly when a joke misses",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
  {
    id: "conv.silence",
    name: "Handling silence",
    summary: "Let a pause exist without rushing to fill it or reading it as failure.",
    behaviours: [
      "Waits two or three seconds before filling a gap",
      "Uses a pause to ask about something rather than to apologise",
      "Stays physically settled during the pause",
    ],
    baseDifficulty: 4,
    contexts: FACE_TO_FACE,
  },
]);

const CONFIDENCE = domainSkills("confidence", [
  {
    id: "conf.initiative",
    name: "Taking initiative",
    summary: "Act first — greet, suggest, ask — rather than waiting for permission.",
    behaviours: [
      "Makes the first move in a low-stakes situation each day",
      "Suggests a concrete option instead of asking \"what do you want to do?\"",
      "Follows through on the suggestion they made",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "conf.speaking-clearly",
    name: "Speaking clearly",
    summary: "Be audible and finish sentences, especially when nervous.",
    behaviours: [
      "Speaks at a volume the listener does not have to strain for",
      "Finishes sentences rather than trailing off",
      "Slows at the important part instead of speeding up",
    ],
    baseDifficulty: 2,
    contexts: FACE_TO_FACE,
  },
  {
    id: "conf.opinions",
    name: "Expressing opinions",
    summary: "State a view as your own, without over-hedging or apologising for it.",
    behaviours: [
      "Uses \"I think\" rather than \"people say\"",
      "Gives one reason for the view",
      "Does not immediately retract when someone disagrees",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "conf.nervousness",
    name: "Handling nervousness",
    summary: "Keep acting while nervous, using preparation rather than suppression.",
    behaviours: [
      "Arrives early enough to settle",
      "Has one opener prepared for the situation",
      "Speaks within the first few minutes rather than waiting for calm",
    ],
    baseDifficulty: 3,
    contexts: FACE_TO_FACE,
  },
  {
    id: "conf.groups",
    name: "Participating in groups",
    summary: "Contribute at least once to a group exchange without being invited.",
    behaviours: [
      "Says something within the first ten minutes",
      "Builds on someone else's point rather than starting cold",
      "Speaks to the group rather than only to one ally",
    ],
    baseDifficulty: 4,
    contexts: ["work", "study", "social"],
  },
  {
    id: "conf.joining",
    name: "Joining conversations",
    summary: "Enter an existing conversation at a natural seam.",
    behaviours: [
      "Listens for a few seconds before speaking",
      "Enters on a topic already in play",
      "Uses proximity and eye contact to signal intent first",
    ],
    baseDifficulty: 4,
    contexts: ["work", "study", "social", "strangers"],
  },
  {
    id: "conf.recovery",
    name: "Recovering from awkward moments",
    summary: "Continue the conversation after a stumble instead of withdrawing.",
    behaviours: [
      "Acknowledges briefly and moves on",
      "Does not over-explain the mistake",
      "Stays in the conversation for at least another turn",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
]);

const NON_VERBAL = domainSkills("non-verbal", [
  {
    id: "nv.eye-contact",
    name: "Eye contact principles",
    summary: "Hold comfortable, intermittent eye contact — a pattern, not a stare.",
    behaviours: [
      "Looks at the speaker while they are speaking",
      "Breaks contact naturally when thinking",
      "Returns attention at the end of their turn",
    ],
    baseDifficulty: 2,
    contexts: FACE_TO_FACE,
  },
  {
    id: "nv.posture",
    name: "Posture",
    summary: "Orient the body towards the person and stay settled.",
    behaviours: [
      "Turns shoulders towards the speaker",
      "Keeps hands and feet still enough not to distract",
      "Stands or sits open rather than closed off",
    ],
    baseDifficulty: 2,
    contexts: FACE_TO_FACE,
  },
  {
    id: "nv.expression",
    name: "Facial expression",
    summary: "Let the face show that you are following, so the speaker gets feedback.",
    behaviours: [
      "Reacts visibly to what is being said",
      "Matches expression to the content",
      "Nods at natural intervals rather than constantly",
    ],
    baseDifficulty: 3,
    contexts: FACE_TO_FACE,
  },
  {
    id: "nv.vocal-clarity",
    name: "Vocal clarity",
    summary: "Articulate ends of words and hold volume to the end of the sentence.",
    behaviours: [
      "Keeps volume steady through the final words",
      "Reduces filler words in prepared remarks",
      "Pauses instead of using a filler",
    ],
    baseDifficulty: 3,
    contexts: FACE_TO_FACE,
  },
  {
    id: "nv.pace",
    name: "Speaking pace",
    summary: "Speak at a pace the listener can follow, and slow down at the key point.",
    behaviours: [
      "Stays roughly within a conversational words-per-minute range",
      "Pauses at sentence boundaries",
      "Slows deliberately for the important sentence",
    ],
    baseDifficulty: 3,
    contexts: FACE_TO_FACE,
  },
  {
    id: "nv.variation",
    name: "Vocal variation",
    summary: "Vary pitch and emphasis so meaning is carried by the voice too.",
    behaviours: [
      "Emphasises the operative word in a sentence",
      "Ends statements downward rather than as questions",
      "Varies pace between setup and punchline",
    ],
    baseDifficulty: 4,
    contexts: FACE_TO_FACE,
  },
  {
    id: "nv.space",
    name: "Appropriate personal space",
    summary: "Match distance to context and adjust when the other person shifts.",
    behaviours: [
      "Leaves the distance others in the setting are using",
      "Steps back if the other person steps back",
      "Avoids blocking someone's exit route",
    ],
    baseDifficulty: 2,
    contexts: FACE_TO_FACE,
  },
]);

const RELATIONSHIPS = domainSkills("relationships", [
  {
    id: "rel.friendship",
    name: "Building friendships",
    summary: "Turn repeated contact into a relationship by initiating outside the default setting.",
    behaviours: [
      "Moves an acquaintance to a second context (coffee, walk, shared activity)",
      "Shares something modestly personal and reciprocates when they do",
      "Initiates roughly as often as the other person",
    ],
    baseDifficulty: 4,
    contexts: ["work", "study", "social"],
  },
  {
    id: "rel.contact",
    name: "Maintaining contact",
    summary: "Keep relationships alive with small, low-cost, regular contact.",
    behaviours: [
      "Sends a short message tied to something they mentioned",
      "Does not wait for the other person to go first every time",
      "Keeps contact proportional to the closeness of the relationship",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "rel.invitations",
    name: "Invitations",
    summary: "Make a specific, easy-to-decline invitation.",
    behaviours: [
      "Proposes a specific activity, time and place",
      "Makes declining explicitly fine",
      "Accepts a no without pressing",
    ],
    baseDifficulty: 4,
    contexts: ["work", "study", "social", "online"],
  },
  {
    id: "rel.interest",
    name: "Showing interest",
    summary: "Ask about what matters to the other person and remember the answer.",
    behaviours: [
      "Asks about something they care about, not just their circumstances",
      "Follows up later on what they said",
      "Listens without immediately turning it to themselves",
    ],
    baseDifficulty: 2,
    contexts: ALL,
  },
  {
    id: "rel.support",
    name: "Supporting others",
    summary: "Offer support that matches what the person actually wants.",
    behaviours: [
      "Asks whether they want to vent or to problem-solve",
      "Offers something concrete and time-bounded",
      "Follows up afterwards",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
  {
    id: "rel.reliability",
    name: "Reliability",
    summary: "Do what you said you would, and say so early when you cannot.",
    behaviours: [
      "Confirms plans in advance",
      "Cancels early rather than silently",
      "Follows through on offered help",
    ],
    baseDifficulty: 2,
    contexts: ALL,
  },
  {
    id: "rel.reciprocity",
    name: "Reciprocity",
    summary: "Keep giving and receiving roughly balanced over time.",
    behaviours: [
      "Returns invitations within a reasonable window",
      "Matches disclosure depth rather than over- or under-sharing",
      "Notices when the balance has drifted and adjusts",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "rel.boundaries",
    name: "Recognising boundaries",
    summary: "Notice signals that someone wants space, and act on them.",
    behaviours: [
      "Stops a topic when the other person disengages",
      "Accepts a no on the first no",
      "Checks before escalating contact frequency",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
]);

const ASSERTIVENESS = domainSkills("assertiveness", [
  {
    id: "asrt.no",
    name: "Saying no",
    summary: "Decline clearly and warmly, without a chain of justifications.",
    behaviours: [
      "Says no in the first sentence",
      "Gives at most one reason",
      "Offers an alternative only if genuinely willing",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "asrt.requests",
    name: "Making requests",
    summary: "Ask for what you want, specifically, without apologising for asking.",
    behaviours: [
      "States the request as a request, not a hint",
      "Says what, by when, and why it matters",
      "Accepts a no without withdrawing the relationship",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "asrt.boundaries",
    name: "Setting boundaries",
    summary: "State a limit once, calmly, and hold it under mild pressure.",
    behaviours: [
      "Names the specific behaviour and the specific limit",
      "Repeats the limit rather than escalating the argument",
      "Stays civil while not conceding",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
  {
    id: "asrt.disagree",
    name: "Disagreeing respectfully",
    summary: "Separate the position from the person and say where you differ.",
    behaviours: [
      "Restates their point before disagreeing",
      "Names the specific point of difference",
      "Keeps voice and pace level",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
  {
    id: "asrt.feedback",
    name: "Giving feedback",
    summary: "Describe behaviour and impact, then make a request.",
    behaviours: [
      "Describes what happened without character judgements",
      "States the impact on the work or on them",
      "Ends with a specific request or question",
    ],
    baseDifficulty: 4,
    contexts: ["work", "study", "family"],
  },
  {
    id: "asrt.criticism",
    name: "Receiving criticism",
    summary: "Take in criticism, check understanding, and respond rather than defend.",
    behaviours: [
      "Asks a clarifying question before replying",
      "Acknowledges the part that is fair",
      "States what they will do differently, or where they disagree",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
  {
    id: "asrt.pressure",
    name: "Handling pressure",
    summary: "Buy time instead of agreeing under pressure.",
    behaviours: [
      "Says \"let me check and come back to you\"",
      "Names the pressure explicitly when it persists",
      "Sticks to the original answer when it has not changed",
    ],
    baseDifficulty: 5,
    contexts: ALL,
  },
]);

const EMPATHY = domainSkills("empathy", [
  {
    id: "emp.perspective",
    name: "Perspective-taking",
    summary: "Work out how the situation looks from the other side before responding.",
    behaviours: [
      "States their likely concern in their terms",
      "Considers a second interpretation before reacting",
      "Separates their intent from the effect on you",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
  {
    id: "emp.recognition",
    name: "Emotional recognition",
    summary: "Notice and name what the other person seems to be feeling, tentatively.",
    behaviours: [
      "Names the feeling as a guess (\"that sounds frustrating?\")",
      "Uses their words rather than clinical labels",
      "Updates when they correct you",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "emp.validation",
    name: "Validation",
    summary: "Acknowledge the feeling as reasonable before anything else.",
    behaviours: [
      "Says the reaction makes sense given the situation",
      "Does not immediately add \"but\"",
      "Avoids minimising comparisons",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "emp.responses",
    name: "Appropriate responses",
    summary: "Match the response to what the person needs right now.",
    behaviours: [
      "Asks what would help before offering it",
      "Matches the seriousness of their framing",
      "Keeps their situation the subject",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
  {
    id: "emp.ask-dont-assume",
    name: "Asking rather than assuming",
    summary: "Check an interpretation instead of acting on it.",
    behaviours: [
      "Asks a clarifying question when a message reads badly",
      "States the assumption out loud before relying on it",
      "Avoids attributing motive without evidence",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "emp.hold-off-solving",
    name: "Supporting without rushing to solve",
    summary: "Stay with the problem long enough that the person feels heard.",
    behaviours: [
      "Waits for at least two turns before offering solutions",
      "Asks whether they want ideas",
      "Reflects the difficulty back before advising",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
]);

const GROUP = domainSkills("group", [
  {
    id: "grp.joining",
    name: "Joining groups",
    summary: "Approach and enter a group without disrupting what is happening.",
    behaviours: [
      "Stands at the edge and listens before speaking",
      "Enters on the current topic",
      "Waits for a natural pause rather than a gap in volume",
    ],
    baseDifficulty: 4,
    contexts: ["work", "study", "social"],
  },
  {
    id: "grp.contributing",
    name: "Finding opportunities to contribute",
    summary: "Spot the openings where a contribution will actually fit.",
    behaviours: [
      "Contributes after a question is asked of the group",
      "Adds to a point rather than restarting the topic",
      "Keeps the contribution short enough to hand back",
    ],
    baseDifficulty: 4,
    contexts: ["work", "study", "social"],
  },
  {
    id: "grp.no-interrupt",
    name: "Avoiding interruption",
    summary: "Let people finish, and hold your point until they have.",
    behaviours: [
      "Notes the point and waits",
      "Enters on the falling tone at the end of a thought",
      "Yields when two people start at once",
    ],
    baseDifficulty: 3,
    contexts: ["work", "study", "social", "family"],
  },
  {
    id: "grp.recover-interrupt",
    name: "Recovering after interruption",
    summary: "Reclaim the floor calmly when you were cut off.",
    behaviours: [
      "Returns to the point once (\"to finish that thought…\")",
      "Keeps tone level rather than apologetic or sharp",
      "Lets it go on the second attempt if the group has moved on",
    ],
    baseDifficulty: 4,
    contexts: ["work", "study", "social"],
  },
  {
    id: "grp.include",
    name: "Including quieter people",
    summary: "Create room for someone who has not spoken, without spotlighting them.",
    behaviours: [
      "Asks an open question directed at them by name",
      "Refers back to something they said earlier",
      "Leaves a pause after directing the question",
    ],
    baseDifficulty: 4,
    contexts: ["work", "study", "social"],
  },
  {
    id: "grp.facilitate",
    name: "Facilitating discussion",
    summary: "Keep a discussion moving and on topic without dominating it.",
    behaviours: [
      "Summarises where the group has got to",
      "Names the next question to settle",
      "Redirects tangents without dismissing them",
    ],
    baseDifficulty: 5,
    contexts: ["work", "study"],
  },
  {
    id: "grp.leadership",
    name: "Group leadership",
    summary: "Take responsibility for the group's direction when nobody else has.",
    behaviours: [
      "Proposes a structure when the group is stuck",
      "Assigns or invites ownership of next steps",
      "Closes with an agreed decision",
    ],
    baseDifficulty: 5,
    contexts: ["work", "study"],
  },
]);

const DIFFICULT = domainSkills("difficult", [
  {
    id: "diff.misunderstanding",
    name: "Misunderstandings",
    summary: "Surface and repair a misunderstanding early rather than letting it settle.",
    behaviours: [
      "Names the mismatch directly",
      "Asks what they understood",
      "Restates their own meaning in different words",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
  {
    id: "diff.apologising",
    name: "Apologising",
    summary: "Apologise for the specific thing, without excuses or self-flagellation.",
    behaviours: [
      "Names what they did",
      "Acknowledges the effect",
      "Says what will change, then stops",
    ],
    baseDifficulty: 3,
    contexts: ALL,
  },
  {
    id: "diff.conflict",
    name: "Conflict resolution",
    summary: "Move a disagreement towards a workable outcome instead of a winner.",
    behaviours: [
      "Separates the issue from the relationship",
      "Finds the shared interest underneath the positions",
      "Proposes a concrete next step",
    ],
    baseDifficulty: 5,
    contexts: ALL,
  },
  {
    id: "diff.criticism",
    name: "Handling criticism in the moment",
    summary: "Stay engaged and level when criticised in front of others.",
    behaviours: [
      "Pauses before responding",
      "Asks for the specific example",
      "Defers detail to a later one-to-one",
    ],
    baseDifficulty: 5,
    contexts: ["work", "study", "family"],
  },
  {
    id: "diff.rejection",
    name: "Rejection",
    summary: "Accept a no gracefully and keep the relationship intact.",
    behaviours: [
      "Accepts on the first no",
      "Thanks them for being direct",
      "Makes a later approach only where genuinely appropriate",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
  {
    id: "diff.embarrassment",
    name: "Embarrassment",
    summary: "Carry on after an embarrassing moment rather than leaving.",
    behaviours: [
      "Names it lightly or lets it pass",
      "Stays for at least another few minutes",
      "Does not re-raise it repeatedly",
    ],
    baseDifficulty: 4,
    contexts: ALL,
  },
  {
    id: "diff.breakdown",
    name: "Communication breakdowns",
    summary: "Stop, reset and change channel when an exchange keeps failing.",
    behaviours: [
      "Names that it is not working",
      "Proposes a different time or medium",
      "Restates the shared objective",
    ],
    baseDifficulty: 5,
    contexts: ALL,
  },
]);

const DIGITAL = domainSkills("digital", [
  {
    id: "dig.messaging",
    name: "Messaging",
    summary: "Write messages that are easy to answer.",
    behaviours: [
      "Puts the ask in the first line",
      "Keeps it to one topic",
      "Gives enough context to reply without a follow-up",
    ],
    baseDifficulty: 2,
    contexts: ["work", "study", "social", "online"],
  },
  {
    id: "dig.group-chats",
    name: "Group chats",
    summary: "Contribute to a group chat without dominating or disappearing.",
    behaviours: [
      "Replies to others' messages, not only their own threads",
      "Keeps rapid-fire single-word messages batched into one",
      "Takes side conversations to a direct message",
    ],
    baseDifficulty: 3,
    contexts: ["work", "study", "social", "online"],
  },
  {
    id: "dig.tone",
    name: "Tone in writing",
    summary: "Compensate for missing tone so text is not read as cold or sharp.",
    behaviours: [
      "Adds a short warm opener where the message is a request",
      "Re-reads for how the worst-case reader would take it",
      "Uses a question rather than a bare correction",
    ],
    baseDifficulty: 3,
    contexts: ["work", "study", "online"],
  },
  {
    id: "dig.length",
    name: "Appropriate response length",
    summary: "Match message length to the other person's and to the medium.",
    behaviours: [
      "Keeps replies within roughly the length they wrote",
      "Splits a long message into a call or a document",
      "Answers the question before adding context",
    ],
    baseDifficulty: 2,
    contexts: ["work", "study", "social", "online"],
  },
  {
    id: "dig.invitations",
    name: "Digital invitations",
    summary: "Make plans over text that actually convert into meeting.",
    behaviours: [
      "Proposes two concrete options",
      "Confirms the day before",
      "Closes the loop rather than leaving it open-ended",
    ],
    baseDifficulty: 3,
    contexts: ["social", "online"],
  },
  {
    id: "dig.follow-ups",
    name: "Follow-ups",
    summary: "Follow up once, usefully, after an unanswered message.",
    behaviours: [
      "Waits an appropriate interval",
      "Adds new information rather than repeating",
      "Stops after one follow-up",
    ],
    baseDifficulty: 3,
    contexts: ["work", "study", "online"],
  },
  {
    id: "dig.volume",
    name: "Avoiding excessive messaging",
    summary: "Keep message volume proportionate to the relationship.",
    behaviours: [
      "Waits for a reply before sending again",
      "Batches thoughts into one message",
      "Notices asymmetry in message counts",
    ],
    baseDifficulty: 3,
    contexts: ["social", "online"],
  },
  {
    id: "dig.boundaries",
    name: "Digital boundaries",
    summary: "Set and respect expectations about availability.",
    behaviours: [
      "States their response window rather than replying instantly",
      "Does not expect immediate replies from others",
      "Moves urgent matters to the right channel",
    ],
    baseDifficulty: 3,
    contexts: ["work", "study", "online"],
  },
]);

const LEADERSHIP = domainSkills("leadership", [
  {
    id: "lead.initiative",
    name: "Leadership initiative",
    summary: "Step into the gap when a group needs someone to start.",
    behaviours: [
      "Proposes a first step when the group stalls",
      "Volunteers for a specific piece of work",
      "Names the decision that needs making",
    ],
    baseDifficulty: 4,
    contexts: ["work", "study"],
  },
  {
    id: "lead.clarity",
    name: "Clear communication",
    summary: "Say what you mean once, in the order the listener needs it.",
    behaviours: [
      "Leads with the conclusion",
      "States what they need from whom",
      "Checks understanding rather than assuming it",
    ],
    baseDifficulty: 4,
    contexts: ["work", "study"],
  },
  {
    id: "lead.delegation",
    name: "Delegation",
    summary: "Hand over work with the context and authority to do it.",
    behaviours: [
      "States the outcome, not the keystrokes",
      "Names the deadline and the decision rights",
      "Checks in once rather than hovering",
    ],
    baseDifficulty: 5,
    contexts: ["work", "study"],
  },
  {
    id: "lead.facilitation",
    name: "Facilitation",
    summary: "Run a discussion so the group reaches a decision.",
    behaviours: [
      "Sets the purpose at the start",
      "Keeps time and names the remaining question",
      "Ends with a decision and an owner",
    ],
    baseDifficulty: 5,
    contexts: ["work", "study"],
  },
  {
    id: "lead.encouragement",
    name: "Encouragement",
    summary: "Recognise specific contributions in a way that is credible.",
    behaviours: [
      "Names the specific action, not the person's character",
      "Says it near the time",
      "Says it where it counts",
    ],
    baseDifficulty: 3,
    contexts: ["work", "study", "social", "family"],
  },
  {
    id: "lead.constructive-feedback",
    name: "Constructive feedback",
    summary: "Give developmental feedback that the person can act on.",
    behaviours: [
      "Asks for their read first",
      "Gives one thing to change, with an example",
      "Agrees a concrete next step",
    ],
    baseDifficulty: 5,
    contexts: ["work", "study"],
  },
  {
    id: "lead.decisions",
    name: "Decision communication",
    summary: "Announce a decision with its reasoning and its implications.",
    behaviours: [
      "States the decision plainly",
      "Gives the reason and what was traded off",
      "Says what happens next and by when",
    ],
    baseDifficulty: 4,
    contexts: ["work", "study"],
  },
]);

export const SKILLS: Skill[] = [
  ...CONVERSATION,
  ...CONFIDENCE,
  ...NON_VERBAL,
  ...RELATIONSHIPS,
  ...ASSERTIVENESS,
  ...EMPATHY,
  ...GROUP,
  ...DIFFICULT,
  ...DIGITAL,
  ...LEADERSHIP,
];

/**
 * Dependencies. Each edge answers "what makes this hard if you cannot do the
 * other thing yet?" — the rationale is shown to the user verbatim.
 */
export const SKILL_DEPENDENCIES: SkillDependency[] = [
  { skill: "conv.follow-up", requires: "conv.open-questions", minMastery: 0.35, rationale: "A follow-up needs somewhere to go; closed questions rarely leave an opening." },
  { skill: "conv.follow-up", requires: "conv.active-listening", minMastery: 0.3, rationale: "You can only follow up on a detail you actually took in." },
  { skill: "conv.balance", requires: "conv.open-questions", minMastery: 0.3, rationale: "Handing the floor back usually means asking something." },
  { skill: "conv.transitions", requires: "conv.follow-up", minMastery: 0.4, rationale: "Bridging topics means noticing the current one has run out — the same attention follow-ups need." },
  { skill: "conv.storytelling", requires: "conv.balance", minMastery: 0.4, rationale: "Stories run long; without a sense of balance they turn into monologues." },
  { skill: "conv.humour", requires: "conv.balance", minMastery: 0.4, rationale: "Humour depends on reading the room, which starts with tracking the exchange." },
  { skill: "conv.silence", requires: "conv.active-listening", minMastery: 0.35, rationale: "Silence is comfortable when you are still listening rather than scrambling." },
  { skill: "conv.ending", requires: "conv.start", minMastery: 0.35, rationale: "Endings are easier once openings feel routine." },

  { skill: "conf.groups", requires: "conf.opinions", minMastery: 0.35, rationale: "Group contribution usually means stating a view without an invitation." },
  { skill: "conf.joining", requires: "conv.start", minMastery: 0.4, rationale: "Joining a group is starting a conversation with more people watching." },
  { skill: "conf.opinions", requires: "conf.speaking-clearly", minMastery: 0.3, rationale: "An opinion that is not audible does not land as one." },
  { skill: "conf.recovery", requires: "conf.nervousness", minMastery: 0.35, rationale: "Recovering in the moment is easier when nerves are already survivable." },

  { skill: "nv.variation", requires: "nv.vocal-clarity", minMastery: 0.4, rationale: "Vary a voice that is already clear, or variation just adds noise." },
  { skill: "nv.pace", requires: "conf.speaking-clearly", minMastery: 0.3, rationale: "Pace control assumes you are finishing your sentences." },

  { skill: "rel.friendship", requires: "rel.invitations", minMastery: 0.4, rationale: "Friendships form through repeated meeting, which needs someone to invite." },
  { skill: "rel.friendship", requires: "conv.remembering", minMastery: 0.35, rationale: "Continuity is what turns acquaintances into friends." },
  { skill: "rel.invitations", requires: "conf.initiative", minMastery: 0.35, rationale: "An invitation is initiative with a date attached." },
  { skill: "rel.support", requires: "emp.validation", minMastery: 0.4, rationale: "Support lands only after the person feels their reaction was reasonable." },
  { skill: "rel.reciprocity", requires: "rel.contact", minMastery: 0.35, rationale: "You can only balance an exchange you are actually part of." },

  { skill: "asrt.boundaries", requires: "asrt.no", minMastery: 0.4, rationale: "A boundary is a no that has to survive being repeated." },
  { skill: "asrt.pressure", requires: "asrt.boundaries", minMastery: 0.45, rationale: "Holding under pressure is holding a boundary that is being pushed." },
  { skill: "asrt.disagree", requires: "conf.opinions", minMastery: 0.4, rationale: "You cannot disagree until you can state a view as your own." },
  { skill: "asrt.disagree", requires: "conv.active-listening", minMastery: 0.35, rationale: "Restating their point before differing is what keeps it respectful." },
  { skill: "asrt.feedback", requires: "asrt.requests", minMastery: 0.4, rationale: "Feedback that changes anything ends in a request." },
  { skill: "asrt.criticism", requires: "emp.perspective", minMastery: 0.35, rationale: "Hearing criticism means holding their view alongside yours." },

  { skill: "emp.validation", requires: "emp.recognition", minMastery: 0.35, rationale: "You validate a feeling you have first noticed." },
  { skill: "emp.responses", requires: "emp.validation", minMastery: 0.4, rationale: "The right response follows from acknowledging the feeling first." },
  { skill: "emp.hold-off-solving", requires: "emp.validation", minMastery: 0.4, rationale: "Waiting to solve is only bearable when you have something else to offer — acknowledgement." },
  { skill: "emp.recognition", requires: "conv.active-listening", minMastery: 0.3, rationale: "Feelings are mostly named in what people say; you have to be listening for it." },

  { skill: "grp.contributing", requires: "conf.groups", minMastery: 0.4, rationale: "Finding openings assumes you are willing to take one." },
  { skill: "grp.joining", requires: "conf.joining", minMastery: 0.4, rationale: "The group version needs the one-to-one version to be routine first." },
  { skill: "grp.include", requires: "grp.contributing", minMastery: 0.4, rationale: "Making room for others is easier once your own contribution is not the effort." },
  { skill: "grp.facilitate", requires: "grp.include", minMastery: 0.45, rationale: "Facilitation is including people, deliberately and repeatedly." },
  { skill: "grp.leadership", requires: "grp.facilitate", minMastery: 0.5, rationale: "Leading a group means facilitating it and then owning the outcome." },
  { skill: "grp.recover-interrupt", requires: "conf.recovery", minMastery: 0.35, rationale: "Reclaiming the floor is a specific case of recovering in public." },

  { skill: "diff.conflict", requires: "asrt.disagree", minMastery: 0.45, rationale: "Resolution starts with being able to disagree without escalating." },
  { skill: "diff.conflict", requires: "emp.perspective", minMastery: 0.4, rationale: "Shared interests are invisible until you can see the other side's." },
  { skill: "diff.criticism", requires: "asrt.criticism", minMastery: 0.45, rationale: "In public it is the same skill with less time to think." },
  { skill: "diff.rejection", requires: "conf.recovery", minMastery: 0.35, rationale: "A no is an awkward moment you have to stay present for." },
  { skill: "diff.breakdown", requires: "diff.misunderstanding", minMastery: 0.4, rationale: "A breakdown is a misunderstanding that repeated attempts have not fixed." },
  { skill: "diff.apologising", requires: "emp.recognition", minMastery: 0.3, rationale: "An apology has to name the effect, which means noticing it." },

  { skill: "dig.tone", requires: "dig.messaging", minMastery: 0.35, rationale: "Tone work assumes the message itself is clear." },
  { skill: "dig.group-chats", requires: "dig.messaging", minMastery: 0.35, rationale: "Group chats are messaging with an audience." },
  { skill: "dig.invitations", requires: "rel.invitations", minMastery: 0.35, rationale: "The text version inherits everything from the in-person one." },
  { skill: "dig.follow-ups", requires: "dig.messaging", minMastery: 0.35, rationale: "A follow-up is judged as a message first." },

  { skill: "lead.clarity", requires: "conf.opinions", minMastery: 0.4, rationale: "Leading with a conclusion means being willing to state one." },
  { skill: "lead.facilitation", requires: "grp.facilitate", minMastery: 0.5, rationale: "Same skill, higher stakes and a required outcome." },
  { skill: "lead.delegation", requires: "asrt.requests", minMastery: 0.45, rationale: "Delegation is a request with authority attached." },
  { skill: "lead.constructive-feedback", requires: "asrt.feedback", minMastery: 0.5, rationale: "Developmental feedback is the general skill applied over time." },
  { skill: "lead.decisions", requires: "lead.clarity", minMastery: 0.45, rationale: "A decision that is not communicated clearly is not a decision." },
  { skill: "lead.initiative", requires: "conf.initiative", minMastery: 0.4, rationale: "Leading starts as the ordinary habit of going first." },
];

const BY_ID = new Map<Id, Skill>(SKILLS.map((skill) => [skill.id, skill]));

const REQUIREMENTS = new Map<Id, SkillDependency[]>();
const DEPENDENTS = new Map<Id, SkillDependency[]>();
for (const dep of SKILL_DEPENDENCIES) {
  const reqs = REQUIREMENTS.get(dep.skill) ?? [];
  reqs.push(dep);
  REQUIREMENTS.set(dep.skill, reqs);
  const deps = DEPENDENTS.get(dep.requires) ?? [];
  deps.push(dep);
  DEPENDENTS.set(dep.requires, deps);
}

export function getSkill(id: Id): Skill | undefined {
  return BY_ID.get(id);
}

export function requireSkill(id: Id): Skill {
  const skill = BY_ID.get(id);
  if (!skill) throw new Error(`Unknown skill: ${id}`);
  return skill;
}

export function skillsInDomain(domain: SkillDomain): Skill[] {
  return SKILLS.filter((skill) => skill.domain === domain);
}

/** Direct prerequisites of a skill. */
export function prerequisitesOf(id: Id): SkillDependency[] {
  return REQUIREMENTS.get(id) ?? [];
}

/** Skills that become easier once `id` improves. */
export function dependentsOf(id: Id): SkillDependency[] {
  return DEPENDENTS.get(id) ?? [];
}

/**
 * Prerequisites not yet at their threshold, deepest first. The recommender uses
 * this to route a user who wants "conflict resolution" to "disagreeing
 * respectfully" — while still letting them practise conflict if they insist.
 */
export function unmetPrerequisites(id: Id, mastery: (skillId: Id) => number, seen = new Set<Id>()): SkillDependency[] {
  if (seen.has(id)) return [];
  seen.add(id);
  const unmet: SkillDependency[] = [];
  for (const dep of prerequisitesOf(id)) {
    if (mastery(dep.requires) < dep.minMastery) {
      unmet.push(...unmetPrerequisites(dep.requires, mastery, seen));
      unmet.push(dep);
    }
  }
  // De-duplicate while keeping deepest-first order.
  const out: SkillDependency[] = [];
  const keys = new Set<string>();
  for (const dep of unmet) {
    const key = `${dep.skill}->${dep.requires}`;
    if (keys.has(key)) continue;
    keys.add(key);
    out.push(dep);
  }
  return out;
}

/** All skills reachable as prerequisites, transitively. Used for graph validation. */
export function transitivePrerequisites(id: Id, seen = new Set<Id>()): Id[] {
  for (const dep of prerequisitesOf(id)) {
    if (seen.has(dep.requires)) continue;
    seen.add(dep.requires);
    transitivePrerequisites(dep.requires, seen);
  }
  return [...seen];
}

/** True when the dependency graph has no cycles. Asserted by tests and the content validator. */
export function graphIsAcyclic(): boolean {
  const state = new Map<Id, "visiting" | "done">();
  const visit = (id: Id): boolean => {
    const current = state.get(id);
    if (current === "done") return true;
    if (current === "visiting") return false;
    state.set(id, "visiting");
    for (const dep of prerequisitesOf(id)) {
      if (!visit(dep.requires)) return false;
    }
    state.set(id, "done");
    return true;
  };
  return SKILLS.every((skill) => visit(skill.id));
}

/** Depth in the graph: 0 for foundational skills, higher for skills that build on others. */
export function skillDepth(id: Id, seen = new Set<Id>()): number {
  if (seen.has(id)) return 0;
  seen.add(id);
  const reqs = prerequisitesOf(id);
  if (reqs.length === 0) return 0;
  return 1 + Math.max(...reqs.map((dep) => skillDepth(dep.requires, new Set(seen))));
}

export const DOMAIN_LABELS: Record<SkillDomain, string> = {
  conversation: "Conversation",
  confidence: "Confidence",
  "non-verbal": "Non-verbal",
  relationships: "Relationships",
  assertiveness: "Assertiveness",
  empathy: "Empathy",
  group: "Group communication",
  difficult: "Difficult situations",
  digital: "Digital communication",
  leadership: "Leadership",
};

export const ALL_DOMAINS = SKILL_DOMAINS;
