import { GoogleGenAI } from "@google/genai";
import {
  buildSourceMix,
  inferSourceAttribution,
  type NewsMeta,
  type Perspective,
  type SourceAttribution,
  type StoryCluster,
  type TimelineEvent,
} from "./storyModel";

// gemini-2.0-flash reliably returns grounded JSON with Google Search and has a
// generous free-tier daily quota (~200 requests/day). gemini-2.5-flash-lite was
// tried for its larger quota but frequently returned empty grounded responses,
// so summaries came back blank. With per-day caching + snapshots each place is
// generated at most once a day, so 200/day is ample.
const MODEL = "gemini-2.0-flash";

// Fixed topic set every country summary is organised into. Kept stable so the
// UI can render consistent sections regardless of what Gemini returns.
export const TOPICS = [
  "Politics",
  "Economy & Business",
  "World & Conflict",
  "Science & Health",
  "Technology",
  "Society & Culture",
  "Sport",
] as const;

export type Topic = (typeof TOPICS)[number];

export interface TopicSummary {
  topic: string;
  summary: string;
  keyPoints: string[];
}

export interface NewsSource {
  title: string;
  url: string;
}

// A single geolocated news item, plotted as a dot on the maps.
export interface NewsPoint {
  topic: string;
  headline: string;
  location: string;
  lat: number;
  lng: number;
  // ISO 3166-1 alpha-2 of the country the item is in ("" if unknown). Used to
  // relate news across countries when hovering.
  countryCode: string;
  // Short lowercase tags (entities/themes) that let related items be linked.
  tags: string[];
}

// An active conflict / front line, drawn as a multi-point line in war-map mode.
// `path` is an ordered list of [lat, lng] points tracing the front's geography.
export interface ConflictLine {
  label: string;
  path: [number, number][];
}

export interface CountryNews {
  country: string;
  code: string;
  generatedAt: string;
  topics: TopicSummary[];
  sources: NewsSource[];
  points: NewsPoint[];
  conflicts: ConflictLine[];
  /** Story clusters — the repositioned unit of understanding. Optional for back-compat with old snapshots. */
  stories: StoryCluster[];
  /** Page-level meta: what is agreed, uncertain, missing, corrected, and what changed since yesterday. */
  meta: NewsMeta;
}

// Raised when GEMINI_API_KEY isn't configured, so callers can render a clear
// "add your key" state instead of a 500.
export class MissingApiKeyError extends Error {
  constructor() {
    super("GEMINI_API_KEY is not configured.");
    this.name = "MissingApiKeyError";
  }
}

// Raised when Gemini returns 429 (quota / rate limit) so the page can show a
// clear "try again shortly" message instead of a generic failure.
export class RateLimitError extends Error {
  constructor() {
    super("Gemini rate limit or quota exceeded.");
    this.name = "RateLimitError";
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// Gemini's 429 body often carries a RetryInfo hint ("retryDelay": "24s"). The
// SDK doesn't surface it as a typed field, so read it off the message text
// best-effort. Capped, because a per-minute limit shouldn't make us sit out a
// hint measured in minutes — we'd rather back off our own way and move on.
const MAX_RETRY_HINT_MS = 30_000;

// How many times to sweep the whole key set before declaring the limit real,
// and the base delay between sweeps. Three rounds costs at most ~6s of waiting
// on top of the API's own hints — cheap next to losing a place's summary.
const RATE_LIMIT_ROUNDS = 3;
const RATE_LIMIT_BASE_MS = 2_000;

function retryHintMs(error: unknown): number | null {
  const message = (error as { message?: unknown })?.message;
  if (typeof message !== "string") return null;
  const match = /"?retryDelay"?\s*[:=]\s*"?(\d+(?:\.\d+)?)s/i.exec(message);
  if (!match) return null;
  const seconds = Number(match[1]);
  if (!Number.isFinite(seconds) || seconds <= 0) return null;
  return Math.min(seconds * 1000, MAX_RETRY_HINT_MS);
}

// All configured Gemini API keys, in priority order. Extra free keys (each on
// its own Google account) multiply the daily quota — the app rotates to the
// next key when one hits its 429 daily cap. Provide keys either as a single
// comma/space/newline-separated list in GEMINI_API_KEYS (easiest for many), or
// as individually numbered vars GEMINI_API_KEY, GEMINI_API_KEY_2 … up to _20.
function getApiKeys(): string[] {
  const raw: (string | undefined)[] = [
    ...(process.env.GEMINI_API_KEYS ?? "").split(/[\s,]+/),
    process.env.GEMINI_API_KEY,
  ];
  for (let i = 2; i <= 20; i++) raw.push(process.env[`GEMINI_API_KEY_${i}`]);

  const keys = Array.from(
    new Set(raw.map((k) => k?.trim()).filter((k): k is string => Boolean(k))),
  );
  if (keys.length === 0) throw new MissingApiKeyError();
  return keys;
}

// ---------------------------------------------------------------------------
// Prompts — repositioned from "impartial AI news" to:
// "Understand what happened, where it happened, who is reporting it and where accounts differ."
// ---------------------------------------------------------------------------

function editorialGuardrails(): string {
  return `HARD RULES — never violate:
- NEVER invent causality. Only describe causes if a source explicitly states a cause. Use temporal sequencing ("then", "after") not causal ("because", "led to", "triggered") unless an official/investigation attributes the cause. Timeline = observed sequence, not explanation.
- Distinguish reported facts from interpretation: every factual sentence must be traceable to a listed source URL. Interpretive synthesis must be phrased as interpretation ("analysts interpret…", "coverage frames this as…") and kept separate from widelyAgreedFacts.
- Grounding: every story source URL must be a real URL found via Google Search — never invent URLs. If you cannot ground a claim, list it under uncertainty or omit it.
- Provenance: each story must be verifiable via live links; keyPoints should map to a source chunk when possible.`;
}

function sharedStoryInstructions(): string {
  return `For story clustering, return 3–6 STORIES (not one per topic) — each story is a distinct real-world EVENT (not just an article). An event evolves: multiple articles over time describe the same event merging into one story with a timeline and update history.
For each story provide:
- id (slug, e.g. "election-ruling"), headline (concise, event-centric), topic (one of ${TOPICS.join(", ")}), summary (2–4 neutral sentences — factual sentences attributed, interpretive sentences flagged; see guardrails), keyPoints (2–4 bullets, each live-linkable to a source).
- location {label, lat, lng, countryCode} when geolocatable; if the event spans multiple countries, set countryCode to the primary and list others in coverageGaps — multi-country handling.
- sources: 3–8 attributions, each {url, title, publisher, countryCode (ISO2), perspective (left|center-left|center|center-right|right|unknown), isPrimary (true for .gov/.int/official statements/primary docs), sourceKind (newsroom|wire|official|expert|document|unknown), confidence (high|medium|low that this URL supports the story)} — mix wire, newsroom, official and expert when available for diversity.
- primarySources: subset that are primary (official docs, statements, transcripts, data releases).
- timeline: 2–6 dated events [{date: "YYYY-MM-DD" or precise label, label: "what happened", kind: "reported"|"correction"|"update"}] in strict chronological order; see causality rule.
- conflictingClaims: where outlets disagree, 1–3 items [{claim, attributedTo: ["outlet/person"], counterClaim, counterAttributedTo: ["…"], disagreementDimension: "e.g. casualty count / who initiated / legal authority", context?: "one sentence"}]. If no conflict, [].
- widelyAgreedFacts: 2–4 facts every credible source agrees on (with supporting source implied).
- uncertainty: 1–3 things still unknown or disputed.
- corrections: [] unless a major outlet issued a correction; then [{date, note}] — track update history transparently.
- coverageGaps: 1–3 gaps — what is thin, missing, or inaccessible (e.g. undercovered region, only one country's press, thin non-English coverage).
- historicalContext: 0–2 short strings of prior related events (e.g. "EU AI Act passed 2024") to show continuity.
- significance: editorial significance 0..100 (not popularity) — weight corroboration breadth, cross-border coverage, primary sources and recency; plus significanceReasons: 2–3 short reasons why scored that way.
- methodology: {provenanceNote: "one sentence on how claims were sourced/verified", coverageScore: 0..100 heuristic}
${editorialGuardrails()}`;
}

function sharedMetaInstructions(): string {
  return `Also return page-level meta (all required):
{
  "widelyAgreedFacts": ["fact every outlet agrees on"], // 2–4 — reported, grounded facts only
  "uncertainty": ["what is still unknown"], // 1–3
  "coverageGaps": ["what we cannot verify or where coverage is thin"], // 1–3 — call out Anglophone bias and sparse regions
  "corrections": [{"date":"YYYY-MM-DD","note":"what was corrected"}], // usually [] — update history when present
  "whatChangedSinceYesterday": "1–2 sentence summary of what actually changed since yesterday, or null if unknown", // null when no prior snapshot; be specific: new casualties, new ruling, new strike, etc.
  "provenanceNote": "one sentence: how this page's claims were sourced/verified and that timelines are observed sequences not causal explanations"
}`;
}

function buildPrompt(countryName: string): string {
  return `You are a rigorous international news editor. Using Google Search, find the most important and recent news about ${countryName} (focus on roughly the last 7 days).

Purpose: Help the reader understand WHAT happened, WHERE it happened, WHO is reporting it and WHERE accounts differ.

Summarise it organised into these topics: ${TOPICS.join(", ")}.

Editorial rules — neutral and attributable:
- Plain, factual, non-partisan tone. No loaded or emotive language.
- Attribute contested claims (\"the government says…\", \"opposition figures argue…\") rather than asserting one side as fact.
- Prefer verifiable, recent developments over speculation or opinion.
- Only include a topic if there is genuinely noteworthy recent news for it. Omit topics with nothing to report rather than padding.
- Every factual sentence should be traceable to a source you list.

Return ONLY a single JSON object (no prose, no markdown fences) with this exact shape:
{
  \"topics\": [
    { \"topic\": \"<one of the topic names above>\", \"summary\": \"<2-4 sentence neutral summary>\", \"keyPoints\": [\"<short factual bullet>\", \"...\"] }
  ],
  \"points\": [
    { \"topic\": \"<one of the topic names above>\", \"headline\": \"<short headline of a specific news item>\", \"location\": \"<city or region name>\", \"lat\": <decimal latitude>, \"lng\": <decimal longitude>, \"countryCode\": \"<ISO 3166-1 alpha-2 country code>\", \"tags\": [\"<2-4 short lowercase tags: key people, organisations, or themes>\"] }
  ],
  \"conflicts\": [
    { \"label\": \"<short name of an active conflict / front line>\", \"path\": [[<lat>, <lng>], [<lat>, <lng>], [<lat>, <lng>]] }
  ],
  \"stories\": [ { \"id\":\"<slug>\", \"headline\":\"...\", \"topic\":\"...\", \"summary\":\"...\", \"keyPoints\":[\"...\"], \"location\": {\"label\":\"...\",\"lat\":0,\"lng\":0,\"countryCode\":\"XX\"}, \"sources\":[{\"url\":\"https://...\",\"title\":\"...\",\"publisher\":\"...\",\"countryCode\":\"XX\",\"perspective\":\"center\",\"isPrimary\":false}], \"primarySources\":[{\"url\":\"...\",\"title\":\"...\"}], \"timeline\":[{\"date\":\"YYYY-MM-DD\",\"label\":\"...\"}], \"conflictingClaims\":[{\"claim\":\"...\",\"attributedTo\":[\"...\"],\"counterClaim\":\"...\",\"counterAttributedTo\":[\"...\"]}], \"widelyAgreedFacts\":[\"...\"], \"uncertainty\":[\"...\"], \"corrections\":[{\"date\":\"...\",\"note\":\"...\"}], \"coverageGaps\":[\"...\"] } ],
  \"meta\": { \"widelyAgreedFacts\":[\"...\"], \"uncertainty\":[\"...\"], \"coverageGaps\":[\"...\"], \"corrections\":[{\"date\":\"...\",\"note\":\"...\"}], \"whatChangedSinceYesterday\": \"... or null\" }
}
Each topic summary: 2–4 sentences with 2–4 keyPoints. For points, give 5–12 specific, geolocatable news items within ${countryName}, each with approximate real coordinates, ISO code, and 2–4 lowercase tags (shared tags should link related stories). For conflicts, only include active armed conflicts relevant to ${countryName} as an ordered path of 8–20 [lat,lng] points closely following real geography (not a straight line). Use [] if none.
${sharedStoryInstructions()}
${sharedMetaInstructions()}
If there is no meaningful recent news for ${countryName} at all, return {\"topics\": [], \"points\": [], \"conflicts\": [], \"stories\": [], \"meta\": {\"widelyAgreedFacts\":[],\"uncertainty\":[],\"coverageGaps\":[],\"corrections\":[],\"whatChangedSinceYesterday\":null}}.
Grounding: every story source URL must be a real URL you found via Google Search. Never invent URLs.`;
}

function buildWorldPrompt(): string {
  return `You are a rigorous international news editor. Using Google Search, find the most important news happening around the world right now (focus on roughly the last 7 days). Prioritise globally significant developments across multiple regions, not just one country.

Purpose: Help the reader understand WHAT happened, WHERE it happened, WHO is reporting it and WHERE accounts differ.

Summarise it organised into these topics: ${TOPICS.join(", ")}.

Editorial rules — neutral and attributable:
- Plain, factual, non-partisan tone. No loaded or emotive language.
- Attribute contested claims rather than asserting one side as fact.
- Prefer verifiable, recent developments over speculation or opinion.
- Draw from different parts of the world; don't over-index on a single country.
- Only include a topic if there is genuinely noteworthy recent news for it.
- Every factual sentence should be traceable to a source you list.

Return ONLY a single JSON object (no prose, no markdown fences) with this exact shape:
{
  \"topics\": [
    { \"topic\": \"<one of the topic names above>\", \"summary\": \"<2-4 sentence neutral summary>\", \"keyPoints\": [\"<short factual bullet>\", \"...\"] }
  ],
  \"points\": [
    { \"topic\": \"<one of the topic names above>\", \"headline\": \"<short headline of a specific news item>\", \"location\": \"<city or region name>\", \"lat\": <decimal latitude>, \"lng\": <decimal longitude>, \"countryCode\": \"<ISO 3166-1 alpha-2 country code>\", \"tags\": [\"<2-4 short lowercase tags: key people, organisations, or themes>\"] }
  ],
  \"conflicts\": [
    { \"label\": \"<short name of an active conflict / front line>\", \"path\": [[<lat>, <lng>], [<lat>, <lng>], [<lat>, <lng>]] }
  ],
  \"stories\": [ { \"id\":\"<slug>\", \"headline\":\"...\", \"topic\":\"...\", \"summary\":\"...\", \"keyPoints\":[\"...\"], \"location\": {\"label\":\"...\",\"lat\":0,\"lng\":0,\"countryCode\":\"XX\"}, \"sources\":[{\"url\":\"https://...\",\"title\":\"...\",\"publisher\":\"...\",\"countryCode\":\"XX\",\"perspective\":\"center\",\"isPrimary\":false}], \"primarySources\":[{\"url\":\"...\",\"title\":\"...\"}], \"timeline\":[{\"date\":\"YYYY-MM-DD\",\"label\":\"...\"}], \"conflictingClaims\":[{\"claim\":\"...\",\"attributedTo\":[\"...\"],\"counterClaim\":\"...\",\"counterAttributedTo\":[\"...\"]}], \"widelyAgreedFacts\":[\"...\"], \"uncertainty\":[\"...\"], \"corrections\":[{\"date\":\"...\",\"note\":\"...\"}], \"coverageGaps\":[\"...\"] } ],
  \"meta\": { \"widelyAgreedFacts\":[\"...\"], \"uncertainty\":[\"...\"], \"coverageGaps\":[\"...\"], \"corrections\":[{\"date\":\"...\",\"note\":\"...\"}], \"whatChangedSinceYesterday\": \"... or null\" }
}
Each summary: 2–4 sentences with 2–4 keyPoints. For points, give 10–20 specific, geolocatable items from around the world spread across different regions, each with approximate real coordinates, ISO code, and 2–4 lowercase tags (use the SAME tag on stories that are part of the same event so related news can be linked). For conflicts, include major active armed conflicts worldwide as 8–20 point paths. Use [] if none.
${sharedStoryInstructions()}
${sharedMetaInstructions()}
Grounding: every story source URL must be a real URL you found via Google Search. Never invent URLs.`;
}

// Pull a JSON object out of the model's text, tolerating stray prose or code
// fences the model may add despite instructions.
function extractJson(text: string): {
  topics: TopicSummary[];
  points: NewsPoint[];
  conflicts: ConflictLine[];
  stories: unknown;
  meta: unknown;
} {
  let candidate = text.trim();
  const fence = candidate.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) candidate = fence[1].trim();
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start !== -1 && end !== -1 && end > start) {
    candidate = candidate.slice(start, end + 1);
  }
  const parsed = JSON.parse(candidate) as {
    topics?: unknown;
    points?: unknown;
    conflicts?: unknown;
    stories?: unknown;
    meta?: unknown;
  };
  return {
    topics: Array.isArray(parsed.topics) ? (parsed.topics as TopicSummary[]) : [],
    points: Array.isArray(parsed.points) ? (parsed.points as NewsPoint[]) : [],
    conflicts: Array.isArray(parsed.conflicts) ? (parsed.conflicts as ConflictLine[]) : [],
    stories: parsed.stories,
    meta: parsed.meta,
  };
}

const isFiniteNum = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const inLatRange = (n: number) => n >= -90 && n <= 90;
const inLngRange = (n: number) => n >= -180 && n <= 180;

// ---------------------------------------------------------------------------
// Normalizers — keep the app stable even when the model drifts.
// ---------------------------------------------------------------------------

// Keep only well-formed points with valid coordinates, tagged to a known topic.
function normalisePoints(raw: NewsPoint[]): NewsPoint[] {
  const points: NewsPoint[] = [];
  for (const p of raw) {
    if (!p || typeof p.headline !== "string" || !p.headline.trim()) continue;
    if (!isFiniteNum(p.lat) || !isFiniteNum(p.lng)) continue;
    if (!inLatRange(p.lat) || !inLngRange(p.lng)) continue;
    const topic =
      TOPICS.find((t) => t.toLowerCase() === String(p.topic).trim().toLowerCase()) ?? "";
    const tags = Array.isArray(p.tags)
      ? Array.from(
          new Set(
            p.tags
              .filter((t): t is string => typeof t === "string")
              .map((t) => t.trim().toLowerCase())
              .filter(Boolean),
          ),
        ).slice(0, 5)
      : [];
    const countryCode =
      typeof p.countryCode === "string" && /^[A-Za-z]{2}$/.test(p.countryCode.trim())
        ? p.countryCode.trim().toUpperCase()
        : "";
    points.push({
      topic,
      headline: p.headline.trim(),
      location: typeof p.location === "string" ? p.location.trim() : "",
      lat: p.lat,
      lng: p.lng,
      countryCode,
      tags,
    });
  }
  return points.slice(0, 40);
}

// Keep only conflict lines with a valid multi-point coordinate path.
function normaliseConflicts(raw: unknown[]): ConflictLine[] {
  const conflicts: ConflictLine[] = [];
  for (const item of raw) {
    const c = item as { label?: unknown; path?: unknown };
    if (!c || typeof c.label !== "string" || !c.label.trim()) continue;
    if (!Array.isArray(c.path)) continue;
    const path: [number, number][] = [];
    for (const pt of c.path) {
      if (!Array.isArray(pt) || pt.length < 2) continue;
      const [lat, lng] = pt as [unknown, unknown];
      if (!isFiniteNum(lat) || !isFiniteNum(lng)) continue;
      if (!inLatRange(lat) || !inLngRange(lng)) continue;
      path.push([lat, lng]);
      if (path.length >= 24) break;
    }
    if (path.length < 2) continue;
    conflicts.push({ label: c.label.trim(), path });
  }
  return conflicts.slice(0, 20);
}

// Normalise/validate model output into clean TopicSummary rows, dropping
// anything malformed and ordering by our canonical topic list.
function normaliseTopics(raw: TopicSummary[]): TopicSummary[] {
  const byTopic = new Map<string, TopicSummary>();
  for (const row of raw) {
    if (!row || typeof row.topic !== "string" || typeof row.summary !== "string") continue;
    const topic = TOPICS.find((t) => t.toLowerCase() === row.topic.trim().toLowerCase());
    if (!topic || byTopic.has(topic)) continue;
    const keyPoints = Array.isArray(row.keyPoints)
      ? row.keyPoints.filter((p): p is string => typeof p === "string" && p.trim().length > 0)
      : [];
    if (!row.summary.trim()) continue;
    byTopic.set(topic, { topic, summary: row.summary.trim(), keyPoints });
  }
  return TOPICS.map((t) => byTopic.get(t)).filter((r): r is TopicSummary => Boolean(r));
}

// ---------------------------------------------------------------------------
// Story normalizers
// ---------------------------------------------------------------------------

const VALID_PERSPECTIVES: Set<Perspective> = new Set([
  "left",
  "center-left",
  "center",
  "center-right",
  "right",
  "unknown",
]);

function normalisePerspective(v: unknown): Perspective {
  if (typeof v !== "string") return "unknown";
  const s = v.trim().toLowerCase() as Perspective;
  return VALID_PERSPECTIVES.has(s) ? s : "unknown";
}

function normaliseSourceAttribution(raw: unknown, groundingUrls: Set<string>): SourceAttribution | null {
  const r = raw as Record<string, unknown>;
  if (!r || typeof r.url !== "string" || !r.url.trim()) return null;
  const url = r.url.trim();
  if (!/^https?:\/\/.+/i.test(url)) return null;
  const title = typeof r.title === "string" && r.title.trim() ? r.title.trim() : url;
  const inferred = inferSourceAttribution(url, title);
  const publisher =
    typeof r.publisher === "string" && r.publisher.trim() ? r.publisher.trim() : inferred.publisher;
  const countryCode =
    typeof r.countryCode === "string" && /^[A-Za-z]{2}$/.test(r.countryCode.trim())
      ? r.countryCode.trim().toUpperCase()
      : inferred.countryCode;
  const perspective = normalisePerspective(r.perspective ?? inferred.perspective);
  const isPrimary = r.isPrimary === true || inferred.isPrimary === true ? true : undefined;
  const validKinds = new Set(["newsroom","wire","official","expert","document","unknown"]);
  const rawKind = typeof r.sourceKind === "string" ? r.sourceKind.trim().toLowerCase() : "";
  const sourceKind = validKinds.has(rawKind) ? (rawKind as SourceAttribution["sourceKind"]) : inferred.sourceKind;
  const validConf = new Set(["high","medium","low"]);
  const rawConf = typeof r.confidence === "string" ? r.confidence.trim().toLowerCase() : "";
  const confidence = validConf.has(rawConf) ? (rawConf as SourceAttribution["confidence"]) : undefined;
  const publishedAt = typeof r.publishedAt === "string" && r.publishedAt.trim() ? r.publishedAt.trim().slice(0, 48) : undefined;
  void groundingUrls;
  return { url, title, publisher, countryCode, perspective, isPrimary, sourceKind, confidence, publishedAt };
}

function dedupeAttributions(list: SourceAttribution[]): SourceAttribution[] {
  const seen = new Set<string>();
  const out: SourceAttribution[] = [];
  for (const s of list) {
    const key = s.url;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

export function normaliseStories(
  raw: unknown,
  groundingUrls: Set<string>,
  groundingSources: NewsSource[],
): StoryCluster[] {
  if (!Array.isArray(raw)) return [];
  const out: StoryCluster[] = [];
  for (const item of raw) {
    const r = item as Record<string, unknown>;
    if (!r || typeof r.headline !== "string" || !r.headline.trim()) continue;
    const id =
      typeof r.id === "string" && r.id.trim()
        ? r.id.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64)
        : r.headline.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 64);
    const maybeTopic = typeof r.topic === "string" ? r.topic.trim() : "";
    const matched = maybeTopic ? TOPICS.find((t) => t.toLowerCase() === maybeTopic.toLowerCase()) : undefined;
    const topic = matched ?? (maybeTopic || "");
    const summary = typeof r.summary === "string" ? r.summary.trim() : "";
    if (!summary) continue;
    const keyPoints = Array.isArray(r.keyPoints)
      ? r.keyPoints.filter((p): p is string => typeof p === "string" && Boolean(p.trim())).slice(0, 6)
      : [];
    // location
    let location: StoryCluster["location"] | undefined;
    const loc = r.location as Record<string, unknown> | undefined;
    if (loc && typeof loc.label === "string" && loc.label.trim()) {
      const lat = loc.lat as unknown;
      const lng = loc.lng as unknown;
      if (isFiniteNum(lat) && isFiniteNum(lng) && inLatRange(lat) && inLngRange(lng)) {
        location = {
          label: loc.label.trim(),
          lat,
          lng,
          countryCode:
            typeof loc.countryCode === "string" && /^[A-Za-z]{2}$/.test(loc.countryCode.trim())
              ? loc.countryCode.trim().toUpperCase()
              : undefined,
        };
      } else {
        location = { label: loc.label.trim(), lat: 0, lng: 0 };
      }
    }

    const rawSources = Array.isArray(r.sources) ? r.sources : [];
    const sources = dedupeAttributions(
      rawSources
        .map((s) => normaliseSourceAttribution(s, groundingUrls))
        .filter((s): s is SourceAttribution => Boolean(s)),
    ).slice(0, 10);

    // If model gave no sources for a story, fall back to grounding sources (first few)
    const finalSources =
      sources.length > 0
        ? sources
        : groundingSources.slice(0, 4).map((s) => inferSourceAttribution(s.url, s.title));

    const rawPrimary = Array.isArray(r.primarySources) ? r.primarySources : [];
    const primarySources = dedupeAttributions(
      rawPrimary
        .map((s) => normaliseSourceAttribution(s, groundingUrls))
        .filter((s): s is SourceAttribution => Boolean(s)),
    ).slice(0, 6);

    const timeline = Array.isArray(r.timeline)
      ? r.timeline
          .map((e) => e as Record<string, unknown>)
          .filter((e) => typeof e.label === "string" && Boolean(e.label.trim()))
          .map((e) => ({
            date: typeof e.date === "string" ? e.date.trim() : "",
            label: (e.label as string).trim(),
            kind: (["reported","correction","update"] as const).includes((e.kind as string) as "reported") ? (e.kind as TimelineEvent["kind"]) : undefined,
          }))
          .slice(0, 8)
      : [];

    const conflictingClaims = Array.isArray(r.conflictingClaims)
      ? r.conflictingClaims
          .map((c) => c as Record<string, unknown>)
          .filter(
            (c) =>
              typeof c.claim === "string" &&
              c.claim.trim() &&
              typeof c.counterClaim === "string" &&
              c.counterClaim.trim(),
          )
          .map((c) => ({
            claim: (c.claim as string).trim(),
            attributedTo: Array.isArray(c.attributedTo)
              ? (c.attributedTo as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map((x) => x.trim()).slice(0, 4)
              : [],
            counterClaim: (c.counterClaim as string).trim(),
            counterAttributedTo: Array.isArray(c.counterAttributedTo)
              ? (c.counterAttributedTo as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map((x) => x.trim()).slice(0, 4)
              : [],
            disagreementDimension: typeof c.disagreementDimension === "string" && (c.disagreementDimension as string).trim() ? (c.disagreementDimension as string).trim().slice(0, 120) : undefined,
            context: typeof c.context === "string" ? c.context.trim() : undefined,
          }))
          .slice(0, 4)
      : [];

    const widelyAgreedFacts = Array.isArray(r.widelyAgreedFacts)
      ? (r.widelyAgreedFacts as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map((x) => x.trim()).slice(0, 6)
      : [];
    const uncertainty = Array.isArray(r.uncertainty)
      ? (r.uncertainty as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map((x) => x.trim()).slice(0, 6)
      : [];
    const corrections = Array.isArray(r.corrections)
      ? (r.corrections as unknown[])
          .map((c) => c as Record<string, unknown>)
          .filter((c) => typeof c.note === "string" && Boolean(c.note.trim()))
          .map((c) => ({
            date: typeof c.date === "string" ? c.date.trim() : "",
            note: (c.note as string).trim(),
          }))
          .slice(0, 6)
      : [];
    const coverageGaps = Array.isArray(r.coverageGaps)
      ? (r.coverageGaps as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map((x) => x.trim()).slice(0, 4)
      : [];
    const historicalContext = Array.isArray(r.historicalContext)
      ? (r.historicalContext as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map((x) => (x as string).trim().slice(0, 300)).slice(0, 3)
      : [];
    const significance = typeof r.significance === "number" && Number.isFinite(r.significance) ? Math.max(0, Math.min(100, Math.round(r.significance as number))) : undefined;
    const significanceReasons = Array.isArray(r.significanceReasons)
      ? (r.significanceReasons as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map((x) => (x as string).trim().slice(0, 160)).slice(0, 4)
      : undefined;
    const rawMeth = r.methodology as Record<string, unknown> | undefined;
    const methodology = rawMeth && (typeof rawMeth.provenanceNote === "string" || typeof rawMeth.coverageScore === "number") ? {
      provenanceNote: typeof rawMeth.provenanceNote === "string" ? (rawMeth.provenanceNote as string).trim().slice(0, 300) : undefined,
      coverageScore: typeof rawMeth.coverageScore === "number" && Number.isFinite(rawMeth.coverageScore) ? Math.max(0, Math.min(100, Math.round(rawMeth.coverageScore as number))) : undefined,
    } : undefined;

    out.push({
      id,
      headline: r.headline.trim(),
      topic: topic || "Politics",
      summary: summary.slice(0, 800),
      keyPoints,
      location,
      sources: finalSources,
      sourceMix: buildSourceMix(finalSources),
      primarySources,
      timeline,
      conflictingClaims,
      widelyAgreedFacts,
      uncertainty,
      corrections,
      coverageGaps,
      historicalContext: historicalContext.length ? historicalContext : undefined,
      significance,
      significanceReasons,
      methodology,
    });
    if (out.length >= 8) break;
  }
  // Deduplicate by id
  const seen = new Set<string>();
  return out.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

function normaliseMeta(raw: unknown): NewsMeta {
  const r = (raw ?? {}) as Record<string, unknown>;
  const widelyAgreedFacts = Array.isArray(r.widelyAgreedFacts)
    ? (r.widelyAgreedFacts as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map((x) => x.trim()).slice(0, 6)
    : [];
  const uncertainty = Array.isArray(r.uncertainty)
    ? (r.uncertainty as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map((x) => x.trim()).slice(0, 6)
    : [];
  const coverageGaps = Array.isArray(r.coverageGaps)
    ? (r.coverageGaps as unknown[]).filter((x): x is string => typeof x === "string" && Boolean(x.trim())).map((x) => x.trim()).slice(0, 6)
    : [];
  const corrections = Array.isArray(r.corrections)
    ? (r.corrections as unknown[])
        .map((c) => c as Record<string, unknown>)
        .filter((c) => typeof c.note === "string" && Boolean(c.note.trim()))
        .map((c) => ({
          date: typeof c.date === "string" ? c.date.trim() : "",
          note: (c.note as string).trim(),
        }))
        .slice(0, 6)
    : [];
  const whatChangedSinceYesterday =
    typeof r.whatChangedSinceYesterday === "string" && r.whatChangedSinceYesterday.trim()
      ? r.whatChangedSinceYesterday.trim().slice(0, 600)
      : null;
  const provenanceNote = typeof r.provenanceNote === "string" && r.provenanceNote.trim() ? r.provenanceNote.trim().slice(0, 400) : null;
  return { widelyAgreedFacts, uncertainty, coverageGaps, corrections, whatChangedSinceYesterday, provenanceNote };
}

interface GroundingChunk {
  web?: { uri?: string; title?: string };
}

// Extract the real, de-duplicated source links Google Search grounded the
// answer on. These make the summary verifiable.
function extractSources(chunks: GroundingChunk[] | undefined): NewsSource[] {
  if (!chunks) return [];
  const seen = new Set<string>();
  const sources: NewsSource[] = [];
  for (const chunk of chunks) {
    const url = chunk.web?.uri;
    if (!url || seen.has(url)) continue;
    seen.add(url);
    sources.push({ url, title: chunk.web?.title || url });
  }
  return sources;
}

// Run a grounded prompt and shape the result into topic summaries + sources.
// Shared by the country and world summarisers. Throws MissingApiKeyError if the
// key is unset, or RateLimitError on a 429.
async function runSummary(
  prompt: string,
  label: string,
  code: string,
): Promise<CountryNews> {
  const keys = getApiKeys();

  // Try each key in turn: on a 429 rotate to the next key; any other error
  // propagates. A 429 can mean either the key's daily quota is gone (rotating
  // is the fix) or we're simply going too fast (waiting is the fix) — and the
  // response doesn't reliably distinguish them. So do both: sweep the keys,
  // then back off and sweep again. Without the pause a full rotation burns
  // every key within milliseconds and reports exhaustion that isn't real.
  let response;
  let lastHintMs: number | null = null;

  for (let round = 0; round < RATE_LIMIT_ROUNDS && !response; round++) {
    if (round > 0) {
      // Exponential backoff with jitter, or the API's own hint when it gave
      // one. Jitter keeps concurrent regenerations from retrying in lockstep.
      const backoff = RATE_LIMIT_BASE_MS * 2 ** (round - 1);
      const wait = lastHintMs ?? backoff + Math.random() * RATE_LIMIT_BASE_MS;
      console.warn(
        `[gemini] ${label}: all ${keys.length} key(s) rate-limited — retrying in ${Math.round(wait)}ms (round ${round + 1}/${RATE_LIMIT_ROUNDS})`,
      );
      await sleep(wait);
      lastHintMs = null;
    }

    for (const apiKey of keys) {
      const ai = new GoogleGenAI({ apiKey });
      try {
        response = await ai.models.generateContent({
          model: MODEL,
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
            temperature: 0.3,
          },
        });
        break;
      } catch (error) {
        if ((error as { status?: number })?.status === 429) {
          lastHintMs = retryHintMs(error) ?? lastHintMs;
          continue;
        }
        throw error;
      }
    }
  }
  if (!response) throw new RateLimitError();

  const text = response.text ?? "";
  let topics: TopicSummary[] = [];
  let points: NewsPoint[] = [];
  let conflicts: ConflictLine[] = [];
  let stories: StoryCluster[] = [];
  let meta: NewsMeta = { widelyAgreedFacts: [], uncertainty: [], coverageGaps: [], corrections: [], whatChangedSinceYesterday: null };
  let groundingSources: NewsSource[] = [];
  try {
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as
      | GroundingChunk[]
      | undefined;
    groundingSources = extractSources(chunks);
    const groundingUrls = new Set(groundingSources.map((s) => s.url));

    const parsed = extractJson(text);
    topics = normaliseTopics(parsed.topics);
    points = normalisePoints(parsed.points);
    conflicts = normaliseConflicts(parsed.conflicts as unknown[]);
    stories = normaliseStories(parsed.stories, groundingUrls, groundingSources);
    meta = normaliseMeta(parsed.meta);

    // If model produced no stories but we have topics, synthesize 1 story per topic as fallback
    if (stories.length === 0 && topics.length > 0) {
      stories = topics.slice(0, 4).map((t, i) => ({
        id: `topic-${t.topic.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
        headline: t.summary.slice(0, 80),
        topic: t.topic,
        summary: t.summary,
        keyPoints: t.keyPoints.slice(0, 3),
        location: undefined,
        sources: groundingSources.slice(i * 2, i * 2 + 3).map((s) => inferSourceAttribution(s.url, s.title)),
        sourceMix: buildSourceMix(groundingSources.slice(i * 2, i * 2 + 3).map((s) => inferSourceAttribution(s.url, s.title))),
        primarySources: [],
        timeline: [],
        conflictingClaims: [],
        widelyAgreedFacts: [],
        uncertainty: [],
        corrections: [],
        coverageGaps: [],
      }));
      // Ensure every story has a sourceMix
      stories = stories.map((s) => ({ ...s, sourceMix: buildSourceMix(s.sources) }));
    }

    // Backfill per-story sourceMix where missing (e.g. old snapshots that gain new logic)
    stories = stories.map((s) => ({ ...s, sourceMix: s.sourceMix ?? buildSourceMix(s.sources) }));

    // Use grounding sources as the page-level sources (deduped, limited)
    const combinedSources = groundingSources.length > 0 ? groundingSources : [];
    return {
      country: label,
      code,
      generatedAt: new Date().toISOString(),
      topics,
      sources: combinedSources.slice(0, 24),
      points,
      conflicts,
      stories: stories.slice(0, 8),
      meta,
    };
  } catch {
    // Grounded responses occasionally wrap JSON in commentary we can't parse;
    // fall back to empty lists so the page renders an empty state.
    topics = [];
    points = [];
    conflicts = [];
    stories = [];
    meta = { widelyAgreedFacts: [], uncertainty: [], coverageGaps: [], corrections: [], whatChangedSinceYesterday: null };
  }

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks as
    | GroundingChunk[]
    | undefined;

  return {
    country: label,
    code,
    generatedAt: new Date().toISOString(),
    topics,
    sources: extractSources(chunks),
    points,
    conflicts,
    stories,
    meta,
  };
}

// Search + summarise current news for one country, split into topics, with the
// grounding sources attached.
export function summariseCountryNews(countryName: string, code: string): Promise<CountryNews> {
  return runSummary(buildPrompt(countryName), countryName, code);
}

// Search + summarise the most important news worldwide, split into topics.
export function summariseWorldNews(): Promise<CountryNews> {
  return runSummary(buildWorldPrompt(), "Around the World", "world");
}

// Exported for tests
export const __test = {
  normaliseStories,
  normaliseMeta,
  normalisePoints,
  normaliseTopics,
  normaliseConflicts,
  extractJson,
  buildPrompt,
  buildWorldPrompt,
};
