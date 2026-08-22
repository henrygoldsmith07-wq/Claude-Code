import type { BehaviourKey, Id, IsoInstant, Simulation } from "./types";

// ---------------------------------------------------------------------------
// Donating a transcript, and rating the donated ones.
//
// The product's privacy model says conversations are never collected, and
// `ai/benchmark.ts` names that as the reason its cases are hand-written. That
// reasoning is right, and it is also why the evaluator has never been checked
// against a human judgement of a real conversation: there are no real
// conversations to check it against.
//
// The resolution is not to relax the invariant. It is to make donation a
// separate, deliberate act rather than a setting:
//
//   * One transcript at a time. There is no "donate my sessions" switch,
//     because a switch collects things the user has not seen.
//   * The user reads the exact text that would leave the device, and edits it.
//     What is donated is their redacted copy — the original is never sent.
//   * Consent records what was agreed to and when, in a form that can be shown
//     back to them, and it can be withdrawn.
//   * Donated copies live in their own store. Nothing else — reflections,
//     challenges, mastery, the event log — is reachable from a donation.
//
// What this module cannot do is guarantee a transcript is anonymous. Redaction
// suggestions are a lexical best effort and will miss things; a person
// describing their own life is identifiable from content no filter can catch.
// So the flow is built so the user is the last check, not the first, and
// `donationWarnings` says plainly what the suggestions do not cover.
//
// Pure. No I/O — persistence belongs to the repository.
// ---------------------------------------------------------------------------

export const CONSENT_VERSION = "2026-08-14.1";

/** What the user is told, verbatim, before anything leaves the device. */
export const CONSENT_TERMS = [
  "You are donating this one conversation. Nothing else is included, and this does not turn anything on for future sessions.",
  "What is sent is the version you see after your edits, not the original.",
  "It will be read by people, to check whether the app's scoring of it matches a human judgement.",
  "It is stored separately from everything else in the app, and is not linked to your progress, reflections or notes.",
  "You can withdraw it at any time, and it will be deleted.",
] as const;

export interface DonationConsent {
  transcriptId: Id;
  grantedAt: IsoInstant;
  /** The wording the user actually agreed to, so it can be shown back to them. */
  consentVersion: string;
  /** Set when the user withdraws; a withdrawn donation is never scored. */
  withdrawnAt?: IsoInstant;
}

export interface DonatedTurn {
  speaker: "user" | "character";
  text: string;
}

/**
 * A donated conversation.
 *
 * Deliberately not a `Simulation`: it carries no user id, no simulation id, no
 * timings, no voice metrics and no scenario object. Everything that could link
 * it back to a person has to be absent from the type, not merely omitted at the
 * call site, or a later refactor will quietly start including it.
 */
export interface DonatedTranscript {
  id: Id;
  donatedAt: IsoInstant;
  consent: DonationConsent;
  /** Title only — enough context to rate the conversation, no more. */
  scenarioTitle: string;
  difficulty: number;
  turns: DonatedTurn[];
}

// ---------------------------------------------------------------------------
// Redaction
// ---------------------------------------------------------------------------

export type RedactionKind = "email" | "phone" | "url" | "postcode" | "number" | "name";

export interface RedactionCandidate {
  kind: RedactionKind;
  /** The matched text, so the UI can highlight it. */
  text: string;
  /** Why it was flagged, in words the user can act on. */
  reason: string;
}

const PATTERNS: { kind: RedactionKind; re: RegExp; reason: string }[] = [
  { kind: "email", re: /\b[\w.+-]+@[\w-]+\.[\w.]{2,}\b/g, reason: "An email address." },
  { kind: "url", re: /\bhttps?:\/\/\S+|\bwww\.\S+/g, reason: "A web address." },
  { kind: "phone", re: /\b(?:\+\d{1,3}[\s-]?)?(?:\d[\s-]?){9,13}\b/g, reason: "Looks like a phone number." },
  { kind: "postcode", re: /\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/g, reason: "Looks like a postcode." },
];

/** Words that start a sentence and are capitalised for that reason alone. */
const SENTENCE_START = /(?:^|[.!?]\s+|\n)\s*$/;

/**
 * Things the user might want to remove before donating.
 *
 * Names are the hard case and are handled conservatively: a capitalised word
 * that is not a scenario character's name, not sentence-initial and not a
 * common word is *offered* for redaction, never removed. Over-offering wastes a
 * moment of the user's attention; under-offering sends a colleague's name to a
 * stranger, so the balance is deliberately tilted.
 */
export function redactionCandidates(text: string, knownNames: string[] = []): RedactionCandidate[] {
  const found: RedactionCandidate[] = [];
  const seen = new Set<string>();
  const add = (kind: RedactionKind, value: string, reason: string) => {
    const key = `${kind}:${value.toLowerCase()}`;
    if (seen.has(key)) return;
    seen.add(key);
    found.push({ kind, text: value, reason });
  };

  for (const { kind, re, reason } of PATTERNS) {
    re.lastIndex = 0;
    for (const match of text.matchAll(re)) {
      if (match[0].trim().length > 0) add(kind, match[0].trim(), reason);
    }
  }

  const known = new Set(knownNames.flatMap((n) => n.split(/\s+/)).map((n) => n.toLowerCase()));
  const nameRe = /\b[A-Z][a-z]{2,}\b/g;
  for (const match of text.matchAll(nameRe)) {
    const word = match[0];
    if (known.has(word.toLowerCase())) continue;
    if (COMMON_CAPITALISED.has(word.toLowerCase())) continue;
    const before = text.slice(Math.max(0, match.index - 3), match.index);
    if (SENTENCE_START.test(before) || match.index === 0) continue;
    add("name", word, "A capitalised word that might be someone's name.");
  }

  return found;
}

/** Capitalised words that are almost never a person in this context. */
const COMMON_CAPITALISED = new Set([
  "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday",
  "january", "february", "march", "april", "may", "june", "july", "august",
  "september", "october", "november", "december", "english", "christmas", "easter",
]);

/** Replace every chosen span with a stable placeholder. */
export function applyRedactions(text: string, remove: string[]): string {
  let output = text;
  for (const value of [...remove].sort((a, b) => b.length - a.length)) {
    if (!value) continue;
    const escaped = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    output = output.replace(new RegExp(escaped, "g"), "[removed]");
  }
  return output;
}

/**
 * Unconditional removal of contact-like spans — email, web address, phone,
 * postcode — applied at benchmark export time.
 *
 * Donation redaction is user-reviewed and optional per item; this pass is
 * neither. It is the defence-in-depth layer for research data: even a donated
 * transcript the user approved "as is" must not carry contact details into an
 * exported corpus.
 */
export function scrubContactDetails(text: string): { text: string; removed: number } {
  let output = text;
  let removed = 0;
  for (const { kind } of PATTERNS) {
    const pattern = PATTERNS.find((p) => p.kind === kind)!;
    pattern.re.lastIndex = 0;
    output = output.replace(pattern.re, () => {
      removed += 1;
      return "[removed]";
    });
  }
  return { text: output, removed };
}

export const DONATION_WARNINGS = [
  "These suggestions are a text search, not a guarantee. They will miss things.",
  "A conversation can identify you by what it describes, even with every name removed. Read it as a stranger would.",
  "If you are unsure, do not donate it. Nothing in the app depends on this.",
] as const;

// ---------------------------------------------------------------------------
// Preparing a donation
// ---------------------------------------------------------------------------

export interface DonationPreview {
  /** Exactly what would be sent, after the redactions applied so far. */
  turns: DonatedTurn[];
  scenarioTitle: string;
  difficulty: number;
  /** Suggestions the user has not yet acted on. */
  candidates: RedactionCandidate[];
  warnings: readonly string[];
}

/**
 * Build the preview the user approves.
 *
 * The preview *is* the payload: there is no separate serialisation step that
 * could include a field the user never saw.
 */
export function prepareDonation(simulation: Simulation, redact: string[] = []): DonationPreview {
  const knownNames = simulation.scenario.characters.map((c) => c.name);
  const turns: DonatedTurn[] = [...simulation.turns]
    .sort((a, b) => a.index - b.index)
    .map((turn) => ({
      speaker: turn.speaker,
      text: applyRedactions(turn.text, redact),
    }));

  const candidates = turns.flatMap((turn) => redactionCandidates(turn.text, knownNames));
  const deduped: RedactionCandidate[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates) {
    const key = `${candidate.kind}:${candidate.text.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(candidate);
  }

  return {
    turns,
    scenarioTitle: simulation.scenario.title,
    difficulty: simulation.deliveredDifficulty,
    candidates: deduped,
    warnings: DONATION_WARNINGS,
  };
}

/** Turn an approved preview into the donated record. Consent is required, not implied. */
export function donate(preview: DonationPreview, id: Id, now: IsoInstant): DonatedTranscript {
  return {
    id,
    donatedAt: now,
    consent: { transcriptId: id, grantedAt: now, consentVersion: CONSENT_VERSION },
    scenarioTitle: preview.scenarioTitle,
    difficulty: preview.difficulty,
    turns: preview.turns,
  };
}

export function withdraw(transcript: DonatedTranscript, now: IsoInstant): DonatedTranscript {
  return { ...transcript, consent: { ...transcript.consent, withdrawnAt: now } };
}

export function isActive(transcript: DonatedTranscript): boolean {
  return transcript.consent.withdrawnAt === undefined;
}

// ---------------------------------------------------------------------------
// Human ratings
// ---------------------------------------------------------------------------

export interface BehaviourRating {
  key: BehaviourKey;
  /** 0-1, the rater's own judgement, made without seeing the app's score. */
  score: number;
}

export interface TranscriptRating {
  transcriptId: Id;
  raterId: string;
  at: IsoInstant;
  ratings: BehaviourRating[];
  notes?: string;
}

export interface RatedCorpus {
  transcripts: DonatedTranscript[];
  ratings: TranscriptRating[];
}

export function emptyRatedCorpus(): RatedCorpus {
  return { transcripts: [], ratings: [] };
}

export interface EvaluatorAgreement {
  /** Behaviour scores compared. */
  compared: number;
  /** Mean absolute difference between the app's score and the human's, 0-1. */
  meanAbsoluteError: number;
  /** Behaviours where the app and the humans disagree most. */
  worst: { key: BehaviourKey; error: number }[];
  note: string;
}

/**
 * How closely the evaluator matches human judgement.
 *
 * Only transcripts rated by two or more people are used, and only behaviours
 * those raters agree on within 0.25. A single rater is one opinion, and
 * scoring the evaluator against one opinion measures agreement with a person
 * rather than with a judgement — the disagreement between raters is itself the
 * evidence about whether the behaviour is well enough defined to score at all.
 */
export function evaluatorAgreement(
  corpus: RatedCorpus,
  computed: Map<Id, { key: BehaviourKey; score: number }[]>,
): EvaluatorAgreement {
  const byTranscript = new Map<Id, TranscriptRating[]>();
  for (const rating of corpus.ratings) {
    const list = byTranscript.get(rating.transcriptId);
    if (list) list.push(rating);
    else byTranscript.set(rating.transcriptId, [rating]);
  }

  const errors: { key: BehaviourKey; error: number }[] = [];
  const active = new Set(corpus.transcripts.filter(isActive).map((t) => t.id));

  for (const [transcriptId, ratings] of byTranscript) {
    if (!active.has(transcriptId)) continue;
    const raters = new Set(ratings.map((r) => r.raterId));
    if (raters.size < 2) continue;
    const appScores = computed.get(transcriptId);
    if (!appScores) continue;

    const byKey = new Map<BehaviourKey, number[]>();
    for (const rating of ratings) {
      for (const item of rating.ratings) {
        const list = byKey.get(item.key);
        if (list) list.push(item.score);
        else byKey.set(item.key, [item.score]);
      }
    }

    for (const [key, scores] of byKey) {
      if (scores.length < 2) continue;
      const spread = Math.max(...scores) - Math.min(...scores);
      if (spread > 0.25) continue; // raters disagree; not a usable reference
      const human = scores.reduce((a, b) => a + b, 0) / scores.length;
      const app = appScores.find((s) => s.key === key);
      if (!app) continue;
      errors.push({ key, error: Math.abs(app.score - human) });
    }
  }

  if (errors.length === 0) {
    return {
      compared: 0,
      meanAbsoluteError: 0,
      worst: [],
      note: "No transcripts with two agreeing raters yet — the evaluator has not been checked against human judgement.",
    };
  }

  const meanAbsoluteError = errors.reduce((sum, e) => sum + e.error, 0) / errors.length;
  const worstByKey = new Map<BehaviourKey, number[]>();
  for (const e of errors) {
    const list = worstByKey.get(e.key);
    if (list) list.push(e.error);
    else worstByKey.set(e.key, [e.error]);
  }
  const worst = [...worstByKey.entries()]
    .map(([key, list]) => ({ key, error: list.reduce((a, b) => a + b, 0) / list.length }))
    .sort((a, b) => b.error - a.error)
    .slice(0, 3);

  return {
    compared: errors.length,
    meanAbsoluteError: Number(meanAbsoluteError.toFixed(3)),
    worst,
    note: `${errors.length} behaviour scores compared against agreeing human raters; mean absolute error ${meanAbsoluteError.toFixed(2)}.`,
  };
}

export interface CorpusEligibility {
  eligible: boolean;
  reasons: string[];
}

/** Whether the rated corpus is big enough to say anything about the evaluator. */
export function ratedCorpusEligibility(corpus: RatedCorpus, minTranscripts = 100): CorpusEligibility {
  const reasons: string[] = [];
  const active = corpus.transcripts.filter(isActive);
  if (active.length < minTranscripts) {
    reasons.push(`${active.length} donated transcripts; a reportable check needs at least ${minTranscripts}.`);
  }
  const doubleRated = new Set(
    [...new Map<Id, Set<string>>(
      corpus.ratings.reduce((map, r) => {
        const set = map.get(r.transcriptId) ?? new Set<string>();
        set.add(r.raterId);
        map.set(r.transcriptId, set);
        return map;
      }, new Map<Id, Set<string>>()),
    ).entries()]
      .filter(([, raters]) => raters.size >= 2)
      .map(([id]) => id),
  );
  if (doubleRated.size < minTranscripts) {
    reasons.push(`${doubleRated.size} transcripts have two or more raters; at least ${minTranscripts} must.`);
  }
  return { eligible: reasons.length === 0, reasons };
}

export const DONATION_METHODOLOGY =
  "Conversations are never collected in the ordinary course of using this app. A transcript reaches the " +
  "rated corpus only when a user reads that specific conversation, edits it, and consents to that one " +
  "donation; the edited copy is what is stored, in a separate place, unlinked to anything else, and it " +
  "can be withdrawn. Redaction suggestions are a lexical best effort and are presented as such — the " +
  "person donating is the last check, not the first.";
