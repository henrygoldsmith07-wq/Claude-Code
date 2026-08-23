/**
 * Pantry truth — probabilistic, not binary.
 *
 * "Have milk / don't have milk" is a lie the moment you cook twice without
 * weighing anything. Every row instead carries:
 *
 *   estimated amount · confidence % · last confirmed · expected range
 *
 * Confidence moves with evidence: time since confirmation and uncounted
 * consumption pull it down; receipts and weighed cooking deductions push it
 * up. quickCheck() turns low-confidence rows into one-tap questions —
 * existence ("still have it?"), amount ("roughly how much?") or confirmation
 * ("still around 600 g?").
 */

import { pantryConfidenceLevel } from './pantry-intelligence.js';
import { parseQuantity } from './measure.js';

const round2 = (n) => Math.round(n * 100) / 100;
const clampConf = (n) => Math.max(15, Math.min(97, Math.round(n)));
const norm = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const daysBetween = (fromStamp, todayStamp) => {
  if (!fromStamp || !todayStamp) return null;
  const a = new Date(`${String(fromStamp).slice(0, 10)}T12:00:00`);
  const b = new Date(`${todayStamp}T12:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return null;
  return Math.round((b - a) / 86400000);
};

/** Consumption/deduction evidence for one row, from the household's own events. */
const eventEvidence = (row, events = []) => {
  let uncounted = 0;
  let counted = 0;
  const rowName = norm(row?.name);
  for (const e of events || []) {
    const matches = e?.itemId ? e.itemId === row?.id : norm(e?.name) === rowName;
    if (!matches) continue;
    const to = String(e?.to || '').toLowerCase();
    const hasQty = Boolean(e?.qty && /\d/.test(String(e.qty)));
    if (to === 'consumed') (hasQty ? (counted += 1) : (uncounted += 1));
  }
  return { uncounted, counted };
};

/**
 * Probabilistic truth for one pantry row.
 * Returns estimate/range/confidence plus every driver that moved the number.
 */
export function pantryTruth(row, { events = [], today } = {}) {
  if (!row) return null;
  const level = pantryConfidenceLevel(row, today);
  let confidence = level.score * 100;
  const drivers = [];
  const push = (id, delta, note) => { if (delta !== 0) { confidence += delta; drivers.push({ id, delta: Math.round(delta * 10) / 10, note }); } };

  // 1. Time since any confirmation erodes knowledge.
  if (level.ageDays != null && level.ageDays > 0) {
    push('time-decay', -Math.min(30, level.ageDays * 1.5), `last confirmed ${level.ageDays}d ago`);
  }

  // 2/6. Cooking deductions: uncounted use hides spend; weighed use builds trust.
  const { uncounted, counted } = eventEvidence(row, events);
  if (uncounted) push('uncounted-consumption', -Math.min(18, uncounted * 6), `${uncounted} cooked use${uncounted === 1 ? '' : 's'} without quantities`);
  if (counted) push('cooking-deduction', Math.min(9, counted * 3), `${counted} weighed deduction${counted === 1 ? '' : 's'}`);

  // 3. Manual edits carry no external evidence.
  if (row?.source === 'manual' || row?.editedManually) push('manual-edit', -5, 'typed in by hand');

  // 4. Quantity certainty from the parser itself.
  const parsed = parseQuantity(row?.qty ?? '');
  if (!parsed || parsed.confidence === 'unknown' || row?.qty == null) {
    push('quantity-certainty', -15, 'amount never recorded');
  } else if (parsed.confidence !== 'exact') {
    push('quantity-certainty', -8, 'approximate quantity');
  }

  // 5. Receipt evidence anchors truth.
  if (row?.receiptId || row?.source === 'receipt') push('receipt-evidence', 8, 'anchored to a receipt');

  const confidencePct = clampConf(confidence);

  // Estimate + expected range, widened by uncertainty.
  let estimate = null;
  let rangeLow = null;
  let rangeHigh = null;
  if (parsed && Number.isFinite(parsed.amount)) {
    const uncertainty = ((100 - confidencePct) / 100) * 0.6;
    const spread = Math.max(parsed.dim === 'count' ? 0.5 : parsed.amount * 0.05, parsed.amount * uncertainty);
    estimate = { amount: round2(parsed.amount), dim: parsed.dim, unit: parsed.unit };
    rangeLow = round2(Math.max(0, parsed.amount - spread));
    rangeHigh = round2(parsed.amount + spread);
  }

  const existencePenalty = estimate ? 0 : 10;
  const existsLikelihoodPct = clampConf(confidencePct + (estimate ? 5 : -existencePenalty));

  return {
    id: row.id ?? null,
    name: row.name,
    estimate,
    rangeLow,
    rangeHigh,
    confidencePct,
    existsLikelihoodPct,
    lastConfirmedAt: level.observedAt,
    ageDays: level.ageDays,
    drivers,
    requiresCheck: confidencePct < 70,
    assumption: `Seed ${Math.round(level.score * 100)}% (${level.label}) adjusted by ${drivers.length} evidence factor${drivers.length === 1 ? '' : 's'}.`,
  };
}

const fmtAmount = (estimate) => {
  if (!estimate) return null;
  const n = estimate.amount;
  const shown = estimate.dim === 'count' ? String(Math.round(n)) : `${n % 1 === 0 ? n : n.toFixed(n < 10 ? 2 : 0)} ${estimate.unit}`;
  return shown;
};

/**
 * Quick pantry check — the few rows where being wrong matters most.
 * Questions are typed by what's actually unknown, never generic.
 */
export function quickCheck(rows = [], { events = [], today, limit = 3, threshold = 70 } = {}) {
  const questions = [];
  for (const row of rows || []) {
    const truth = pantryTruth(row, { events, today });
    if (!truth || !truth.requiresCheck) continue;

    const ancient = truth.ageDays == null ? false : truth.ageDays > 45;
    if (!truth.estimate && !ancient) {
      questions.push({
        rowId: row.id, name: row.name, type: 'amount',
        prompt: `${row.name} — roughly how much?`,
        confidencePct: truth.confidencePct,
      });
      continue;
    }
    if (truth.existsLikelihoodPct < 55 || (ancient && !truth.estimate)) {
      questions.push({
        rowId: row.id, name: row.name, type: 'existence',
        prompt: `${row.name} — still have it?`,
        confidencePct: truth.confidencePct,
      });
      continue;
    }
    if (truth.confidencePct < threshold) {
      questions.push({
        rowId: row.id, name: row.name, type: 'confirm',
        prompt: `${row.name} — still around ${fmtAmount(truth.estimate)}?`,
        suggestedAnswer: truth.estimate,
        rangeLow: truth.rangeLow,
        rangeHigh: truth.rangeHigh,
        confidencePct: truth.confidencePct,
      });
    }
  }
  questions.sort((a, b) => a.confidencePct - b.confidencePct);
  return {
    questions: questions.slice(0, limit),
    remaining: Math.max(0, questions.length - limit),
    assumption: questions.length
      ? 'Ranked by lowest confidence first.'
      : 'Nothing needs checking right now.',
  };
}
