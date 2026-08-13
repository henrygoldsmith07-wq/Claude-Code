import { requireSkill } from "./skills";
import type { Id, Lesson, LessonSource } from "./types";

// ---------------------------------------------------------------------------
// Micro-lessons.
//
// Each is one to three minutes and teaches a principle plus its failure mode.
// The `commonMistake` field is not decoration: for most of these skills the
// mistake is the more useful half of the lesson, because people usually know
// roughly what to do and are doing a specific thing that undoes it.
//
// Claims that lean on research carry source metadata with an explicit strength
// rating, so a reader can tell "robust finding" from "what practitioners
// generally agree on". Where the honest answer is the latter, it says so.
// Nothing here is presented as a script to memorise; scripts are what the
// product is trying to make unnecessary.
// ---------------------------------------------------------------------------

const SOURCE_ACTIVE_LISTENING: LessonSource = {
  citation: "Rogers & Farson (1957), Active Listening",
  claim: "Reflecting a speaker's meaning back to them increases the speaker's sense of being understood.",
  strength: "moderate",
};

const SOURCE_QUESTION_ASKING: LessonSource = {
  citation: "Huang, Yeomans, Brooks, Minson & Gino (2017), 'It doesn't hurt to ask', JPSP",
  claim: "In getting-acquainted conversations, people who asked more questions — particularly follow-up questions — were better liked.",
  strength: "moderate",
  url: "https://doi.org/10.1037/pspi0000097",
};

const SOURCE_DISCLOSURE: LessonSource = {
  citation: "Sprecher, Treger & Wondra (2013), Journal of Experimental Social Psychology",
  claim: "Reciprocal turn-taking in self-disclosure produces more liking than one-sided disclosure.",
  strength: "moderate",
};

const SOURCE_EXPOSURE: LessonSource = {
  citation: "Clark & Wells (1995) cognitive model of social anxiety; exposure literature",
  claim: "Approaching feared social situations, rather than avoiding or over-preparing, is what reduces anticipatory anxiety over time.",
  strength: "strong",
};

const SOURCE_SPOTLIGHT: LessonSource = {
  citation: "Gilovich, Medvec & Savitsky (2000), 'The spotlight effect', JPSP",
  claim: "People systematically overestimate how much others notice their appearance and mistakes.",
  strength: "strong",
  url: "https://doi.org/10.1037/0022-3514.78.2.211",
};

const SOURCE_LIKING_GAP: LessonSource = {
  citation: "Boothby, Cooney, Sandstrom & Clark (2018), 'The liking gap in conversations', Psychological Science",
  claim: "After a conversation, people underestimate how much their partner liked them.",
  strength: "moderate",
  url: "https://doi.org/10.1177/0956797618783714",
};

const SOURCE_DEEP_TALK: LessonSource = {
  citation: "Kardas, Kumar & Epley (2022), 'Overly shallow?', JPSP",
  claim: "People expect deeper conversations to be more awkward than they turn out to be, and so default to small talk longer than necessary.",
  strength: "moderate",
};

const SOURCE_ASSERTIVENESS: LessonSource = {
  citation: "Standard assertiveness training protocols (behavioural rehearsal + broken record)",
  claim: "Repeating a clear limit calmly, rather than escalating justification, is the technique most consistently taught for holding a boundary.",
  strength: "practitioner-consensus",
};

const SOURCE_FEEDBACK: LessonSource = {
  citation: "Center for Creative Leadership, Situation–Behavior–Impact model",
  claim: "Feedback framed as situation, observable behaviour and impact is easier to act on than trait-based feedback.",
  strength: "practitioner-consensus",
};

const SOURCE_REPAIR: LessonSource = {
  citation: "Gottman & Levenson (1999), conflict repair research",
  claim: "Attempts to de-escalate during conflict predict relationship outcomes better than the absence of conflict.",
  strength: "moderate",
};

const SOURCE_SUPPORT: LessonSource = {
  citation: "Burleson (2003), supportive communication research",
  claim: "Support that acknowledges the other person's feelings before offering solutions is rated as more helpful than immediate advice.",
  strength: "moderate",
};

const SOURCE_PACE: LessonSource = {
  citation: "Speech rate norms in conversational English (~140–160 wpm)",
  claim: "Conversational speech typically runs around 140–160 words per minute; markedly faster speech reduces listener comprehension.",
  strength: "moderate",
};

function lesson(
  skillId: Id,
  fields: Omit<Lesson, "id" | "skillId" | "version" | "estimatedMinutes"> & { estimatedMinutes?: number },
): Lesson {
  return {
    id: `lesson.${skillId}`,
    skillId,
    version: 1,
    estimatedMinutes: fields.estimatedMinutes ?? 2,
    ...fields,
  };
}

export const LESSONS: Lesson[] = [
  lesson("conv.start", {
    title: "Openers are about the situation, not about you",
    concept:
      "A conversation opener does not need to be interesting. It needs to be easy to answer. Comment on something you and the other person are both currently experiencing — the queue, the room, the task — and ask something small about it.",
    whyItMatters:
      "Most people who struggle to start conversations are not short of things to say; they are searching for something good enough. Lowering the bar from 'interesting' to 'easy to answer' removes the search.",
    example:
      "At a work event: \"This is my first one of these — have you been before?\" The content is unremarkable, which is the point: it costs the other person nothing to reply.",
    practice:
      "Today, open once using only what is physically in front of you. No preparation, no cleverness. Notice that the reply arrives anyway.",
    commonMistake:
      "Rehearsing an opener until the moment passes. The window for a situational remark is about ten seconds wide, and a rehearsed line usually arrives after it has closed.",
    realWorldApplication:
      "Shops, lifts, gym, kitchen at work, waiting for anything. These are low-stakes precisely because neither of you expected a conversation.",
    sources: [SOURCE_EXPOSURE, SOURCE_SPOTLIGHT, SOURCE_DEEP_TALK],
  }),

  lesson("conv.open-questions", {
    title: "Give the other person somewhere to go",
    concept:
      "A closed question asks for a fact. An open question asks for an experience, a reason or a choice, which gives the other person material to expand on. Swap 'Did you like it?' for 'What did you make of it?'",
    whyItMatters:
      "Closed questions produce one-word answers, and one-word answers put the entire burden of the conversation back on you within seconds. Open questions distribute the work.",
    example:
      "Closed: \"Busy weekend?\" — \"Yeah.\" Open: \"What did you end up doing at the weekend?\" — now there is something to follow.",
    practice:
      "Take three questions you asked yesterday and rewrite each as a how, what or which question.",
    commonMistake:
      "Stacking two questions together — \"What did you do, did you go away?\" The second one narrows the first and you get the closed answer anyway.",
    realWorldApplication:
      "Any first conversation, any check-in with a colleague, and any moment where a conversation feels like an interview.",
    sources: [SOURCE_QUESTION_ASKING],
  }),

  lesson("conv.follow-up", {
    title: "Listen, pick a detail, explore it",
    concept:
      "The sequence is: listen for a specific detail, ask about that detail, and only then relate something of your own if it genuinely fits. Most conversations die because the reply changes subject rather than going deeper.",
    whyItMatters:
      "Follow-up questions are the single most reliable move for keeping a conversation alive, and they are the clearest signal that someone was actually listening rather than waiting to speak.",
    example:
      "\"We drove up to the coast.\" A topic change: \"Nice — I went to Spain last year.\" A follow-up: \"What made you pick the coast?\" The second keeps them talking; the first hands the floor back to you.",
    practice:
      "In the next conversation, ask one follow-up before offering anything about yourself. One is enough — this is not an interrogation.",
    commonMistake:
      "Two or three follow-ups in a row with nothing offered back. That flips a conversation into questioning, which is uncomfortable in the other direction.",
    realWorldApplication:
      "Especially useful with people who give short answers: the detail you need is almost always in the sentence they just said.",
    sources: [SOURCE_QUESTION_ASKING, SOURCE_DISCLOSURE],
  }),

  lesson("conv.active-listening", {
    title: "Show the message landed before adding your own",
    concept:
      "Before responding, say in your own words what you understood — briefly. Not parroting, not analysing. One clause is usually enough: \"So the deadline moved and nobody told you.\"",
    whyItMatters:
      "It gives the speaker evidence that they were understood, and it gives you a checkpoint. When the reflection is slightly wrong, they correct it and you learn what they actually meant.",
    example:
      "\"I've been going in early all week to get ahead of it.\" — \"So you're eating into your own time to stay on top of it.\" That single sentence usually produces more than a question would.",
    practice:
      "Reflect once per conversation today, then stop and let them continue. Resist adding advice.",
    commonMistake:
      "Reflecting and then immediately pivoting to your own comparable story. The reflection then reads as a formality on the way to your turn.",
    realWorldApplication:
      "Highest value when someone is frustrated, and in any conversation where you notice yourself planning your reply.",
    sources: [SOURCE_ACTIVE_LISTENING],
  }),

  lesson("conv.balance", {
    title: "Track the ratio, not the content",
    concept:
      "Aim for roughly even speaking time over the whole exchange, not turn by turn. If you have held the floor for two or three turns, close with a question. If they have, offer something of your own rather than another question.",
    whyItMatters:
      "Conversations fail in both directions. Dominating leaves the other person unheard; asking constantly without offering anything turns into an interview and makes you unknowable.",
    example:
      "After a two-minute story: \"…anyway, that was my week. What's yours been like?\" The handover is one sentence and it resets the balance.",
    practice:
      "In your next conversation, estimate your share of the talking afterwards. Just the estimate — no adjustment during.",
    commonMistake:
      "Correcting mid-sentence when you notice you have been talking. Finish the thought, then hand over; the abrupt stop is more awkward than the imbalance.",
    realWorldApplication:
      "Especially in conversations with quiet people, where the silence pulls you into filling all of it.",
    sources: [SOURCE_DISCLOSURE],
  }),

  lesson("conv.silence", {
    title: "A pause is not a failure",
    concept:
      "Two to three seconds of silence in conversation is normal and is usually experienced by the other person as thinking time. Let it sit, stay physically settled, and if you fill it, fill it with a question rather than an apology.",
    whyItMatters:
      "Rushing to fill pauses produces the exact behaviour that makes conversations feel effortful — over-talking, abrupt topic changes, nervous filler. The pause itself was never the problem.",
    example:
      "Silence lands. Instead of \"sorry, I'm not very good at this\", you wait, and they say the thing they were assembling.",
    practice:
      "Count to three in one pause today before speaking. Notice what the other person does with those three seconds.",
    commonMistake:
      "Reading a pause as evidence that the conversation is failing, and leaving. Pauses are common in conversations both people enjoyed.",
    realWorldApplication:
      "In one-to-one conversations with people who think before speaking, waiting is often the entire skill.",
    sources: [SOURCE_SPOTLIGHT, SOURCE_LIKING_GAP],
  }),

  lesson("conv.transitions", {
    title: "Build a bridge before you change topic",
    concept:
      "Signal the move and connect it to what was just said: \"That reminds me…\", \"On the subject of the move…\". A visible bridge makes the change feel like continuation rather than dismissal.",
    whyItMatters:
      "An unsignalled topic change reads as 'I was not interested in that', even when you were. The bridge costs four words and removes the misreading.",
    example:
      "\"…so we're still waiting on the builders.\" — \"Sounds slow. Speaking of waiting — did you ever hear back about the job?\"",
    practice:
      "Notice one topic ending today and bridge it deliberately rather than letting the conversation drop.",
    commonMistake:
      "Changing topic while the other person is still mid-thought. Wait for the close of the thought — the falling tone at the end of a sentence.",
    realWorldApplication:
      "Group conversations, where topics change constantly and an unsignalled jump is more visible.",
    sources: [],
  }),

  lesson("conv.storytelling", {
    title: "Situation, turn, point — and stop",
    concept:
      "A conversational story is three parts: where you were, what changed, and why you are telling it. Under a minute unless invited to continue. Land on the point rather than trailing into details.",
    whyItMatters:
      "Most anecdotes that lose a room lose it in the setup. Compressing the situation to one sentence buys you the attention to deliver the rest.",
    example:
      "\"I got on the wrong train on my first day. Ended up two counties away and rang in from a car park. Turned out my new boss had done exactly the same thing.\"",
    practice:
      "Take a story you tell often and cut the setup to a single sentence.",
    commonMistake:
      "Correcting irrelevant details mid-story ('it was Tuesday — no, Wednesday'). Precision costs momentum and nobody is checking.",
    realWorldApplication:
      "Useful in groups, where you need to earn a longer turn quickly, and in interviews.",
    sources: [],
  }),

  lesson("conf.initiative", {
    title: "Go first, small",
    concept:
      "Initiative is a habit built from tiny instances: greeting first, suggesting the specific café, sending the first message. The size of the action matters far less than being the one who acts.",
    whyItMatters:
      "Waiting is self-reinforcing — the longer you wait, the more significance the act acquires, and the harder it becomes. Small frequent initiations keep the cost low.",
    example:
      "Instead of \"we should get coffee some time\", say \"are you free Thursday?\" The second is only slightly harder to say and vastly more likely to happen.",
    practice:
      "Greet three people first today. That is the whole exercise.",
    commonMistake:
      "Waiting for confidence before acting. Confidence follows the action, not the other way round — which is why the app measures the action.",
    realWorldApplication:
      "Any recurring setting where you already see the same people: the same office, class or gym.",
    sources: [SOURCE_EXPOSURE],
  }),

  lesson("conf.opinions", {
    title: "Own it, give one reason, stop",
    concept:
      "State the view as yours — \"I think\" rather than \"people say\" — add one reason, and stop. The pause afterwards is what invites a real conversation.",
    whyItMatters:
      "Over-hedging makes a view impossible to engage with. If nobody can tell what you think, nobody can agree with you either.",
    example:
      "\"I think we should cut the second feature — we'd hit the date without it.\" Twelve words, a position and a reason.",
    practice:
      "Say one opinion today without a hedge in front of it. Watch what happens: usually nothing dramatic.",
    commonMistake:
      "Retracting at the first sign of disagreement. Disagreement is not disapproval; hold the view for at least one exchange.",
    realWorldApplication:
      "Meetings, group plans, and any conversation where you have been quietly deferring by default.",
    sources: [],
  }),

  lesson("conf.nervousness", {
    title: "Act nervous rather than waiting to feel calm",
    concept:
      "Nervousness before a social situation is not a signal to wait. Arrive early, have one opener ready, and speak within the first few minutes — speaking early is what settles the nerves, not the reverse.",
    whyItMatters:
      "Avoidance and over-preparation both keep anticipatory anxiety intact. Approaching the situation is the mechanism by which it decreases, and the effect compounds over repetitions.",
    example:
      "You arrive at an event feeling sick about it. You say one thing to one person in the first three minutes. Twenty minutes later the feeling is gone, and it is gone because you spoke, not because you waited.",
    practice:
      "In the next situation you dread, set a rule: speak once in the first five minutes, regardless of how you feel.",
    commonMistake:
      "Scanning yourself for signs of nervousness while talking. Attention spent monitoring yourself is attention not spent on the other person, and it makes conversation harder.",
    realWorldApplication:
      "Events, first days, presentations, any recurring situation you have been quietly avoiding.",
    sources: [SOURCE_EXPOSURE, SOURCE_SPOTLIGHT],
  }),

  lesson("conf.groups", {
    title: "Speak early, briefly",
    concept:
      "In a group, the cost of contributing rises the longer you stay silent. Say something in the first ten minutes — agreeing with a point and adding one sentence is enough.",
    whyItMatters:
      "The first contribution is the expensive one. After it, you are a participant rather than an observer, and further contributions cost almost nothing.",
    example:
      "\"I agree with what Sam said about the timeline — I'd add that the testing window is the tight part.\" That is a full contribution.",
    practice:
      "In your next meeting or group, contribute once in the first ten minutes. Do not wait for a strong point.",
    commonMistake:
      "Holding out for a contribution worth the silence you have accumulated. The bar rises with every minute you wait; break it early while it is low.",
    realWorldApplication:
      "Meetings, seminars, group projects, any recurring group where you tend to be the quiet one.",
    sources: [SOURCE_SPOTLIGHT],
  }),

  lesson("conf.joining", {
    title: "Listen in, then enter on the topic in play",
    concept:
      "Stand at the edge of the group, orient towards the speaker and listen for ten or twenty seconds. Enter on the topic already running — a short reaction or a question about what was just said.",
    whyItMatters:
      "Groups reject entries that reset the conversation, not entries from strangers. Joining the topic makes you a participant; changing it makes you an interruption.",
    example:
      "They are discussing a delayed project. You: \"Is this the one that got pushed to spring?\" You are in, and you have contributed information rather than requested attention.",
    practice:
      "Approach one group today and listen for twenty seconds before saying anything.",
    commonMistake:
      "Opening with an apology or an introduction — \"sorry, can I join?\" It makes the entry an event and puts the group in the position of granting permission.",
    realWorldApplication:
      "Office kitchens, parties, conferences, anywhere conversations are already running when you arrive.",
    sources: [],
  }),

  lesson("conf.recovery", {
    title: "Acknowledge in four words and continue",
    concept:
      "After a stumble — a joke that missed, a name forgotten, a sentence that came out wrong — name it briefly if at all, and carry on speaking. The recovery is continuing, not explaining.",
    whyItMatters:
      "Others notice far less than you assume, and remember less still. The over-explanation is usually what makes the moment memorable to everyone else.",
    example:
      "You blank on a name. \"Sorry — name's gone. Remind me?\" Then straight back to the conversation. Total cost: three seconds.",
    practice:
      "Next time something lands awkwardly, stay in the conversation for at least two more turns before you allow yourself to leave.",
    commonMistake:
      "Leaving immediately after an awkward moment. It converts a forgettable moment into the memorable end of the interaction — and teaches you that awkwardness is unsurvivable.",
    realWorldApplication:
      "Everywhere. This is the skill that determines whether one bad moment costs you an evening.",
    sources: [SOURCE_SPOTLIGHT, SOURCE_LIKING_GAP],
  }),

  lesson("nv.pace", {
    title: "Slow down at the part that matters",
    concept:
      "Conversational English runs around 140–160 words per minute. Nerves push people well above it. Rather than trying to slow everything, slow deliberately for the one sentence carrying your point, and pause after it.",
    whyItMatters:
      "Uniform fast speech flattens meaning: a listener cannot tell which part was important. A single deliberate slowdown does the work of several minutes of general pace control.",
    example:
      "\"…so we looked at three options, ran the numbers, tried the second one. [pause] It cut the time in half.\"",
    practice:
      "Record thirty seconds of yourself explaining something and check where you sped up. It is usually the important part.",
    commonMistake:
      "Trying to slow down globally, which produces a monotone. Variation is what carries meaning.",
    realWorldApplication:
      "Presentations, interviews, explaining something technical to a non-specialist.",
    sources: [SOURCE_PACE],
  }),

  lesson("nv.eye-contact", {
    title: "A pattern, not a stare",
    concept:
      "Comfortable eye contact is intermittent: look while they speak, break away naturally while you think, return at the end of your turn. There is no correct percentage.",
    whyItMatters:
      "People who have been told to 'make more eye contact' often over-correct into a stare, which reads as intensity rather than attention. The pattern matters more than the amount.",
    example:
      "They ask a question. You look away briefly as you assemble the answer, then look back as you deliver it. That looks like thinking, because it is.",
    practice:
      "Focus only on looking back at the end of your sentences today. Ignore the rest.",
    commonMistake:
      "Counting seconds. Monitoring your own eye contact takes attention away from what is being said, which listeners notice more than gaze.",
    realWorldApplication:
      "One-to-one conversations, and interviews where the temptation to over-perform attention is strongest.",
    sources: [],
  }),

  lesson("asrt.no", {
    title: "No in the first sentence, warmth in the second",
    concept:
      "Lead with the decline, then add at most one reason. \"I can't take that on this week\" — then stop. Warmth comes from tone and from what you offer next, not from the length of the justification.",
    whyItMatters:
      "A long build-up before a no invites negotiation of every clause. Deciding first and explaining briefly gives the other person a clear answer they can plan around.",
    example:
      "\"I can't do Saturday — I'm away. Hope it goes well.\" Nine words, complete, and not unkind.",
    practice:
      "Say one no this week with exactly one reason attached. Notice that the relationship survives.",
    commonMistake:
      "Stacking reasons. Three justifications sound less certain than one, and each is a door for the other person to open.",
    realWorldApplication:
      "Requests at work, favours, invitations you do not want, anything where you usually say yes and regret it.",
    sources: [SOURCE_ASSERTIVENESS],
  }),

  lesson("asrt.boundaries", {
    title: "Say the limit once, then repeat it unchanged",
    concept:
      "State the specific behaviour and the specific limit. If it is pushed, repeat the same sentence calmly rather than adding new arguments. Consistency, not volume or novelty, is what holds a boundary.",
    whyItMatters:
      "Every new justification is a new thing to argue with. Repeating the same limit gives the other person nothing to attack and signals that the answer is not a negotiating position.",
    example:
      "\"I'm not available after six.\" — \"But it's only twenty minutes.\" — \"I'm not available after six. I can look first thing.\"",
    practice:
      "Write the one sentence for a boundary you are struggling with. Keep it under fifteen words and use it twice.",
    commonMistake:
      "Escalating tone instead of repeating content. Calm repetition holds; volume invites a fight.",
    realWorldApplication:
      "Work hours, family expectations, favours that have become assumptions.",
    sources: [SOURCE_ASSERTIVENESS],
  }),

  lesson("asrt.disagree", {
    title: "Restate their point before you differ",
    concept:
      "Show you understood the position, then name the specific thing you see differently. \"So the case is that we'd lose momentum. I think the risk is the other way, because…\"",
    whyItMatters:
      "Disagreement that arrives without a restatement is heard as dismissal. Restating first makes the disagreement about the point rather than about being ignored.",
    example:
      "\"You're saying we ship now and fix later. I'd rather hold a week — the support cost of shipping broken is the thing I'm weighing.\"",
    practice:
      "Next time you disagree, restate their position in one sentence first. Their reaction to the disagreement changes noticeably.",
    commonMistake:
      "'I hear you, but' — a restatement in form only. If the restatement contains no specific content from what they said, it does not work.",
    realWorldApplication:
      "Meetings, plans with friends, family decisions, anywhere you have been agreeing to avoid friction.",
    sources: [SOURCE_REPAIR],
  }),

  lesson("asrt.criticism", {
    title: "Ask for the example before you respond",
    concept:
      "When criticised, ask one clarifying question — \"can you give me an example?\" — before agreeing or defending. It buys time, and it usually converts a vague judgement into something actionable.",
    whyItMatters:
      "Most immediate responses to criticism are defences of things that were not actually being said. The clarifying question prevents an argument about a misunderstanding.",
    example:
      "\"You've been hard to reach.\" — \"When did you need me and couldn't get hold of me?\" Now there is something specific to address.",
    practice:
      "Next time you receive criticism, ask one question before saying anything else.",
    commonMistake:
      "Agreeing instantly to end the discomfort, then resenting it later. Rapid agreement is a form of avoidance.",
    realWorldApplication:
      "Performance reviews, feedback from friends and partners, customer complaints.",
    sources: [SOURCE_FEEDBACK],
  }),

  lesson("asrt.feedback", {
    title: "Situation, behaviour, impact, request",
    concept:
      "Name when it happened, what was done (observable, not inferred), the effect it had, and what you are asking for. Four short parts, no character judgements.",
    whyItMatters:
      "Trait-based feedback — 'you're careless' — cannot be acted on and puts the other person on the defensive. Behavioural feedback describes something they can change tomorrow.",
    example:
      "\"In yesterday's review, the numbers hadn't been updated. I ended up guessing in front of the client. Could you send them the night before next time?\"",
    practice:
      "Rewrite a piece of feedback you have been avoiding using these four parts. It usually gets shorter and easier to say.",
    commonMistake:
      "The compliment sandwich. It obscures the message and makes future praise suspect.",
    realWorldApplication:
      "Colleagues, flatmates, family — anywhere something recurring needs to change.",
    sources: [SOURCE_FEEDBACK],
  }),

  lesson("emp.validation", {
    title: "Reasonable-given-the-situation, before anything else",
    concept:
      "Validation is saying the reaction makes sense given what happened. It is not agreement and it is not praise. \"Of course you're annoyed — you found out last.\"",
    whyItMatters:
      "People rarely take in advice until they believe their reaction has been accepted. Skipping this step is why good advice gets rejected.",
    example:
      "\"That would irritate me too\" lands. \"At least it's sorted now\" does not, even though both are meant kindly.",
    practice:
      "Say one validating sentence today with no 'but' after it. The 'but' is what deletes it.",
    commonMistake:
      "Silver linings. 'At least…' reliably reads as minimisation, however well intended.",
    realWorldApplication:
      "Any conversation where someone is upset, including ones where you think they are wrong.",
    sources: [SOURCE_SUPPORT],
  }),

  lesson("emp.hold-off-solving", {
    title: "Ask whether they want ideas",
    concept:
      "When someone brings a problem, stay with it for a couple of turns, then ask: \"do you want to think it through, or just vent?\" Then do that.",
    whyItMatters:
      "Immediate problem-solving is experienced as being hurried past. Asking takes four seconds and removes the guesswork entirely.",
    example:
      "\"That sounds exhausting. Do you want ideas, or do you just need to say it out loud?\"",
    practice:
      "Ask the question once this week instead of assuming. Note which answer you get — it is often not the one you expected.",
    commonMistake:
      "Assuming that listening without solving is doing nothing. For most people it is the thing they came for.",
    realWorldApplication:
      "Partners, close friends, colleagues venting about work.",
    sources: [SOURCE_SUPPORT],
  }),

  lesson("grp.include", {
    title: "Open a door, then leave a pause",
    concept:
      "Bring in a quiet person by name, with an open question tied to something they know or said earlier — then leave a clear pause. The pause is the part people skip.",
    whyItMatters:
      "Quiet people in groups are usually waiting for a gap that never arrives. Naming them creates the gap; the silence afterwards is what lets them use it.",
    example:
      "\"Priya, you were on the last rollout — what went wrong then?\" Then stop talking for three full seconds.",
    practice:
      "Bring one person into a conversation this week and count to three afterwards.",
    commonMistake:
      "\"Anything to add?\" — a closed question directed at nobody, which is easier to decline than to answer.",
    realWorldApplication:
      "Meetings you are running, group dinners, seminars.",
    sources: [],
  }),

  lesson("grp.recover-interrupt", {
    title: "Reclaim once, level, then let it go",
    concept:
      "When cut off, return to the point once — \"just to finish that thought\" — in a level tone. If the group has genuinely moved on, drop it and come back later.",
    whyItMatters:
      "Not reclaiming teaches a group that you can be talked over. Reclaiming repeatedly, or sharply, costs more than the point was worth. Once is the calibration.",
    example:
      "\"Before we move on — the bit I hadn't finished was the cost side.\"",
    practice:
      "Next time you are interrupted, reclaim once. Notice that it is almost never treated as rude.",
    commonMistake:
      "Reclaiming with an apology attached, which invites a second interruption.",
    realWorldApplication:
      "Meetings, family conversations, any group with a fast talker in it.",
    sources: [],
  }),

  lesson("diff.apologising", {
    title: "Name it, name the effect, say what changes — then stop",
    concept:
      "A working apology has three parts and no fourth. What you did, what it cost them, what will be different. No explanation of your intentions unless asked.",
    whyItMatters:
      "Explaining intent is heard as excuse-making, and prolonged self-criticism turns the apology into a request for reassurance — which makes the other person do the emotional work.",
    example:
      "\"I forgot to send the file and you had to chase it twice. I've set a reminder for Thursdays.\"",
    practice:
      "Draft an apology you owe in three sentences. Cut anything explaining why you did it.",
    commonMistake:
      "'I'm sorry you felt that way.' It apologises for their reaction rather than your action, and everyone hears the difference.",
    realWorldApplication:
      "Missed commitments, sharp messages sent in a hurry, forgotten plans.",
    sources: [SOURCE_REPAIR],
  }),

  lesson("rel.invitations", {
    title: "Specific, and easy to decline",
    concept:
      "Name the activity, the day and roughly the time — and make declining explicitly fine. \"Coffee Thursday after work? No worries if you're busy.\"",
    whyItMatters:
      "Vague invitations ('we should do something') put the work of proposing onto the other person, so they usually go nowhere. The escape clause lowers the cost of accepting, because a yes no longer feels like a commitment to a friendship.",
    example:
      "\"There's a thing at the gallery Saturday afternoon — want to come? Completely fine if not.\"",
    practice:
      "Convert one 'we should' into a specific proposal this week.",
    commonMistake:
      "Reading a no as a verdict on the relationship. Most declines are about the Thursday, and the way to find out is to invite again in a month.",
    realWorldApplication:
      "Colleagues you like but never see outside work; friends you have drifted from.",
    sources: [SOURCE_LIKING_GAP],
  }),

  lesson("rel.contact", {
    title: "Small and regular beats big and rare",
    concept:
      "Maintaining a friendship mostly means short, low-cost contact tied to something specific they mentioned. A two-line message beats a monthly essay.",
    whyItMatters:
      "People overestimate the size of gesture required and so do nothing. The specificity — referencing something they told you — is what makes a short message feel personal.",
    example:
      "\"Did the interview happen? Been wondering how it went.\"",
    practice:
      "Message one person today about something they mentioned last time.",
    commonMistake:
      "Waiting because too much time has passed. The gap almost never registers as strongly for them as it does for you.",
    realWorldApplication:
      "Old friends, people who moved away, colleagues who changed jobs.",
    sources: [SOURCE_LIKING_GAP],
  }),

  lesson("dig.tone", {
    title: "Text loses tone, so add it back",
    concept:
      "A neutral message reads as cold; a brief one reads as annoyed. Add a short warm opener to requests, and re-read as the most uncharitable possible reader before sending.",
    whyItMatters:
      "Senders read their message in their own tone of voice and consistently overestimate how clearly it comes across. The recipient has only the words.",
    example:
      "\"Where are we on this?\" versus \"Morning — how's the deck looking? No rush, just planning my day.\" Same question, different working relationship.",
    practice:
      "Re-read the last work message you sent as if you disliked the sender. If it survives that, it was fine.",
    commonMistake:
      "Compensating with exclamation marks rather than with content. Warmth comes from context and acknowledgement, not punctuation.",
    realWorldApplication:
      "Work chat, group chats, any message written while irritated.",
    sources: [],
  }),

  lesson("dig.messaging", {
    title: "Ask in the first line",
    concept:
      "Put the request or question at the top, then the context. The reader should know what you need from them before they decide how carefully to read.",
    whyItMatters:
      "Messages that bury the ask get skimmed, deferred and forgotten. Front-loading it is the single change that most improves reply rates.",
    example:
      "\"Can you review the draft by Thursday? Context: the client moved the meeting up and this is the last section outstanding.\"",
    practice:
      "Take the last long message you sent and move its final sentence to the top.",
    commonMistake:
      "Multiple asks in one message. The second one gets lost — send two messages or number them.",
    realWorldApplication:
      "Work email, requests to busy people, anything you need an actual answer to.",
    sources: [],
  }),

  lesson("lead.clarity", {
    title: "Conclusion first, then the reasoning",
    concept:
      "Say the decision or the ask, then explain. People listening for the point through three minutes of context stop listening around minute one.",
    whyItMatters:
      "Leading with reasoning makes listeners guess where you are heading, and they usually guess wrong. Stating the conclusion first turns the reasoning into support rather than suspense.",
    example:
      "\"We're pushing the launch to March. Two reasons: testing isn't finished and the support team is short until February.\"",
    practice:
      "Write the first sentence of your next update as the conclusion. Everything else follows it.",
    commonMistake:
      "Softening the conclusion so much that people leave unsure a decision was made.",
    realWorldApplication:
      "Status updates, announcements, escalations, any message to someone senior.",
    sources: [],
  }),

  lesson("lead.facilitation", {
    title: "Purpose, progress, decision",
    concept:
      "Open with what the discussion is for, summarise where the group has got to at the midpoint, and close with a decision and an owner. Those three moves are most of facilitation.",
    whyItMatters:
      "Discussions fail by drifting, not by lacking ideas. The summary at the midpoint is what converts talking into deciding.",
    example:
      "\"We're here to pick between the two suppliers. So far: A is cheaper, B is faster. The question left is whether the date is fixed. Priya — is it?\"",
    practice:
      "In your next group discussion, summarise once in the middle. It changes the shape of the whole conversation.",
    commonMistake:
      "Facilitating and advocating at once. If you need to argue a position, hand the facilitation to someone else for that stretch.",
    realWorldApplication:
      "Team meetings, group projects, committees, family decisions.",
    sources: [],
  }),
];

const BY_SKILL = new Map<Id, Lesson>(LESSONS.map((item) => [item.skillId, item]));

export function authoredLessonFor(skillId: Id): Lesson | undefined {
  return BY_SKILL.get(skillId);
}

/**
 * Every skill has a lesson. Where one has not been hand-written, it is derived
 * from the skill's own behaviour definitions rather than left blank or left to
 * a model — the behaviours are already the teachable content, and a derived
 * lesson is honest about being a summary rather than pretending to authority.
 */
export function lessonFor(skillId: Id): Lesson {
  const authored = BY_SKILL.get(skillId);
  if (authored) return authored;
  const skill = requireSkill(skillId);
  const [first, second, third] = skill.behaviours;
  return {
    id: `lesson.derived.${skillId}`,
    skillId,
    title: skill.name,
    concept: `${skill.summary} In practice that means: ${skill.behaviours.map((b) => b.toLowerCase()).join("; ")}.`,
    whyItMatters:
      "These are the observable parts of the skill — the things another person in the room could notice you doing. Training them is what makes the skill transfer.",
    example: first ? `For instance: ${first.toLowerCase()}.` : skill.summary,
    practice: second ? `Try one thing today: ${second.toLowerCase()}.` : `Try ${skill.name.toLowerCase()} once today.`,
    commonMistake:
      third
        ? `The part most people drop under pressure: ${third.toLowerCase()}.`
        : "Under pressure, most people revert to whatever is quickest. Slowing down is usually the fix.",
    realWorldApplication: `Most useful in: ${skill.contexts.join(", ")}.`,
    sources: [],
    estimatedMinutes: 1,
    version: 1,
  };
}

/** Lessons carrying at least one research-backed claim, for the sources page. */
export function lessonsWithSources(): Lesson[] {
  return LESSONS.filter((item) => item.sources.length > 0);
}
