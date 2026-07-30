/**
 * Word of the day — Duolingo/Memrise-style daily vocab bite.
 * Deterministic from date so the same word shows all day.
 */
import { CORE_VOCAB_PACKS } from './vocab-core.js';

function flattenEntries() {
  return CORE_VOCAB_PACKS.flatMap((pack) =>
    (pack.entries || []).map((e) => ({ ...e, packId: pack.id, packTitle: pack.title })),
  );
}

function dayIndex(date = new Date()) {
  const utc = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor(utc / 864e5);
}

export function wordOfDay(date = new Date(), entries = flattenEntries()) {
  if (!entries.length) return null;
  const i = Math.abs(dayIndex(date)) % entries.length;
  return entries[i];
}

export function wordsOfWeek(date = new Date(), count = 7, entries = flattenEntries()) {
  if (!entries.length) return [];
  const start = dayIndex(date);
  return Array.from({ length: count }, (_, n) => {
    const i = Math.abs(start - n) % entries.length;
    return entries[i];
  });
}
