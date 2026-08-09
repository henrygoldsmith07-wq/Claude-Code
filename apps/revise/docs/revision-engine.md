# The revision engine

Every number this app shows a student is produced by one of six algorithms.
This is what they do and why they are built that way.

## 1. Scheduling (FSRS)

`src/domain/scheduling.ts`

FSRS is the empirically-fit successor to SM-2 and is what current Anki ships. It
tracks memory **stability** (how long a memory lasts) and **difficulty** (how
hard this item is for this person) separately, rather than folding both into one
"ease" multiplier, and schedules the next review for the day predicted recall
decays to the target retention — 90% here.

Two configuration choices worth stating:

- **Fuzz on.** Reviews scheduled for the same day get spread, so a student does
  not meet one brutal session three weeks after a heavy day.
- **Short-term steps off.** FSRS's minute-scale learning steps are switched off
  because the session queue handles that better: a card graded *Again* is
  reinserted four positions later in the same session (`reinsert`). Tomorrow is
  too late to repair a card you have just proved you cannot recall.

The forgetting curve, `R = (1 + (19/81)·t/S)^-0.5`, is used directly for the
"retention" figure in mastery, so the number shown is a real predicted recall
probability rather than a proxy.

Session queues put the most overdue cards first and interleave new cards rather
than front-loading them, so a session never opens with a wall of unseen
material.

## 2. Mastery

`src/domain/mastery.ts`

Mastery is the number every other engine reads, so it has to be honest about
uncertainty. A topic with two easy cards answered once is not mastered — it is
unmeasured.

```
evidence   = cards + 2 × attempts
weight     = min(1, evidence / 8)
raw        = weighted blend of (stability·0.6 + retention·0.4) and question accuracy,
             with question accuracy weighted 1.5× because it is closest to the real exam
mastery    = evidence == 0 ? 0
                           : prior·(1 − weight) + raw·weight
mastery   ×= max(0.6, 1 − 0.06 × open mistakes)
mastery   ×= 1 − 0.02 × (intrinsicDifficulty − 3)
```

The `evidence == 0 → 0` case matters more than it looks. Returning the prior
there would mean a student who had never opened a topic saw 40% mastery on it,
and every predicted grade would be inflated before they did any work. A unit
test pins this.

**Weak ≠ unmeasured.** A topic is weak only if it is below 0.55 *and* has some
evidence behind it. Topics with no evidence are routed to a first-pass "learn"
activity instead of remediation, which is a different thing to do.

## 3. Recommendation

`src/domain/recommender.ts`

Every candidate is scored on one scale so they can be compared directly, then
multiplied by exam urgency:

| Candidate | Base score | Rationale |
|-----------|-----------|-----------|
| Due flashcards | 55 + 30·min(1, due/30) + min(15, overdue) | Decayed memory is the cheapest thing to fix, and it is the only time-sensitive activity. |
| Mistake repair (≥3 open) | 50 + min(25, 2·count) | Marks the student has already proved they can lose. |
| Weak-topic practice | 30 + 45·(1 − mastery) | Where revision converts into marks fastest. |
| First-pass learn | 26 + 2·(6 − difficulty) | Coverage matters, but not more than repairing what is broken. |
| Timed paper | 24 + 30·avg mastery | Only once the subject is broadly solid or the exam is within three weeks. |
| Today's plan | +12 to a match | The student's own commitment breaks ties. |

Exam urgency is `1 + min(1, 30/(days + 15))` — smooth, rising to ~2.0 in the
final fortnight. A step function would make the whole plan lurch the moment a
threshold was crossed.

Saturation matters: 30 due cards is already "a lot", and 300 is not ten times
worse. Without the cap a backlog would drown out every other activity forever,
which is exactly how a student ends up doing nothing but flashcards.

## 4. Planning

`src/domain/planner.ts`

The plan is derived state, not a document. Regenerating is always safe and
cheap, which is what keeps the timetable honest instead of letting it drift into
fiction.

- Days come from stated availability; a day under 10 minutes is skipped.
- Blocks are split between subjects by `(0.15 + (1 − avg mastery)) × urgency`,
  allocated by **largest remainder** so nothing rounds away to nothing and the
  totals always add back up.
- Every study day opens with due-card review.
- Within a subject, topics are picked by projected deficit with a spacing
  penalty — revisiting a topic the very next day wastes the spacing effect.
- Mastery is "spent" as the plan is built, so a topic scheduled on Monday looks
  less urgent by Wednesday.
- Inside the last fortnight, every third block becomes a timed paper.

**Missed sessions.** Anything still pending on a past day is marked `missed` and
its work is re-queued onto the next day with room, oldest first. Nothing
silently disappears, and the plan is never a list of things the student has
already failed to do. This runs automatically at startup as well as on demand.

## 5. Marking

`src/domain/marking.ts`

The offline marker is the floor the product stands on. It is keyword and lemma
overlap against the mark scheme — generous about wording, strict about content:

- Stop words removed, a cheap stemmer so *oxidised* / *oxidation* agree.
- A scheme point is credited at ≥50% content-word coverage, or on a numeric
  match against a value in the scheme.
- Marks are awarded proportionally: a 3-mark part with 4 scheme points still
  awards out of 3.
- An answer under three words is capped at one mark however many keywords it
  happens to contain — otherwise "concentration decreases" scores full marks on
  a 3-mark explain question.

It cannot judge reasoning, which is exactly why AI marking exists and why every
rubric-marked answer is labelled as rubric-marked in the UI.

## 6. Grade prediction

`src/domain/grades.ts`

```
trust    = min(1, attempts / 10)
blended  = measured accuracy · trust + topic coverage · (1 − trust)
percent  = blended · 92 + 4
range    = ± (6 + 12 · (1 − trust)) percentage points
```

Mastery is not a mark — a student at 100% topic mastery does not score 100% —
so the value is compressed into a realistic attainment range before banding.
The output is always a band with an explicit confidence, because a single
predicted letter carries far more certainty than the data supports.

**Headroom** is the actionable output: how many percentage points the whole
subject would gain if this one topic were taken to full mastery. That answers
"what do I do next", which a predicted grade on its own never does.

## Mistake loop

`src/domain/mistakes.ts`

The loop that closes everything else:

```
dropped mark → classified mistake → flashcard (front: the question, back: the model answer)
            → returns in reviews → recalled reliably twice → mistake resolved
```

Classification (arithmetic, method, interpretation, communication, recall) comes
from the question's command words and the missed scheme points, and the patterns
are surfaced in analytics — "marks are going on units and significant figures,
not on understanding" is a more useful thing to tell a student than a list of
twelve individual mistakes.

A mistake resolves only when its card has `reps ≥ 2`, `stability ≥ 7 days` and
zero lapses. Resolving on a single correct answer would close mistakes that the
student got right by luck.

## Gamification

`src/domain/gamification.ts`

Rewards behaviour that raises grades — showing up, clearing due cards, repairing
mistakes — and never volume for its own sake. No leaderboards.

The streak has a **one-day grace**: a gap of two days holds the streak without
incrementing it. Losing a month's streak to one missed evening is how students
quit, and the streak is meant to support the habit rather than punish a life
event.
