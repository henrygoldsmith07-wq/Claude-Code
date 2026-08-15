// The labelled corpus: real articles, named annotators, measured agreement.
//
// `benchmarkGold.ts` describes itself as a "human-labelled gold set", and the
// benchmark prints that phrase over its results. It is not one. Its articles
// are authored fixtures — headlines written by hand in a spec tuple, with
// synthetic URLs (`https://reuters.com/<key>-0`) that resolve to nothing. No
// human reviewed a real article to produce them.
//
// That distinction is not pedantry, it is the difference between a benchmark
// and a mirror. A clusterer scored against fixtures written by someone who knew
// how the clusterer works is measured on its ability to recover the fixture
// author's intent. Scores go up, nothing is learned, and the number is reported
// as if it meant something about news.
//
// This module is the apparatus for the real thing:
//
//   - articles are real, carrying the URL and fetch time that make them
//     re-checkable
//   - every label names the annotator who made it and the guidelines version
//     they worked from
//   - two annotators label independently, and disagreements go to adjudication
//     rather than to whoever labelled last
//   - agreement is measured, so a corpus that merely looks large but is
//     internally inconsistent cannot pass as evidence
//
// It ships with the corpus empty. That is the honest state: the labels do not
// exist yet, `corpusStats()` reports zero, and `assertBenchmarkable()` refuses
// to score against it. Filling it is human work, and the code says so rather
// than quietly generating something to fill the space.
//
// Pure + deterministic. No network.

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export type CorpusProvenance =
  /** Real articles labelled by people. The only kind that may be reported as a benchmark. */
  | "human-labelled"
  /** Authored fixtures. Usable for regression tests; never reportable as a score. */
  | "synthetic";

export const PROVENANCE_MEANING: Record<CorpusProvenance, string> = {
  "human-labelled":
    "Real published articles, labelled independently by named annotators against a versioned guideline, with disagreements adjudicated.",
  synthetic:
    "Headlines authored to exercise specific clustering behaviours. Useful as a regression guard; not evidence of accuracy on real news, and never reported as a benchmark score.",
};

/** Bumped whenever the labelling rules change; labels record the version they used. */
export const GUIDELINES_VERSION = "2026-08-14.1";

export interface Annotator {
  id: string;
  /** Adjudicators resolve disagreements; they do not also count as an independent labeller. */
  role: "annotator" | "adjudicator";
}

// ---------------------------------------------------------------------------
// Articles and labels
// ---------------------------------------------------------------------------

/**
 * A real, retrievable article.
 *
 * `url` and `fetchedAt` are required precisely because they are what a fixture
 * cannot have: they let a reviewer go and look at what was labelled.
 */
export interface CorpusArticle {
  id: string;
  url: string;
  title: string;
  publisher: string;
  publishedAt?: string;
  language: string;
  /** When this text was captured — headlines change under the same URL. */
  fetchedAt: string;
  countryCode?: string;
}

export interface EventLabel {
  articleId: string;
  /**
   * The event this article covers. `null` means a deliberate singleton — an
   * event of one — which is a positive judgement, not a missing label.
   */
  eventKey: string | null;
  annotatorId: string;
  at: string;
  guidelinesVersion: string;
  /** The annotator's own confidence; low-confidence labels are reported separately. */
  confidence: "high" | "low";
  note?: string;
}

export interface Adjudication {
  articleId: string;
  eventKey: string | null;
  by: string;
  at: string;
  /** Why this resolution, given the disagreement. Required — a bare verdict teaches nobody. */
  note: string;
}

export interface Corpus {
  provenance: CorpusProvenance;
  guidelinesVersion: string;
  annotators: Annotator[];
  articles: CorpusArticle[];
  labels: EventLabel[];
  adjudications: Adjudication[];
}

export function emptyCorpus(provenance: CorpusProvenance = "human-labelled"): Corpus {
  return {
    provenance,
    guidelinesVersion: GUIDELINES_VERSION,
    annotators: [],
    articles: [],
    labels: [],
    adjudications: [],
  };
}

// ---------------------------------------------------------------------------
// Resolution
// ---------------------------------------------------------------------------

export type LabelState =
  /** Two or more annotators agree. */
  | "agreed"
  /** Annotators disagreed and an adjudicator settled it. */
  | "adjudicated"
  /** Annotators disagreed and nobody has settled it. */
  | "contested"
  /** Fewer than two independent labels. */
  | "under-labelled";

export interface ResolvedLabel {
  articleId: string;
  eventKey: string | null;
  state: LabelState;
  annotators: string[];
}

/**
 * Reduce every article's labels to one verdict, keeping the disagreement visible.
 *
 * A contested article is not silently resolved to a majority. Two annotators
 * splitting on whether two reports describe one event is a signal about the
 * boundary being genuinely unclear, and averaging it away discards the most
 * informative cases in the corpus.
 */
export function resolveLabels(corpus: Corpus): ResolvedLabel[] {
  const byArticle = new Map<string, EventLabel[]>();
  for (const l of corpus.labels) {
    const g = byArticle.get(l.articleId);
    if (g) g.push(l);
    else byArticle.set(l.articleId, [l]);
  }
  const adjudicated = new Map(corpus.adjudications.map((a) => [a.articleId, a]));

  return corpus.articles.map((article) => {
    const labels = byArticle.get(article.id) ?? [];
    const annotators = [...new Set(labels.map((l) => l.annotatorId))];
    const distinct = new Set(labels.map((l) => String(l.eventKey)));
    const adj = adjudicated.get(article.id);

    if (adj) {
      return { articleId: article.id, eventKey: adj.eventKey, state: "adjudicated", annotators };
    }
    if (annotators.length < 2) {
      return {
        articleId: article.id,
        eventKey: labels[0]?.eventKey ?? null,
        state: "under-labelled",
        annotators,
      };
    }
    if (distinct.size === 1) {
      return { articleId: article.id, eventKey: labels[0].eventKey, state: "agreed", annotators };
    }
    return { articleId: article.id, eventKey: null, state: "contested", annotators };
  });
}

/** Ground-truth groups from the settled labels only. Contested articles are excluded. */
export function goldGroupsFrom(corpus: Corpus): string[][] {
  const resolved = resolveLabels(corpus).filter((r) => r.state === "agreed" || r.state === "adjudicated");
  const byEvent = new Map<string, string[]>();
  for (const r of resolved) {
    const key = r.eventKey ?? `singleton:${r.articleId}`;
    const g = byEvent.get(key);
    if (g) g.push(r.articleId);
    else byEvent.set(key, [r.articleId]);
  }
  return [...byEvent.values()];
}

// ---------------------------------------------------------------------------
// Agreement
// ---------------------------------------------------------------------------

export interface AgreementReport {
  /** Article pairs both annotators labelled. */
  pairs: number;
  /** Proportion on which they made the same same/different call. */
  observed: number;
  /** Cohen's kappa — agreement above what their marginal rates predict by chance. */
  kappa: number;
  interpretation: string;
}

/**
 * Inter-annotator agreement on the clustering task.
 *
 * Measured over *pairs* of articles rather than over event keys, because event
 * keys are arbitrary names: two annotators can partition a set identically and
 * still call the same event "kabul-blast" and "e17". The question that has a
 * stable answer is "do these two articles cover the same event?", so agreement
 * is computed on that decision.
 *
 * Raw agreement is not enough on its own here. Most article pairs are
 * unrelated, so two annotators answering "different" to everything would agree
 * about 95% of the time. Kappa corrects for that, and is the number to read.
 */
export function agreementBetween(corpus: Corpus, annotatorA: string, annotatorB: string): AgreementReport {
  const labelsOf = (who: string) => {
    const m = new Map<string, string | null>();
    for (const l of corpus.labels) if (l.annotatorId === who) m.set(l.articleId, l.eventKey);
    return m;
  };
  const a = labelsOf(annotatorA);
  const b = labelsOf(annotatorB);
  const shared = [...a.keys()].filter((id) => b.has(id)).sort();

  let both = 0, neither = 0, onlyA = 0, onlyB = 0;
  for (let i = 0; i < shared.length; i++) {
    for (let j = i + 1; j < shared.length; j++) {
      const x = shared[i], y = shared[j];
      // A null event key is a singleton: never the same event as anything else.
      const sameA = a.get(x) !== null && a.get(x) === a.get(y);
      const sameB = b.get(x) !== null && b.get(x) === b.get(y);
      if (sameA && sameB) both++;
      else if (!sameA && !sameB) neither++;
      else if (sameA) onlyA++;
      else onlyB++;
    }
  }

  const pairs = both + neither + onlyA + onlyB;
  if (pairs === 0) {
    return { pairs: 0, observed: 0, kappa: 0, interpretation: "No overlapping labels — agreement cannot be measured." };
  }

  const observed = (both + neither) / pairs;
  const pYesA = (both + onlyA) / pairs, pYesB = (both + onlyB) / pairs;
  const expected = pYesA * pYesB + (1 - pYesA) * (1 - pYesB);
  const kappa = expected === 1 ? 1 : (observed - expected) / (1 - expected);

  const interpretation =
    kappa >= 0.8 ? "Strong agreement — the guideline is being applied consistently."
      : kappa >= 0.6 ? "Moderate agreement — usable, but the disagreements are worth reading."
        : kappa >= 0.4 ? "Weak agreement — the guideline is probably underspecified."
          : "Poor agreement — labels at this level do not support a benchmark claim.";

  return { pairs, observed: round2(observed), kappa: round2(kappa), interpretation };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// ---------------------------------------------------------------------------
// Stats and gating
// ---------------------------------------------------------------------------

export interface CorpusStats {
  provenance: CorpusProvenance;
  articles: number;
  /** Articles with at least two independent labels. */
  doubleLabelled: number;
  agreed: number;
  adjudicated: number;
  contested: number;
  underLabelled: number;
  events: number;
  annotators: number;
  languages: number;
  publishers: number;
  /** One line stating exactly what exists, including when that is nothing. */
  summary: string;
}

export function corpusStats(corpus: Corpus): CorpusStats {
  const resolved = resolveLabels(corpus);
  const count = (s: LabelState) => resolved.filter((r) => r.state === s).length;
  const settled = resolved.filter((r) => r.state === "agreed" || r.state === "adjudicated");
  const events = new Set(settled.map((r) => r.eventKey).filter((k): k is string => k !== null)).size;
  const doubleLabelled = resolved.filter((r) => r.annotators.length >= 2).length;

  const stats: Omit<CorpusStats, "summary"> = {
    provenance: corpus.provenance,
    articles: corpus.articles.length,
    doubleLabelled,
    agreed: count("agreed"),
    adjudicated: count("adjudicated"),
    contested: count("contested"),
    underLabelled: count("under-labelled"),
    events,
    annotators: corpus.annotators.filter((a) => a.role === "annotator").length,
    languages: new Set(corpus.articles.map((a) => a.language)).size,
    publishers: new Set(corpus.articles.map((a) => a.publisher)).size,
  };

  const summary =
    stats.articles === 0
      ? `Empty ${corpus.provenance} corpus: 0 articles, 0 labels. Nothing can be scored against it yet.`
      : `${stats.articles} ${corpus.provenance} articles from ${stats.publishers} publishers in ${stats.languages} language(s); ` +
        `${stats.agreed + stats.adjudicated} settled across ${stats.events} events, ` +
        `${stats.contested} contested, ${stats.underLabelled} with fewer than two labels.`;

  return { ...stats, summary };
}

export interface BenchmarkEligibility {
  eligible: boolean;
  reasons: string[];
}

/**
 * Whether a corpus may be reported as a benchmark result.
 *
 * The gate exists because the failure it prevents is silent and flattering: a
 * synthetic set scores well, the number gets printed under the word
 * "benchmark", and nobody downstream can tell it apart from a real measurement.
 * Refusing at the boundary is the only place that distinction can be enforced
 * cheaply.
 */
export function benchmarkEligibility(corpus: Corpus, minArticles = 200): BenchmarkEligibility {
  const stats = corpusStats(corpus);
  const reasons: string[] = [];

  if (corpus.provenance !== "human-labelled") {
    reasons.push("Corpus is synthetic — usable as a regression guard, never as a benchmark score.");
  }
  if (stats.articles < minArticles) {
    reasons.push(`${stats.articles} articles; a reportable benchmark needs at least ${minArticles}.`);
  }
  if (stats.annotators < 2) {
    reasons.push(`${stats.annotators} annotator(s); agreement cannot be measured below 2.`);
  }
  const settled = stats.agreed + stats.adjudicated;
  if (stats.articles > 0 && settled / stats.articles < 0.9) {
    reasons.push(`Only ${settled} of ${stats.articles} articles are settled; at least 90% must be.`);
  }

  return { eligible: reasons.length === 0, reasons };
}

/** Throw rather than report a score the corpus does not support. */
export function assertBenchmarkable(corpus: Corpus, minArticles = 200): void {
  const { eligible, reasons } = benchmarkEligibility(corpus, minArticles);
  if (!eligible) {
    throw new Error(`Corpus is not reportable as a benchmark:\n  - ${reasons.join("\n  - ")}`);
  }
}

export const LABELLING_GUIDELINES_V2 = [
  "Label the event, not the subject. Two rate decisions by the same bank are two events.",
  "Language and framing are irrelevant to identity: a French and an English report of one announcement are one event.",
  "Anchor analysis and reaction pieces to the specific occurrence they analyse; if they range across several, mark them singleton.",
  "A rolling situation (a war, a campaign) is not one event — label the discrete developments inside it.",
  "Disagreement about the facts is one contested event, not two events.",
  "Mark confidence `low` rather than guessing; low-confidence labels are reported separately and never silently averaged in.",
  "Do not consult the clusterer's output before labelling. A label written to match the system measures nothing.",
] as const;

export const CORPUS_METHODOLOGY =
  "Benchmark claims are made only against real, retrievable articles labelled independently by at least " +
  "two people against a versioned guideline, with disagreements adjudicated on the record and " +
  "inter-annotator agreement reported alongside every score. Synthetic fixtures are kept for regression " +
  "testing and are structurally barred from being reported as accuracy.";
