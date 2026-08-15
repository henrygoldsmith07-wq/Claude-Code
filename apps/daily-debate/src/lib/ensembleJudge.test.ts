import { describe, it, expect } from "vitest";
import { ensembleVerdicts, verdictFromEnsemble } from "./ensembleJudge";
import type { JudgedVerdict } from "./ensembleJudge";

function judge(judgeId: "gemini" | "anthropic", winner: "a" | "b" | "tie", a: number, b: number): JudgedVerdict {
  return { judgeId, winner, playerAScore: a, playerBScore: b, rationale: `${judgeId} rationale` };
}

describe("ensembleVerdicts — uncertainty", () => {
  it("single judge with a close gap is 'too close to call' (tie, not a forced win)", () => {
    const e = ensembleVerdicts([judge("gemini", "a", 50, 52)]);
    expect(e.winner).toBe("tie");
    expect(e.isTie).toBe(true);
    expect(e.tieReason).toMatch(/tie threshold/);
    expect(e.confidence).toBe(0.5);
  });

  it("single judge with a clear gap keeps the winner and sets confidence", () => {
    const e = ensembleVerdicts([judge("gemini", "a", 70, 40)]);
    expect(e.winner).toBe("a");
    expect(e.isTie).toBe(false);
    expect(e.confidence).toBeGreaterThan(0.5);
    expect(e.scoreCI.lo).toBeLessThanOrEqual(e.scoreCI.hi);
  });

  it("agreeing judges raise confidence; the majority winner holds", () => {
    const e = ensembleVerdicts([judge("gemini", "a", 60, 40), judge("anthropic", "a", 58, 42)]);
    expect(e.winner).toBe("a");
    expect(e.winnerCI.a).toBe(1);
    expect(e.confidence).toBeGreaterThan(0.6);
  });

  it("split judges collapse to a tie rather than a false winner", () => {
    const e = ensembleVerdicts([judge("gemini", "a", 60, 40), judge("anthropic", "b", 40, 60)]);
    expect(e.winner).toBe("tie");
    expect(e.isTie).toBe(true);
    expect(e.tieReason).toBeDefined();
  });
});

describe("verdictFromEnsemble — persists uncertainty onto the stored verdict", () => {
  it("maps scores, confidence, CIs, tie flag, and per-judge detail", () => {
    const e = ensembleVerdicts([judge("gemini", "a", 61, 39), judge("anthropic", "a", 59, 41)]);
    const v = verdictFromEnsemble(e);

    expect(v.winner).toBe("a");
    expect(v.playerAScore).toBe(60);
    expect(v.playerBScore).toBe(40);
    expect(v.confidence).toBe(e.confidence);
    expect(v.scoreCI).toEqual(e.scoreCI);
    expect(v.winnerCI).toEqual(e.winnerCI);
    expect(v.isTie).toBe(e.isTie);
    expect(v.tieReason).toBe(e.tieReason);
    expect(v.judges).toHaveLength(2);
    expect(v.judges!.map((j) => j.judgeId)).toEqual(["gemini", "anthropic"]);
  });

  it("marks a too-close-to-call result with isTie + tieReason", () => {
    const v = verdictFromEnsemble(ensembleVerdicts([judge("anthropic", "a", 51, 49)]));
    expect(v.winner).toBe("tie");
    expect(v.isTie).toBe(true);
    expect(v.tieReason).toBeDefined();
  });
});
