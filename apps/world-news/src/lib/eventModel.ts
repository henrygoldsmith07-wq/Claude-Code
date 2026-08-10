// Event vs Article — the 9+ backbone.
// An Event is the real-world thing that happened (evolving, mergeable, timelined).
// An Article is one outlet's account of it (source, country, perspective, credibility).
// A StoryCluster is the presentation layer that groups Articles into an Event.

export type SourceType =
  | "newsroom"
  | "wire"
  | "official"
  | "expert"
  | "document"
  | "community"
  | "unknown";

export type CountryCode = string; // ISO2

export interface Article {
  id: string;
  url: string;
  title: string;
  publisher?: string;
  countryCode?: CountryCode;
  sourceType: SourceType;
  perspective?: string;
  publishedAt?: string; // ISO when known
  language?: string;
  excerpt?: string; // 1-2 sentence grounded excerpt when available
}

export type EventStatus = "developing" | "ongoing" | "resolved" | "contested";

export interface Event {
  id: string;
  headline: string;
  summary: string;
  topic: string;
  status: EventStatus;
  significance: number; // 0..100 — editorial significance, not popularity
  significanceReasons: string[]; // why it scored this way
  firstSeen: string; // ISO date
  lastUpdated: string; // ISO date
  location?: { label: string; lat: number; lng: number; countryCodes: CountryCode[] };
  articleIds: string[];
  timeline: { date: string; label: string; articleId?: string; kind: "reported" | "correction" | "update" }[];
  contradictions: { claim: string; attributedTo: string[]; counterClaim: string; counterAttributedTo: string[]; dimension?: string }[];
  widelyAgreedFacts: { text: string; supportingArticleIds: string[] }[];
  uncertainty: string[];
  provenance: {
    note: string; // one sentence: how claims were sourced/verified
    groundingRate: number; // 0..1 — share of claims with live grounding chunks
    liveLinkedClaims: number; // how many keyPoints link to a source
  };
}

export interface CoverageBiasReport {
  totalEvents: number;
  topRegions: { code: string; label: string; share: number }[];
  undercovered: { code: string; label: string; reason: string }[];
  englishBias: string; // one-line note
  diversity: { byCountryEntropy: number; byPerspectiveEntropy: number };
}

export function significanceForEvent(args: {
  sourceCount: number;
  distinctCountries: number;
  hasPrimary: boolean;
  hasTimeline: boolean;
  hasContradictions: boolean;
  isConflictOrHealthCrisis: boolean;
  daysSinceFirstSeen: number;
}): { score: number; reasons: string[] } {
  let s = 0;
  const reasons: string[] = [];
  if (args.isConflictOrHealthCrisis) { s += 14; reasons.push("High-impact domain (conflict/health)"); }
  if (args.sourceCount >= 6) { s += 18; reasons.push(`${args.sourceCount} corroborating sources`); }
  else if (args.sourceCount >= 3) { s += 10; reasons.push(`${args.sourceCount} sources`); }
  if (args.distinctCountries >= 3) { s += 16; reasons.push(`${args.distinctCountries} countries reporting`); }
  else if (args.distinctCountries >= 2) { s += 8; reasons.push("Cross-border coverage"); }
  if (args.hasPrimary) { s += 10; reasons.push("Primary/official source present"); }
  if (args.hasTimeline) { s += 8; reasons.push("Timeline established"); }
  if (args.hasContradictions) { s += 6; reasons.push("Contested — needs scrutiny"); }
  if (args.daysSinceFirstSeen <= 2) { s += 10; reasons.push("Very recent development"); }
  else if (args.daysSinceFirstSeen <= 7) { s += 5; reasons.push("This week's development"); }
  if (args.sourceCount >= 8 && args.distinctCountries >= 3) { s += 8; reasons.push("Broad independent corroboration"); }
  return { score: Math.max(0, Math.min(100, s)), reasons: reasons.slice(0, 5) };
}
