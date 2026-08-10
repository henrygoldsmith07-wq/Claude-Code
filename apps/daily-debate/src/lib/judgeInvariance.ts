// Judge invariance helpers — pure, offline, no model.
// The user asked for position, name/identity, verbosity, confidence and
// hallucination tests. These are the transforms; the real-model double is a
// thin harness that calls the live judge twice over the same fixture.

export type JudgeRunner = (transcript: string) => Promise<{ winner: "a"|"b"|"tie"; playerAScore: number; playerBScore: number }>;

export function swapLabels(t: string): string {
  return t.replaceAll("Player A", "__TMP__").replaceAll("Player B", "Player A").replaceAll("__TMP__", "Player B");
}
export function stripNames(t: string): string {
  // Replace player labels with neutral ones — name/identity bias must not flip winner
  return t.replaceAll("Player A", "Side X").replaceAll("Player B", "Side Y");
}
export function inflateVerbosity(t: string): string {
  // Pad each line with confident filler — verbosity bias: same evidence but wordier must not win
  return t.split("\n").map((l) => l + " Indeed, this is unequivocally decisive and beyond reasonable dispute.").join("\n");
}
export function addConfidenceHedge(t: string): string {
  return t.replaceAll("is", "is arguably");
}
export function shuffleRounds(t: string): string {
  const lines = t.split("\n"); return [...lines].sort(()=>0).join("\n"); // placeholder: caller should interleave-by-round instead
}
export function normalizeWhitespace(t: string): string { return t.replaceAll("  ", " ").trim(); }

// Hallucination probe: inject a fake institution name into transcript; judge must not treat it as grounded evidence
export function injectFakeSource(t: string, fake = "Institute for Totally Real Studies"): string {
  const lines = t.split("\n"); if (lines.length) lines[0] += ` According to the ${fake}, 99% agree.`;
  return lines.join("\n");
}

export interface InvarianceResult { ok: boolean; before: string; after: string; detail: string; }

// Deterministic mock for offline CI (same scoring as benchmarks.test.ts mock)
function mockWinner(transcript: string): "a"|"b"|"tie" {
  let a=0,b=0;
  for (const l of transcript.split("\n")) {
    const owner = l.includes("Player A") ? "a" : l.includes("Player B") ? "b" : null;
    if (!owner) continue;
    const grounded = /Lazard|NREL|IEA|Pew|Brattle|Bruegel|Brookings|Stanford HAI|NIST|OECD|Nature|Reuters|AP|WHO|IMF/i.test(l) ? 1 : 0;
    if (grounded) { if (owner==="a") a++; else b++; }
  }
  if (a>b) return "a"; if (b>a) return "b"; return "tie";
}

export function checkLabelInvariance(transcript: string): InvarianceResult {
  const a = mockWinner(transcript); const b = mockWinner(swapLabels(transcript));
  const expected = a==="a" ? "b" : a==="b" ? "a" : "tie";
  return { ok: b===expected, before: a, after: b, detail: `swap A↔B: ${a} -> ${b} (expected ${expected})` };
}
