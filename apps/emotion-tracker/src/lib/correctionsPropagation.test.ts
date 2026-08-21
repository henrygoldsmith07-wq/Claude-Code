import { describe, it, expect } from "vitest";
import { createCorrection, violatesCorrection, filterAssumptionsByCorrections, patternKey, assumptionGroupKey } from "./corrections";

describe("correction propagation", () => {
  it("stores rejected interpretation with reason and timestamp", () => {
    const c = createCorrection({ key: patternKey({kind:"bias",label:"catastrophizing"}), kind:"pattern", rejectedInterpretation:"You have catastrophizing bias", reason:"too strong", affectedPatterns:["catastrophizing"], replacementUnderstanding:"Maybe I was worried" });
    expect(c.rejectedInterpretation).toBe("You have catastrophizing bias");
    expect(c.affectedPatterns).toContain("catastrophizing");
    expect(c.replacementUnderstanding).toBe("Maybe I was worried");
    expect(c.timestamp).toBeTruthy();
    expect(new Date(c.rejectedAt).getTime()).not.toBeNaN();
  });
  it("violatesCorrection flags repeated rejected assumption", () => {
    const key = assumptionGroupKey("they think I am incompetent");
    const c = createCorrection({ key, kind:"assumption", rejectedInterpretation:"they think I am incompetent", reason:"not evidenced" });
    expect(violatesCorrection("they think I am incompetent", [c])).not.toBeNull();
    expect(violatesCorrection("they think I am incompetent at work", [c])).not.toBeNull(); // substring
    expect(violatesCorrection("weather is nice", [c])).toBeNull();
  });
  it("filterAssumptionsByCorrections removes rejected without new evidence", () => {
    const c = createCorrection({ key: assumptionGroupKey("always ignored"), kind:"assumption", rejectedInterpretation:"always ignored" });
    const filtered = filterAssumptionsByCorrections(["always ignored","something else"], [c]);
    expect(filtered).toEqual(["something else"]);
  });
  it("regression: rejected assumption does not return without new evidence", () => {
    const rejected = "they will never help me";
    const c = createCorrection({ key: assumptionGroupKey(rejected), kind:"assumption", rejectedInterpretation: rejected });
    const futureAssumptions = ["they will never help me", "they might help if asked"];
    const kept = filterAssumptionsByCorrections(futureAssumptions, [c]);
    expect(kept).not.toContain("they will never help me");
    expect(kept).toContain("they might help if asked");
  });
  it("replacement understanding is preserved", () => {
    const c = createCorrection({ key:"pattern:emotion:shame", kind:"pattern", replacementUnderstanding:"It was guilt not shame" });
    expect(c.replacementUnderstanding).toBe("It was guilt not shame");
  });
});
