// Multilingual: translation pipeline (Gemini, cached per text) + language detection.
// No extra key — uses GEMINI_API_KEY when present; otherwise identity (no-op).

import { GoogleGenAI } from "@google/genai";

function getKey(): string | null {
  const list = [
    ...(process.env.GEMINI_API_KEYS ?? "").split(/[\s,]+/),
    process.env.GEMINI_API_KEY ?? "",
  ].map(s=>s.trim()).filter(Boolean);
  return list[0] ?? null;
}

const CACHE = new Map<string, string>();
const MAX_CACHE = 400;

export type LangCode = string; // ISO 639-1, e.g. "fr", "de"

const LANG_HINT: Record<string, string> = {
  fr: "French", de: "German", es: "Spanish", it: "Italian", pt: "Portuguese",
  ja: "Japanese", zh: "Chinese", ar: "Arabic", ru: "Russian", pl: "Polish",
  nl: "Dutch", tr: "Turkish", ko: "Korean", hi: "Hindi", uk: "Ukrainian",
};

export function detectLangHint(text: string): LangCode | null {
  // Very light heuristic for routing; real detection is left to the model.
  if (/[\u3040-\u309f\u30a0-\u30ff\u4e00-\u9fff]/.test(text)) return "ja";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[\u0600-\u06ff]/.test(text)) return "ar";
  if (/[\u0400-\u04ff]/.test(text)) return "ru";
  return null;
}

function cacheKey(text: string, target: LangCode): string { return `${target}::${text.slice(0, 800)}`; }

export async function translate(text: string, target: LangCode = "en"): Promise<string> {
  if (!text.trim() || target === "en") return text;
  const k = cacheKey(text, target);
  if (CACHE.has(k)) return CACHE.get(k)!;
  const apiKey = getKey();
  if (!apiKey) return text;
  const langName = LANG_HINT[target] ?? target;
  try {
    const ai = new GoogleGenAI({ apiKey });
    const res = await ai.models.generateContent({
      model: "gemini-2.0-flash",
      contents: `Translate the following text to ${langName}. Return ONLY the translation, no notes or quotes:\n\n${text.slice(0, 4000)}`,
      config: { temperature: 0.1 },
    });
    const out = (res.text ?? "").trim() || text;
    if (CACHE.size >= MAX_CACHE) { const first = CACHE.keys().next().value as string | undefined; if (first) CACHE.delete(first); }
    CACHE.set(k, out);
    return out;
  } catch { return text; }
}

/** Batch translate (sequential, small batches to respect rate limits). */
export async function translateBatch(texts: string[], target: LangCode = "en"): Promise<string[]> {
  const out: string[] = [];
  for (const t of texts) out.push(await translate(t, target));
  return out;
}

export function translateConfigured(): boolean { return Boolean(getKey()); }
