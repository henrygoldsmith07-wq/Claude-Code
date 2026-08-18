# Pulse — Roadmap

A backlog for growing Pulse's experiment layer from "design once, analyse at
the end" into something a single person can actually run reliably for months.
The headline is **honesty**: every item below either removes a way an
experiment can quietly mean nothing, or makes a run you cannot complete fail
loudly instead of pretending it succeeded.

Items marked *(extend)* have a working baseline in `src/experiments/` and need
depth rather than a new subsystem. Order within each group is not priority
order. Sizes are S (one focused change), M (a module plus tests), L (a
multi-file change with a real design decision).

## Progress

Shipped in the first implementation pass: **#10 Experiment Calendar Conflict
Warnings** — `experiments/calendar.ts` scans live designs per date and reports
`calendar.conflicts` (dates with more than one experiment assigned, with a
`sameMetric` flag), the summary counts them, and the experiments panel shows a
warning block plus marks conflicting schedule entries.
`tests/calendar-conflicts.test.ts` pins the behaviour.

Shipped: **#2 Intervention Periods** — `derivePeriods` in
`experiments/design.ts` splits a design's schedule into named periods (the
crossover's blocks, the before-after's two halves, the A/B's condition runs),
each with its condition label, dates and day count; `periodForDate` gives a
day's position within its period. `experiments/calendar.ts` marks the active
entry's today period and labels every schedule row "Intervention A · Day 4/7";
the experiments panel lists the periods on each design card. The periods are
derived from the schedule, never stored. `tests/periods.test.ts` (13 tests)
pins the behaviour across all three design types.

Shipped: **#4 Adaptive Experiment Duration** — the design records the
assumed `sessionsPerWeek`; `adaptiveEndDate` in `experiments/calendar.ts`
recomputes a run's end date from the observed rate (condition sessions per
week over the elapsed run), extending only when the planned sample
(`minSamplePerCondition * 2`) will not be reached by the original end, never
ending early, and hard-capped at 84 days. Extension days continue the
design's condition pattern (`extendedAssignments` in `experiments/design.ts`:
block alternation plus washout gaps for crossover, strict alternation for
A/B, the after condition for before/after) so sessions recorded there count;
the calendar stays live past the original end, shows the effective end date
and schedules the extension days; the analysis window follows the effective
end and records it (`result.effectiveEndDate`) with a reason stating the
observed vs assumed rate. `tests/adaptive-duration.test.ts` (18 tests) pins
the rule, the extended schedule, calendar and analysis.

Shipped: **#1 Baseline Periods** — `designExperiment` accepts optional
`baselineDays` (any design type, capped at 7): the schedule prepends a
null-condition lead-in before the first assignment, `derivePeriods` names it
"Baseline" (distinct from a washout by position), and the calendar labels
those days "Baseline · Day 2/4" with "Record the outcome as usual — no
condition applies yet". The analysis excludes the lead-in from the comparison
and adherence, and reports it in the result's `baseline` field — days,
sessions, mean (the starting level) and a least-squares drift per day — plus
one plain sentence in the summary. `tests/baseline.test.ts` (15 tests) pins
scheduling, periods, calendar and analysis.

Shipped: **#3 Washout Periods** — `designExperiment` accepts optional
`washoutDays` (crossover only, capped at `blockDays`): the schedule inserts a
null-condition gap between every pair of blocks, `derivePeriods` names each
gap "Washout", and the calendar labels those days "Washout · Day 1/2" with
"No condition — record the outcome only" as the instruction. The analysis
excludes washout days from the per-block means and from adherence (there is
no assignment to follow), and reports them separately in the result's
`washout` field — length, recorded sessions and their mean, the visible
hangover — plus one plain sentence in the summary. `tests/washout.test.ts`
(13 tests) pins scheduling, periods, calendar and analysis.

Shipped: **#12 Multi-Outcome Experiments** — the design registers an
`outcomes` array: the hypothesis's metric as primary (which alone may drive
the verdict), plus secondaries each carrying their own predicted direction
and size (capped at five outcomes, duplicates refused). The analysis runs the
same comparison machinery per outcome and corrects the whole family with the
same Benjamini-Hochberg step-up the discovery layer uses — a borderline
primary that the family-wide search cannot single out is `inconclusive`, not
`supported`, with the correction named in the reasons. Secondaries are
reported on the result (comparison, effect, raw and adjusted p, plain
reading) and never flip the verdict; an under-sampled secondary drops out of
the family rather than polluting it. The same-metric conflict scan now
considers every outcome metric, primary or secondary. `tests/multi-outcome
.test.ts` (12 tests) pins the design record, the correction bite, the
primary-driven verdict, the reported secondaries, and the secondary-metric
conflict block.

Shipped: **#13 Replication Templates** — `pulse.replicateExperiment` clones
an analysed design with one click: `replicateDesign` keeps its conditions,
outcomes, analysis method, success criteria and structure (block length,
washout, baseline, lag, stopping), and re-derives the sample from the
*observed* effect of the original run — a strong observed effect needs fewer
sessions, a weak one many more (same 0.25 floor as design time) — scheduled
with a fresh id, seed and start date (default: the day after the original
ends). The clone carries `replicatedFromDesignId` back to the original, the
hypothesis is relinked to `testing`, the same-metric conflict check runs
against every *other* live design (the original itself is never a conflict),
and when the clone is analysed the replication ledger's `retested` path
records the second run on the paper trail (`recordExperimentResult` takes a
note). A run analysed `invalid` — no observed effect to size from — refuses
replication. The design card shows "Replicates …" on the clone and a
one-click Replicate button on analysed cards. `tests/replication.test.ts` (11
tests) pins the clone, the sample re-derivation, the relink, the conflict
exclusion, the ledger note, and the invalid-run refusal.

Shipped: **#11 Delayed Outcome Support** — `designExperiment` accepts an
`outcomeLagDays` option (0 = today's outcome, capped at a week), stored on the
design; `assignmentDateForOutcome` pairs every outcome observation dated X to
the assignment of X − lag, never by row position. The analysis applies the
pairing everywhere it touches a date: the window bounds, the condition
attribution, adherence (an assigned day is followed when its outcome lands the
day after), the baseline and washout reports, the per-block means, and the
adaptive-duration projection (fed assignment dates so a slow run still extends
the right days). The summary states the pairing in plain language. Tested
against the synthetic benchmark user's next-morning sleep rating — a genuine
planted lag. `tests/outcome-lag.test.ts` (12 tests) pins the option, the
explicit pairing (and the misattribution a lag-0 read makes of the same
data), the washout/baseline shift, adherence, window bounds and the
adaptive wiring.

Shipped: **#5 Early Stopping Rules, #6 Futility, #7 Low-Adherence, #8
Data-Quality** — `experiments/stopping.ts` evaluates a live run per day and
decides *continue* or *stop*, with the reason recorded on the experiment. Only
rules pre-registered on the design may stop a run — `designExperiment` accepts
a `stopping` option whose thresholds are resolved and stored on the design
record. Three rules ship: futility (conditional power at the planned sample
below a pre-registered floor — always `inconclusive`, never `refuted`),
low-adherence (projected final adherence below the floor with no realistic
recovery, naming the missed days — `invalid`), and data-quality (the worst
contributing source's score over the run window collapses — `invalid`). The
calendar carries the live decision on the entry (`entry.stopping`), the
analysis integrates it (a stopped run's window closes on the day it was
stopped), and the experiments panel shows a "Stopped early" alert.
`tests/stopping.test.ts` (23 tests) pins pre-registration, the three rules,
their gates, ordering and the analysis integration.

Shipped: **#9 Experiment Conflict Detection (same-metric tier)** —
`findSameMetricOverlaps` in `experiments/calendar.ts` refuses, at proposal
time, any experiment whose run range intersects a live run on the same metric.
`Pulse.designExperiment` throws `ExperimentConflictError` naming the blocking
experiment, its range and the shared metric; the design is not stored and the
hypothesis stays `proposed`. Different metrics may still share days, and
sequential runs on the same metric are unaffected. The UI surfaces the refusal
in an alert on the insights panel. The mutually-exclusive-behaviour tier
(same-day conditions that cannot both be followed) remains open.

## Baseline (measured 2026-08-17)

| Thing | Today |
|-------|-------|
| Design types | crossover, A/B, before-after (`experiments/design.ts`) |
| Duration | Fixed at design time from power ÷ sessions-per-week; clamped to 14–56 days, rounded to even blocks |
| Periods | Conditions A/B only — no baseline phase, no washout, no named intervention periods |
| Calendar | `active` / `upcoming` / `completed` / `analysed` buckets, today's assignment, 60-day schedule (`experiments/calendar.ts`) |
| Conflict handling | **None** — overlapping experiments are both listed, never flagged |
| Analysis | One verdict at the end of the run: `supported` / `refuted` / `inconclusive` / `invalid` (`experiments/analysis.ts`) |
| Mid-run stopping | **None** — adherence and data quality are only checked at analysis time |
| Outcomes | Single `targetMetricId` per experiment, measured same-day |
| Data quality | `quality/` five-dimension score feeds the confidence grade; not wired to stopping |
| Reuse | Designs are seeded and reproducible; the replication ledger and insight history exist, but nothing clones a finished experiment |

---

## P1 — Experiments

### Period structure

#### 1. Baseline Periods — **M**

Today there is no baseline phase: crossover alternates conditions from day
one, and before-after splits the run at its midpoint with no pre-run
observation, so "before" is the first half of the run rather than a
measurement of the starting level.

- Add an optional `baselineDays` phase before the first assignment. During it
  the outcome metric is recorded with no condition applied, and the analysis
  reports the baseline mean and trend alongside the comparison — the user can
  see the starting level and drift before the intervention.
- Keep it short (3–7 days) and optional; exclude baseline days from adherence,
  which is measured on assigned days only.

**Files:** `experiments/design.ts` (schedule), `experiments/calendar.ts`
(baseline bucket), `experiments/analysis.ts` (baseline summary in the result).

**Risk:** baseline inflates perceived length. Default off; when on, the design
must say what the baseline is for, not just that one exists.

*Shipped (see Progress): optional `baselineDays` lead-in (capped at 7 days,
any design type) derived as a "Baseline" period and shown in the calendar;
the analysis excludes it from the comparison and adherence and reports the
starting level and per-day drift in the result's `baseline` field.*

#### 2. Intervention Periods — **S**

Conditions exist (A/B) but only as a flat per-day assignment; nothing names a
contiguous stretch of the same condition as a period.

- Derive named periods from the assignment schedule — e.g. "Intervention A ·
  Day 4/7" — deterministically from the seed, and surface them in the calendar
  and the finding UI.
- The derivation, not a stored label, is the source of truth, so a period
  never drifts from the actual schedule.

**Files:** `experiments/design.ts` (period derivation), `experiments/calendar.ts`, `ui/`.

**Risk:** low — mostly naming and display, but keep the derivation pure and
tested against every design type.

*Shipped (see Progress): `derivePeriods` + `periodForDate` in
`experiments/design.ts`, calendar today/schedule labels, and the period list
on each design card.*

#### 3. Washout Periods — **M**

Carry-over is today a *listed* likely confounder and an invalidation
("a change in circumstances…"), but crossover blocks run back-to-back with no
gap, so a lingering effect bleeds into the next block's baseline.

- Add optional `washoutDays` between crossover blocks. During a washout no
  condition applies; the outcome is still recorded but excluded from the
  per-block means, and the analysis reports the washout length and any visible
  hangover in the excluded days.
- Default off; cap washout at `blockDays` so it cannot double the run length.

**Files:** `experiments/design.ts`, `experiments/analysis.ts` (exclude and
report washout days).

**Risk:** the honest-but-expensive version of crossover. Opt-in, and let the
replication templates (P1 #13) carry the choice forward so a replicated study
keeps the same structure.

*Shipped (see Progress): optional `washoutDays` between every pair of
crossover blocks (capped at `blockDays`), null-condition washout days derived
as "Washout" periods and shown in the calendar, and an analysis `washout`
report that excludes the gap from means/adherence and states the hangover.*

### Duration and stopping

#### 4. Adaptive Experiment Duration — **L**

Duration is fixed at design time from the power-derived sample ÷ assumed
sessions-per-week, clamped to 14–56 days. If the real session rate differs,
the run ends with too few or too many days, silently.

- Recompute the end date mid-run from the *observed* sessions-per-week so the
  run still reaches its planned sample — extend when the rate is lower than
  assumed; never extend past a hard cap (84 days).
- The analysis method and the planned sample stay fixed from the original
  design; only the data-collection window adapts. Changing the analysis
  because the data came back awkward is how p-values stop meaning anything.

**Files:** `experiments/calendar.ts` (recomputed end date), `experiments/design.ts`
(store the assumed rate), `experiments/analysis.ts`.

**Risk:** high if it drifts into "let the data decide". The extension must be
rule-based and recorded, not opportunistic.

*Shipped (see Progress): `adaptiveEndDate` recomputes the end from the
observed sessions-per-week (extend-only, capped at 84 days, deterministic);
`extendedAssignments` continues the condition pattern so extension sessions
count; the calendar and analysis follow the effective end, recorded as
`result.effectiveEndDate` with the observed-vs-assumed rate in the reasons.*

#### 5. Early Stopping Rules — **M**

Verdicts are computed once, at the end. Nothing looks at a live run, so a
run that is already doomed — or already won — burns its full length and
returns an answer that mixes early and late data.

- New `experiments/stopping.ts`, evaluated per day on the live calendar:
  given the events so far, decide *continue* or *stop*, with the reason
  recorded on the experiment.
- Only rules pre-registered in the design may stop a run. The three concrete
  rules below are the first instances; a stopping rule that appears after the
  run started is not a stopping rule, it is rationalisation.

**Files:** new `src/experiments/stopping.ts`, `experiments/calendar.ts` hook,
`experiments/analysis.ts` (final verdict integrates the stop).

*Shipped (see Progress): `experiments/stopping.ts` evaluates the
pre-registered rules per day on the live calendar — futility, low-adherence
and data-quality — with the decision carried on the calendar entry and
integrated into the final verdict.*

#### 6. Futility Stopping — **M**

An underpowered run runs to its full length and returns `inconclusive` at the
end, after weeks of collecting data that could never have answered.

- Conditional-power check: if the observed effect is far enough from the
  prediction that reaching significance at the planned sample is effectively
  impossible, stop and return `inconclusive` early, with the futility reason.
- A futility stop is never `refuted` — it is not evidence of no effect.

**Files:** `experiments/stopping.ts`, using `statistics/power.ts`
(`isAdequatelyPowered`, `detectableEffect`).

**Risk:** a too-eager threshold stops on early noise. Calibrate against the
synthetic benchmark users, and pre-register the threshold in the design.

*Shipped (see Progress): conditional-power check with a pre-registered floor
(0.2 default) gated behind a minimum observed sample fraction (0.5 default),
so early noise cannot stop a run; a futility stop is always `inconclusive`.*

#### 7. Low-Adherence Stopping — **S**

Adherence is computed at analysis time; below 40% the run is `invalid` — but
that is discovered only when it is over.

- Track assigned-days-with-sessions per day. If projected adherence falls
  below the floor with no realistic recovery (not enough assigned days left),
  stop the run as `invalid` early and name the missed days.
- Reuse the existing `analysis.ts` adherence logic rather than duplicating it.

**Files:** `experiments/stopping.ts`, `experiments/calendar.ts` (daily
adherence), `experiments/analysis.ts`.

*Shipped (see Progress): the adherence rule projects the final adherence over
the adaptive-duration window — if even perfect recovery cannot reach the
floor, the run stops as `invalid` with the missed days named. It reuses the
analysis's 40% default floor.*

#### 8. Data-Quality Stopping — **M**

`quality/` scores data quality on five dimensions and feeds the confidence
grade, but nothing acts on it mid-run — a connector that stops syncing poisons
the tail of an experiment and only shows up in the final quality note.

- Gate the run on data quality: if the target metric's quality score collapses
  mid-run (coverage, consistency, outlier rate…), stop as `invalid` with the
  quality report attached, rather than analysing a broken tail.

**Files:** `experiments/stopping.ts` + `quality/score.ts` (expose a daily
score), calendar hook.

**Risk:** distinguish "missing because the condition says don't do it" from
"missing because the pipeline broke" — the former is adherence, the latter is
quality.

*Shipped (see Progress): the quality rule scores the worst contributing
source over the run's own window (freshness collapses when a connector stops
syncing) and stops as `invalid` below the pre-registered 0.45 floor, gated
behind a 7-day elapsed minimum; adherence is evaluated first, so missing
because the condition said don't stays an adherence matter.*

### Calendar safety

#### 9. Experiment Conflict Detection — **L**

Two designs can overlap in the calendar silently. The schedule lists both,
and the user is expected to notice that they are being asked to do two
morning routines at once.

- Detect overlaps where two live experiments target the same metric, or where
  their conditions demand mutually exclusive behaviour on the same day.
- A conflicting design is flagged at proposal time and cannot be started
  until resolved — the calendar is a scheduler, not a to-do list.

**Files:** `experiments/calendar.ts` (overlap scan), the proposal path in
`pulse.ts`, tests.

**Risk:** not all overlap is harmful — different metrics can share days.
Only same-metric and same-time-slot overlap should block.

*Same-metric tier shipped (see Progress): `findSameMetricOverlaps` blocks an
overlapping proposal at design time. The mutually-exclusive-behaviour tier —
two conditions that cannot both be followed on the same day, even on
different metrics — is the remaining half.*

#### 10. Experiment Calendar Conflict Warnings — **S**

Build the visible half of #9 first: per-day and per-schedule warnings that
"Experiment X also assigns today", so a user sees the clash before it becomes
a blocked start. #9 promotes the warning into a hard block; this item is the
warning itself.

**Files:** `experiments/calendar.ts` (per-date conflicts), calendar UI.

### Outcomes

#### 11. Delayed Outcome Support — **M**

The outcome is assumed to land on the same day as the condition (a per-session
value). Sleep quality measured the morning after, or a score reported the
following day, gets paired with the wrong day by row number.

- Add `outcomeLagDays` to the design (0 = today's outcome). Analysis pairs
  assignment-day to outcome-day *explicitly* with the lag — never by row
  position.
- Test with a planted lag in the synthetic benchmark users.

**Files:** `experiments/design.ts`, `experiments/analysis.ts` (lagged pairing).

*Shipped (see Progress): `outcomeLagDays` on the design (capped at 7),
`assignmentDateForOutcome` in `experiments/design.ts`, and the lagged pairing
applied consistently across the analysis, the adaptive projection, the
calendar's end-date projection and the stopping rules.*

#### 12. Multi-Outcome Experiments — **L**

A hypothesis has one outcome, and an experiment has one `targetMetricId`.
Useful questions often have several outcomes, but running one experiment per
outcome multiplies the false-positive rate across the family.

- Allow one experiment to register several outcomes (primary + secondaries),
  each with its own predicted direction and size, analysed with the same
  within-family Benjamini-Hochberg correction discovery already uses.
- The success criterion stays on the primary outcome; secondaries are
  reported, never allowed to flip the verdict.

**Files:** `experiments/design.ts` (outcomes array), `experiments/analysis.ts`
(per-outcome verdicts + family correction), `hypotheses/tracker.ts`.

*Shipped (see Progress): `outcomes` array on the design (primary +
secondaries, each with its own prediction), per-outcome comparisons with
Benjamini-Hochberg across the family, and a primary-only verdict. The tracker
needed no structural change — the hypothesis stays the primary claim.*

### Reuse

#### 13. Replication Templates — **S**

Every design is built fresh from a hypothesis; repeating an experiment
re-derives everything, and nothing links the repeat to the original.

- One-click "replicate this experiment": clone an analysed design with its
  conditions, outcome, analysis method and success criteria, re-derive the
  sample from the *observed* effect, and schedule with a new seed and start
  date.
- The clone carries a link back to the original — that is how the replication
  ledger's `retested` path gets its second run with a paper trail.

**Files:** `experiments/design.ts` (clone), `discovery/replication.ts` /
`history/` integration, UI.
