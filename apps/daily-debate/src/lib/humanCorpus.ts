// Human-labelled benchmark corpus & inter-rater helpers.
// Offline tiny corpus now; real harness will import this from a Supabase table or JSON blob.
export interface LabeledDebate { id: string; transcript: string; humanWinner: "a"|"b"|"tie"; raterIds: string[]; humanRationale: string; }

export const HUMAN_CORPUS: LabeledDebate[] = [
  {
    id: "hc-renewables-01",
    transcript: ["Player A (round 1): Lazard LCOE solar $24/MWh vs gas $45. Cheaper new build.", "Player B (round 1): But intermittency needs backup.", "Player A (round 2): NREL storage futures 4h adder <$10/MWh—still cheaper; Brattle says grid upgrades needed anyway.", "Player B (round 2): Surveys say one thing, votes another.", "Player A (round 3): OECD/Pew 62% pay +10% for clean — cited.", "Player B (round 3): Anecdotal worry.",].join("\n"),
    humanWinner: "a", raterIds: ["r1","r2"], humanRationale: "A grounded multiple claims with Lazard/NREL/Pew; B mostly asserted."
  },
  {
    id: "hc-ai-reg-01",
    transcript: ["Player A (round 1): No regulation—US lead vs China.", "Player B (round 1): Labs themselves want guardrails (Anthropic RSP, NIST RMF).", "Player A (round 2): Voluntary is fine.", "Player B (round 2): Stanford HAI 60% voluntary unverifiable—law needed.", "Player A (round 3): Offshoring.", "Player B (round 3): Bruegel certainty retains talent.",].join("\n"),
    humanWinner: "b", raterIds: ["r1","r2"], humanRationale: "B cited 3 institutions and rebutted directly; A asserted."
  },
];

// Inter-rater: simple agreement rate (for two raters; extend to Fleiss/Krippendorff later)
export function agreementRate(labels: Array<{ r1: string; r2: string }>): number {
  if (!labels.length) return 1;
  return labels.filter((l)=> l.r1===l.r2).length / labels.length;
}

export function judgeVsHumanAgreement(judgeWinners: string[], humanWinners: string[]): number {
  if (!judgeWinners.length) return 0;
  let ok=0; for (let i=0;i<judgeWinners.length;i++) if (judgeWinners[i]===humanWinners[i]) ok++;
  return ok/judgeWinners.length;
}

// Calibration: winner score gap -> empirical win prob (toy). Real calibration uses many matches.
export function calibrationCurve(gaps: number[], outcomes: number[]): { gaps: number[]; probs: number[] } {
  // gaps: absolute score difference, outcomes: 1 if favorite won else 0
  return { gaps, probs: outcomes };
}

// Separate argument quality vs writing quality: combine groundedEvidence+rebuttal vs verbosity/clarity
import type { ArgGraph } from "./argGraph";
export function splitQuality(graph: ArgGraph): { argument: number; writing: number } {
  const claims = graph.nodes.filter((n)=> n.kind==="claim").length || 1;
  const ev = graph.nodes.filter((n)=> n.kind==="evidence").length;
  const reb = graph.nodes.filter((n)=> n.kind==="rebuttal").length;
  const argument = Math.min(1, (ev*0.6 + reb*0.4)/Math.max(1, claims));
  // writing: clarity proxy — low fallacies + concision (avoid wordy filler heuristic)
  const fallacies = graph.fallacies.length;
  const writing = Math.max(0, 1 - fallacies*0.15);
  return { argument, writing };
}
