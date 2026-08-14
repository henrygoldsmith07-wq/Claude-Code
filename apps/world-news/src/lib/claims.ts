// Claim-level verification.
//
// "Rebels seized the airport" and "The government says rebels seized the
// airport" are different statements, and a reader who cannot tell them apart
// has been misled by the interface rather than by any source. This module
// separates four kinds of statement and counts corroboration per claim:
//
//   confirmed   multiple independent accounts, stated without hedging
//   allegation  asserted by an interested party, or attributed and unverified
//   analysis    interpretation, inference, "what this means"
//   prediction  about the future — unverifiable now, by construction
//
// Classification is lexical and deterministic, which means it is wrong at the
// margins. Every verdict therefore carries its evidence, and the UI shows the
// evidence rather than the label alone. Hedged and attributed language is the
// signal that carries most of the weight, because that is what newsrooms
// actually use to mark the distinction.

import { extractEntities } from "./entities";
import { isWire, isOfficialHost } from "./dedup";
import type { SourceAttribution } from "./storyModel";

export type ClaimType = "confirmed" | "allegation" | "analysis" | "prediction";

export interface ClaimAssessment {
  text: string;
  type: ClaimType;
  /** 0..100 confidence in the *classification*, not in the claim's truth. */
  typeConfidence: number;
  /** Who the statement is attributed to, when the text says. */
  attributedTo: string[];
  /** Independent accounts supporting this specific claim. */
  corroboration: CorroborationCount;
  /** Hedging words found — the reason a claim was not marked confirmed. */
  hedges: string[];
  reasons: string[];
  disputed: boolean;
}

// ---------------------------------------------------------------------------
// Lexicons
// ---------------------------------------------------------------------------

/** Future reference — unverifiable at publication by definition. */
const PREDICTION = [
  /\bwill\s+(?:be|not|likely|probably)?\s*\w+/i,
  /\b(?:is|are)\s+(?:expected|set|due|forecast|projected|poised|likely)\s+to\b/i,
  /\bforecasts?\b|\bprojections?\b|\boutlook\b/i,
  /\bby\s+(?:20[2-9]\d|next\s+(?:year|month|week))\b/i,
  /\bplans?\s+to\b|\bintends?\s+to\b|\baims?\s+to\b/i,
  /\bcould\s+(?:reach|rise|fall|lead|trigger)\b/i,
];

/** Interpretation rather than observation. */
const ANALYSIS = [
  /\b(?:suggests?|indicates?|implies|points to|reflects?|signals?)\b/i,
  /\banalysts?\s+(?:say|believe|expect|note)\b/i,
  /\b(?:experts?|observers?|commentators?)\s+(?:say|argue|believe)\b/i,
  /\bwhat\s+this\s+means\b|\bthe\s+(?:implication|significance)\b/i,
  /\bis\s+seen\s+as\b|\bwidely\s+viewed\s+as\b/i,
  /\bmay\s+(?:reflect|signal|indicate)\b/i,
];

/** Attributed to an interested party, or explicitly unverified. */
const ALLEGATION = [
  /\balleged(?:ly)?\b|\ballegations?\b/i,
  /\baccus(?:es|ed|ation)\b/i,
  /\bclaim(?:s|ed)\b(?!\s+form)/i,
  /\breportedly\b|\bpurported(?:ly)?\b/i,
  /\bsuspected\b|\balleged\s+to\s+have\b/i,
  /\bdenied\b|\bdenies\b|\brejected\s+the\s+claim\b/i,
  /\bunverified\b|\bcould\s+not\s+be\s+(?:independently\s+)?verified\b/i,
  /\bhas\s+not\s+been\s+confirmed\b/i,
];

/** Explicit confirmation language. */
const CONFIRMATION = [
  /\bconfirmed\b|\bconfirms\b/i,
  /\bofficial(?:ly)?\s+(?:said|announced|stated|confirmed)\b/i,
  /\bannounced\b|\bsaid\s+in\s+a\s+statement\b/i,
  /\bverified\b|\bindependently\s+confirmed\b/i,
];

/** Hedges that stop a statement being reported as settled fact. */
const HEDGES = [
  "reportedly", "allegedly", "apparently", "seemingly", "possibly", "probably",
  "may", "might", "could", "appears to", "is thought to", "is believed to",
  "unconfirmed", "unverified", "sources say", "according to reports",
];

/** Attribution patterns: "X said", "according to X", "X told Y". */
const ATTRIBUTION_PATTERNS = [
  // Explicit [Aa] rather than the /i flag: the flag would also relax [A-Z],
  // which is what distinguishes a named body from ordinary prose.
  /[Aa]ccording to (?:the\s+)?([A-Z][\w.'-]*(?:\s+(?:[a-z]{1,3}\s+)?[A-Z][\w.'-]*){0,3})/g,
  /([A-Z][\w.'-]*(?:\s+(?:[a-z]{1,3}\s+)?[A-Z][\w.'-]*){0,3})\s+(?:said|says|told|stated|announced|claimed|alleged)\b/g,
  /\b((?:government|ministry|police|army|military|officials?|prosecutors?|investigators?|witnesses?|residents?)\b[\w\s]{0,20}?)\s+(?:said|says|told|reported|claimed)\b/gi,
];

/** Extract who a statement is attributed to. */
export function attributionOf(text: string): string[] {
  const found = new Set<string>();
  for (const p of ATTRIBUTION_PATTERNS) {
    // Patterns are module-level with /g, so reset before each use.
    p.lastIndex = 0;
    for (const m of text.matchAll(p)) {
      const who = m[1]?.trim().replace(/\s+/g, " ");
      if (who && who.length >= 3 && who.length <= 60) found.add(who);
    }
  }
  return [...found].slice(0, 4);
}

function matchCount(text: string, patterns: RegExp[]): number {
  let n = 0;
  for (const p of patterns) if (p.test(text)) n++;
  return n;
}

function hedgesIn(text: string): string[] {
  const lower = text.toLowerCase();
  return HEDGES.filter((h) => lower.includes(h));
}

// ---------------------------------------------------------------------------
// Corroboration
// ---------------------------------------------------------------------------

export interface CorroborationCount {
  /** Sources whose text supports this specific claim. */
  supporting: number;
  /** Of those, how many are independent of each other. */
  independent: number;
  /** Publishers, for display. */
  publishers: string[];
  /** True when at least one primary/official source supports it. */
  hasPrimary: boolean;
  note: string;
}

/**
 * Group sources that are not independent of one another.
 *
 * Independence is the whole point of a corroboration count. Two mastheads owned
 * by the same group running the same wire copy is one account, and counting it
 * as three is the failure mode this guards against. Ownership comes from the
 * source registry when available; wires collapse together because a story
 * carried by five outlets from one wire has one origin.
 */
export function independenceGroups(
  sources: SourceAttribution[],
  ownerOf?: (publisher: string) => string | undefined,
): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  for (const s of sources) {
    const pub = s.publisher ?? "unknown";
    const owner = ownerOf?.(pub);
    // Wires share an origin with everyone carrying them, but two *different*
    // wires are genuinely independent, so key on the wire itself.
    const key = owner ?? (isWire(pub) ? `wire:${pub}` : `pub:${pub}`);
    const g = groups.get(key);
    if (g) g.push(pub);
    else groups.set(key, [pub]);
  }
  return groups;
}

/**
 * Crude suffix stripping. Not linguistics — just enough that "extend",
 * "extends" and "extended" are recognised as the same assertion, which is the
 * difference between counting a corroborating source and missing it.
 */
function contentStems(text: string, minLength = 5): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .split(/\s+/)
    .filter((w) => w.length >= minLength)
    .map((w) => w.replace(/(?:edly|ing|ed|es|s)$/, ""))
    .filter((w) => w.length >= 3);
}

/**
 * Count the sources that actually support one claim.
 *
 * A source supports a claim when their texts share the claim's distinctive
 * content — entities plus rare content words. This is deliberately strict:
 * being in the same cluster means covering the same event, not asserting the
 * same thing, and conflating the two is how "8 sources confirm" ends up
 * attached to a detail only one of them reported.
 */
export function corroborationFor(
  claim: string,
  sources: SourceAttribution[],
  ownerOf?: (publisher: string) => string | undefined,
): CorroborationCount {
  const claimEnt = new Set(extractEntities(claim).ids);
  const claimWords = new Set(contentStems(claim));

  const supporters = sources.filter((s) => {
    const text = `${s.title ?? ""}`;
    const ents = new Set(extractEntities(text).ids);
    let sharedEnt = 0;
    for (const e of claimEnt) if (ents.has(e)) sharedEnt++;
    const words = new Set(contentStems(text, 3));
    let sharedWords = 0;
    for (const w of claimWords) if (words.has(w)) sharedWords++;
    // Either a shared named actor plus a content word, or several content words.
    return (sharedEnt >= 1 && sharedWords >= 1) || sharedWords >= 3;
  });

  const groups = independenceGroups(supporters, ownerOf);
  const hasPrimary = supporters.some((s) => s.isPrimary || isOfficialHost(s.url));
  const publishers = [...new Set(supporters.map((s) => s.publisher ?? "unknown"))];
  const independent = groups.size;
  const note =
    supporters.length === 0
      ? "No source text in this story explicitly supports this statement."
      : independent === 1 && supporters.length > 1
        ? `${supporters.length} sources, but they are not independent of each other — treat as one account.`
        : independent === 1
          ? "Single account — not yet corroborated."
          : `${independent} independent accounts support this.`;
  return { supporting: supporters.length, independent, publishers: publishers.slice(0, 6), hasPrimary, note };
}

// ---------------------------------------------------------------------------
// Classification
// ---------------------------------------------------------------------------

/**
 * Classify one statement and attach its evidence.
 *
 * Order matters: prediction beats everything (a forecast attributed to an
 * official is still a forecast), then allegation, then analysis. "Confirmed" is
 * the only label that requires evidence beyond the words — either explicit
 * confirmation language or genuinely independent corroboration — because it is
 * the only label that tells the reader they can rely on it.
 */
export function classifyClaim(
  text: string,
  sources: SourceAttribution[] = [],
  options: { disputed?: boolean; ownerOf?: (publisher: string) => string | undefined } = {},
): ClaimAssessment {
  const reasons: string[] = [];
  const attributedTo = attributionOf(text);
  const hedges = hedgesIn(text);
  const corroboration = corroborationFor(text, sources, options.ownerOf);

  const pred = matchCount(text, PREDICTION);
  const alleg = matchCount(text, ALLEGATION);
  const anal = matchCount(text, ANALYSIS);
  const conf = matchCount(text, CONFIRMATION);

  let type: ClaimType;
  let typeConfidence: number;

  if (pred > 0 && pred >= anal) {
    type = "prediction";
    typeConfidence = Math.min(95, 55 + pred * 15);
    reasons.push("States something about the future — cannot be verified now");
  } else if (alleg > 0) {
    type = "allegation";
    typeConfidence = Math.min(95, 55 + alleg * 15);
    reasons.push("Attributed or explicitly unverified language");
    if (attributedTo.length) reasons.push(`Asserted by: ${attributedTo.join(", ")}`);
  } else if (anal > 0) {
    type = "analysis";
    typeConfidence = Math.min(90, 50 + anal * 15);
    reasons.push("Interpretation rather than an observed event");
  } else if (conf > 0 || corroboration.independent >= 2) {
    type = "confirmed";
    typeConfidence = conf > 0 && corroboration.independent >= 2 ? 90 : 65;
    if (conf > 0) reasons.push("Stated as confirmed or officially announced");
    if (corroboration.independent >= 2) reasons.push(corroboration.note);
    if (corroboration.hasPrimary) reasons.push("Primary or official source among the supporters");
  } else {
    // Reported without hedging, but without independent support either. The
    // "allegation" bucket is labelled "Attributed / unverified", and an
    // assertion resting on one account is exactly that — calling it analysis
    // would imply someone was interpreting rather than asserting.
    type = "allegation";
    typeConfidence = 45;
    reasons.push(
      attributedTo.length > 0
        ? `Rests on a single account (${attributedTo[0]})`
        : "Asserted without attribution and without independent corroboration",
    );
  }

  // Hedged language can never be "confirmed", whatever else matched.
  if (type === "confirmed" && hedges.length > 0) {
    type = "allegation";
    typeConfidence = 60;
    reasons.push(`Hedged wording (${hedges.slice(0, 2).join(", ")}) — not stated as settled`);
  }

  return {
    text,
    type,
    typeConfidence,
    attributedTo,
    corroboration,
    hedges,
    reasons: reasons.slice(0, 4),
    disputed: Boolean(options.disputed),
  };
}

// ---------------------------------------------------------------------------
// Disputed facts
// ---------------------------------------------------------------------------

export interface DisputedFact {
  /** What the disagreement is about, in one phrase. */
  dimension: string;
  sides: { claim: string; attributedTo: string[]; corroboration: CorroborationCount }[];
  /** "unresolved" until a source explicitly settles it. */
  status: "disputed" | "resolved";
  resolution?: string;
  /** Plain-language framing for the reader. */
  summary: string;
}

/** Dimensions worth naming when two accounts disagree. */
const DIMENSION_HINTS: [RegExp, string][] = [
  [/\b(killed|dead|deaths?|casualt|injur|wounded|toll)\b/i, "casualty figures"],
  [/\b(detain|arrest|held|custody)\w*\b/i, "how many were detained"],
  [/\b(started|initiated|first|began|provoked|responsible)\b/i, "who acted first"],
  [/\b(legal|lawful|authority|mandate|jurisdiction|treaty)\b/i, "legal basis"],
  [/\b(cause|caused|due to|because|blamed)\b/i, "cause"],
  [/\b(number|count|total|figure|\d+)\b/i, "the figures"],
  [/\b(location|where|site|territory|border)\b/i, "where it happened"],
  [/\b(agreed|deal|terms|signed)\b/i, "what was agreed"],
];

function dimensionFor(a: string, b: string): string {
  const both = `${a} ${b}`;
  for (const [re, label] of DIMENSION_HINTS) if (re.test(both)) return label;
  return "the account of events";
}

/**
 * Represent a disagreement as a disagreement.
 *
 * The failure mode this avoids is presenting one side as the story and the
 * other as a footnote. Both sides get the same structure and the same
 * corroboration treatment, and neither is adjudicated — the reader is told
 * what is contested and who says what, which is the honest output when the
 * facts are not settled.
 */
export function buildDisputedFact(
  claim: string,
  claimSources: SourceAttribution[],
  counterClaim: string,
  counterSources: SourceAttribution[],
  options: { dimension?: string; resolution?: string; ownerOf?: (publisher: string) => string | undefined } = {},
): DisputedFact {
  const dimension = options.dimension ?? dimensionFor(claim, counterClaim);
  const sides = [
    { claim, attributedTo: attributionOf(claim), corroboration: corroborationFor(claim, claimSources, options.ownerOf) },
    { claim: counterClaim, attributedTo: attributionOf(counterClaim), corroboration: corroborationFor(counterClaim, counterSources, options.ownerOf) },
  ];
  const status = options.resolution ? "resolved" : "disputed";
  const summary = options.resolution
    ? `Resolved: ${options.resolution}`
    : `Accounts differ on ${dimension}. Neither version is independently settled here.`;
  return { dimension, sides, status, resolution: options.resolution, summary };
}

// ---------------------------------------------------------------------------
// Story-level rollup
// ---------------------------------------------------------------------------

export interface ClaimBreakdown {
  confirmed: ClaimAssessment[];
  allegations: ClaimAssessment[];
  analysis: ClaimAssessment[];
  predictions: ClaimAssessment[];
  /** One line the UI can show above the list. */
  summary: string;
}

/** Split a story's statements into the four kinds, preserving the evidence. */
export function breakdownClaims(
  statements: string[],
  sources: SourceAttribution[],
  options: { disputedTexts?: string[]; ownerOf?: (publisher: string) => string | undefined } = {},
): ClaimBreakdown {
  const disputedSet = new Set((options.disputedTexts ?? []).map((t) => t.toLowerCase().trim()));
  const assessed = statements.map((s) =>
    classifyClaim(s, sources, { disputed: disputedSet.has(s.toLowerCase().trim()), ownerOf: options.ownerOf }),
  );
  const of = (t: ClaimType) => assessed.filter((a) => a.type === t);
  const confirmed = of("confirmed");
  const allegations = of("allegation");
  const analysis = of("analysis");
  const predictions = of("prediction");
  const parts: string[] = [];
  if (confirmed.length) parts.push(`${confirmed.length} corroborated`);
  if (allegations.length) parts.push(`${allegations.length} attributed or unverified`);
  if (analysis.length) parts.push(`${analysis.length} interpretation`);
  if (predictions.length) parts.push(`${predictions.length} forward-looking`);
  return {
    confirmed,
    allegations,
    analysis,
    predictions,
    summary: parts.length ? `Of ${assessed.length} statements: ${parts.join(", ")}.` : "No statements to assess.",
  };
}

export const CLAIM_TYPE_LABEL: Record<ClaimType, string> = {
  confirmed: "Corroborated",
  allegation: "Attributed / unverified",
  analysis: "Interpretation",
  prediction: "Forward-looking",
};

export const CLAIM_METHODOLOGY =
  "Statements are sorted by how they are worded and how many independent accounts support them. " +
  "'Corroborated' means two or more sources that are not owned by the same group and are not running " +
  "the same wire copy. 'Attributed' means one party asserts it. Nothing here adjudicates truth — " +
  "follow the source links.";
