import { describe, it, expect } from "vitest";
import type { Entry } from "./types";
import { fullPrivacyAudit, USER_DATA_KEYS } from "./privacyAudit";
import { reflectSnapshot } from "./pulse";
import { containsVerbatimEntryText } from "./privacy";

function entry(over: Partial<Entry> = {}): Entry {
  return {
    id:"e1", createdAt:"2026-01-01T00:00:00.000Z", title:"Manager feedback",
    messages:[{role:"user", content:"Manager said my handover was thin and I felt shame"}],
    status:"complete",
    summary:{
      trace:{ event:"Manager gave critical feedback in standup", observations:["they said needs more detail"], assumptions:["they think I am incompetent"], namedEmotion:"shame", alternativeInterpretations:[], intendedOutcome:"o", intendedAction:"a", predictedOutcome:"p", followUpAt:null, followUpNote:null },
      coreEmotion:"shame", underlyingTriggers:["critical feedback"], possibleBiases:[], otherPerspective:"p", balancedAssessment:"b", cautionFlags:[], suggestedNextSteps:[], hedgedDisclaimer:null
    }, ...over
  };
}

describe("privacy audit", () => {
  it("auditLogs fails when verbatim leaks", () => {
    const e = entry();
    const report = fullPrivacyAudit({ entries:[e], logLines:["ERROR: they think I am incompetent was processed"] });
    expect(report.surfaces.find(s=>s.area==="logs")?.status).toBe("fail");
    expect(report.overall).toBe("fail");
  });
  it("auditLogs passes for counts-only diagnostics", () => {
    const e = entry();
    const report = fullPrivacyAudit({ entries:[e], logLines:["3 reflections · 1 reviewed"]});
    expect(report.surfaces.find(s=>s.area==="logs")?.status).toBe("pass");
  });
  it("auditAnalytics passes for pulse snapshot (counts not content)", () => {
    const e = entry();
    const snap = reflectSnapshot([e]);
    const report = fullPrivacyAudit({ entries:[e], analyticsPayload: snap });
    expect(report.surfaces.find(s=>s.area==="analytics")?.status).toBe("pass");
    expect(JSON.stringify(snap)).not.toContain("they think I am incompetent");
  });
  it("auditAnalytics fails if verbatim leaked in analytics", () => {
    const e = entry();
    const payload = { event: "Manager gave critical feedback in standup" };
    const report = fullPrivacyAudit({ entries:[e], analyticsPayload: payload });
    expect(report.surfaces.find(s=>s.area==="analytics")?.status).toBe("fail");
  });
  it("auditAiProviderPayload passes for lightweight hints", () => {
    const e = entry();
    const payload = { entries: [{id:"e1", coreEmotion:"shame", triggers:["critical feedback"]}]};
    const report = fullPrivacyAudit({ entries:[e], aiPayload: payload });
    expect(report.surfaces.find(s=>s.area==="aiProvider")?.status).toBe("pass");
  });
  it("auditKeyHandling distinguishes local-only vs stored key", () => {
    expect(fullPrivacyAudit({ entries:[entry()], apiKey:null }).surfaces.find(s=>s.area==="keyHandling")?.status).toBe("pass");
    expect(fullPrivacyAudit({ entries:[entry()], apiKey:"sk-test-1234567890" }).surfaces.find(s=>s.area==="keyHandling")?.status).toBe("pass");
  });
  it("USER_DATA_KEYS covers export/deletion surfaces", () => {
    expect(USER_DATA_KEYS).toContain("reflectEntries");
    expect(USER_DATA_KEYS).toContain("reflectVault");
    expect(USER_DATA_KEYS).toContain("reflectHumanReviewCorpus");
  });
  it("containsVerbatimEntryText never flags short counts", () => {
    const e = entry();
    expect(containsVerbatimEntryText("3 reflections", [e])).toBeNull();
  });
});
