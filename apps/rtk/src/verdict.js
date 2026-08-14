'use strict';

const { tostPaired, mcnemarExact, requiredPairs, DEFAULT_MARGIN } = require('./equivalence');

// ---------------------------------------------------------------------------
// What the token saving actually cost.
//
// "RTK saved 43k tokens" is only half a sentence. Filtering removes context,
// and an agent that has been denied the line it needed does not fail silently
// — it runs the command again without the filter, or asks for more. That
// retry costs a full round trip: the raw output it was trying to avoid, plus
// another completion.
//
// So a token saving is not a saving until the retries are counted. The
// arithmetic that matters is:
//
//   net = (raw tool tokens - rtk tool tokens) - (extra retries × retry cost)
//
// and a filter aggressive enough to cause retries on one call in eight is
// usually *losing* tokens overall while reporting a 90% reduction on the call
// it did filter. That failure mode is invisible to a benchmark that measures
// only the filtered output, which is what RTK's benchmarks currently do.
//
// This module measures the other half, and gates the headline claim on it.
//
// Pure. No I/O.
// ---------------------------------------------------------------------------

/**
 * Phrases an agent uses when the output it was given was not enough.
 *
 * Lexical and therefore imperfect — it will miss a model that silently
 * re-runs a command without narrating it. The bias is towards under-counting
 * retries, which flatters RTK, so `retriesFrom` reports its own confidence
 * rather than presenting a count as complete.
 */
const RETRY_MARKERS = [
  // `[^.]*` keeps each match inside one sentence, so "the error is in foo.ts.
  // Separately, show me the raw log." does not read as one clause.
  /\bre-?run\b[^.]*\b(without|full|raw|unfiltered|verbose)\b/i,
  /\b(need|want|require)\b[^.]*\bthe (full|raw|complete|entire|whole)\b/i,
  /\b(show|give|send|paste|provide|share)\b[^.]*\bthe (full|raw|complete|entire|whole|rest)\b/i,
  /\b(can|could|would)\b[^.]*\bsee the (full|rest|whole|complete|entire)\b/i,
  /\bnot enough (context|information|output|detail)\b/i,
  /\btruncated\b[^.]*\b(need|missing|cannot|can'?t)\b/i,
  /\bi (can'?t|cannot) tell\b/i,
  /\bmissing\b[^.]*\b(stack|trace|error|line)\b/i,
];

/** Signals that the model answered from what it was given. */
const CONFIDENT_MARKERS = [/\bthe error is\b/i, /\bfix\b.*\bline\b/i, /\bfailing test\b/i];

/**
 * Did this response indicate the output was insufficient?
 *
 * A response can both answer and ask — "the error is in billing.ts:14, though
 * I'd want the full stack to be sure" is not a retry. Asking is only counted
 * as a retry when the model did not also commit to an answer.
 */
function isRetry(responseText) {
  const text = String(responseText || '');
  const asked = RETRY_MARKERS.some((re) => re.test(text));
  if (!asked) return { retry: false, reason: null };
  const answered = CONFIDENT_MARKERS.some((re) => re.test(text));
  if (answered) return { retry: false, reason: 'asked for more but still committed to an answer' };
  const marker = RETRY_MARKERS.find((re) => re.test(text));
  return { retry: true, reason: `response asked for more output (${String(marker).slice(0, 40)}…)` };
}

/**
 * Count retries in one arm.
 *
 * A missing needle counts as a retry even when the model said nothing about
 * it: an agent that confidently reports the wrong line will be corrected by
 * the next tool call, and that correction is a round trip whether or not it
 * was requested politely.
 */
function retriesFrom(cases) {
  let retries = 0;
  let detectedFromText = 0;
  let detectedFromMissingNeedle = 0;
  const reasons = [];

  for (const item of cases) {
    const fromText = isRetry(item.response);
    const missingNeedle = item.foundNeedles === false;
    if (fromText.retry || missingNeedle) {
      retries += 1;
      if (fromText.retry) detectedFromText += 1;
      else detectedFromMissingNeedle += 1;
      reasons.push({ label: item.label, reason: fromText.retry ? fromText.reason : 'did not identify the failure the output was meant to show' });
    }
  }

  return {
    total: cases.length,
    retries,
    detectedFromText,
    detectedFromMissingNeedle,
    reasons: reasons.slice(0, 10),
    note:
      cases.length === 0
        ? 'No cases.'
        : `${retries} of ${cases.length} responses needed another round trip.`,
    caveat:
      'Retry detection is lexical and under-counts: a model that silently re-runs a command is not visible here.',
  };
}

// ---------------------------------------------------------------------------
// Net token effect
// ---------------------------------------------------------------------------

/**
 * Whether the saving survives the retries.
 *
 * `retryCostTokens` defaults to the raw tool output plus a completion, because
 * that is what a retry actually is: the agent re-runs the command unfiltered
 * and pays for another turn. Charging a retry less than the raw output would
 * be assuming the thing being measured.
 */
function netTokenEffect(input) {
  const {
    rawToolTokens,
    rtkToolTokens,
    rawRetries = 0,
    rtkRetries = 0,
    calls = 1,
    completionTokens = 400,
  } = input;

  const retryCostTokens = rawToolTokens / Math.max(calls, 1) + completionTokens;
  const grossSaved = rawToolTokens - rtkToolTokens;
  const extraRetries = rtkRetries - rawRetries;
  const retryCost = extraRetries * retryCostTokens;
  const net = grossSaved - retryCost;

  const grossPct = rawToolTokens > 0 ? grossSaved / rawToolTokens : 0;
  const netPct = rawToolTokens > 0 ? net / rawToolTokens : 0;

  return {
    grossSaved,
    grossPct,
    extraRetries,
    retryCostTokens: Math.round(retryCostTokens),
    retryCost: Math.round(retryCost),
    net: Math.round(net),
    netPct,
    profitable: net > 0,
    note:
      extraRetries <= 0
        ? `Saved ${fmt(grossSaved)} tokens with no additional retries.`
        : net > 0
          ? `Saved ${fmt(grossSaved)} tokens gross, but ${extraRetries} extra retr${extraRetries === 1 ? 'y' : 'ies'} cost ${fmt(retryCost)} — net ${fmt(net)}.`
          : `Saved ${fmt(grossSaved)} tokens gross, but ${extraRetries} extra retr${extraRetries === 1 ? 'y' : 'ies'} cost ${fmt(retryCost)} — a net LOSS of ${fmt(Math.abs(net))} tokens.`,
  };
}

function fmt(n) {
  const v = Math.round(n);
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}k`;
  return String(v);
}

// ---------------------------------------------------------------------------
// The headline claim
// ---------------------------------------------------------------------------

/** The reduction band the product claims. Below the floor there is no point. */
const CLAIMED_MIN_REDUCTION = 0.5;

/**
 * Produce the sentence RTK is allowed to say about itself — or refuse.
 *
 * The suggestion in the brief — "RTK saved 43k tokens but caused 0 additional
 * retries" — is exactly right as a *format*, and it is a claim about two
 * measured quantities and one statistical inference. Every part has to hold
 * before the sentence can be printed:
 *
 *   1. the reduction is real and in the claimed band
 *   2. retries did not increase
 *   3. task success is *demonstrated equivalent*, not merely
 *      not-shown-to-differ, which needs a sample the benchmark may not have
 *
 * When any part fails, the function returns the reasons instead of the
 * sentence. Refusing at this boundary is the whole point: this is the string
 * that would end up in a README, and a README is where an unsupported claim
 * does its damage.
 */
function headlineVerdict(input) {
  const {
    pairs = [],
    rawToolTokens = 0,
    rtkToolTokens = 0,
    rawRetries = 0,
    rtkRetries = 0,
    calls = 1,
    margin = DEFAULT_MARGIN,
    corpusIsReal = false,
  } = input;

  const equivalence = tostPaired(pairs, { margin });
  const difference = mcnemarExact(equivalence.b, equivalence.c);
  const economics = netTokenEffect({ rawToolTokens, rtkToolTokens, rawRetries, rtkRetries, calls });

  const blockers = [];

  if (!corpusIsReal) {
    blockers.push('The corpus is synthetic. Reduction on generated fixtures is not evidence about real tool output.');
  }
  if (!equivalence.equivalent) {
    blockers.push(`Task-success equivalence is not demonstrated. ${equivalence.reason}`);
  }
  if (economics.extraRetries > 0) {
    blockers.push(`RTK caused ${economics.extraRetries} more retr${economics.extraRetries === 1 ? 'y' : 'ies'} than raw.`);
  }
  if (economics.grossPct < CLAIMED_MIN_REDUCTION) {
    blockers.push(`Reduction is ${(economics.grossPct * 100).toFixed(1)}%, below the ${(CLAIMED_MIN_REDUCTION * 100).toFixed(0)}% floor the product claims.`);
  }

  if (blockers.length > 0) {
    const need = requiredPairs({ margin });
    return {
      supported: false,
      claim: null,
      blockers,
      equivalence,
      difference,
      economics,
      note:
        `Cannot make the headline claim yet:\n  - ${blockers.join('\n  - ')}\n` +
        `  Sample: ${equivalence.n} pairs. ${need.note}`,
    };
  }

  const claim =
    `RTK cut tool-result tokens by ${(economics.grossPct * 100).toFixed(0)}% ` +
    `(${fmt(economics.grossSaved)} tokens across ${equivalence.n} tasks) ` +
    `with no additional retries and task success statistically equivalent to raw ` +
    `(difference within ±${(margin * 100).toFixed(0)} points, 90% CI ` +
    `${(equivalence.lower * 100).toFixed(1)} to ${(equivalence.upper * 100).toFixed(1)}).`;

  return { supported: true, claim, blockers: [], equivalence, difference, economics, note: claim };
}

module.exports = {
  CLAIMED_MIN_REDUCTION,
  isRetry,
  retriesFrom,
  netTokenEffect,
  headlineVerdict,
};
