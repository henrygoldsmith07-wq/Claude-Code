import { describe, it, expect } from "vitest";
import type { Entry } from "./types";
import { parseImport, sanitizeEntry, isEncryptedBlob, MAX_IMPORT_ENTRIES } from "./importExport";

function validEntry(overrides: Partial<Entry> = {}): Entry {
  return {
    id: "e1",
    createdAt: "2026-01-05T12:00:00.000Z",
    title: "Manager feedback",
    messages: [{ role: "user", content: "Manager said my handover was thin" }],
    status: "complete",
    summary: {
      trace: {
        event: "Manager gave feedback", observations: ["said needs more detail"],
        assumptions: ["they think I'm incompetent"], namedEmotion: "shame",
        alternativeInterpretations: [], intendedOutcome: "o", intendedAction: "a",
        predictedOutcome: "p", followUpAt: null, followUpNote: null,
      },
      coreEmotion: "shame", underlyingTriggers: ["critical feedback"], possibleBiases: [],
      otherPerspective: "p", balancedAssessment: "b", cautionFlags: [], suggestedNextSteps: [],
      hedgedDisclaimer: null,
    },
    ...overrides,
  };
}

describe("isEncryptedBlob", () => {
  it("recognises vault blobs", () => {
    expect(isEncryptedBlob({ v: 1, salt: "a", iv: "b", ct: "c" })).toBe(true);
    expect(isEncryptedBlob({ v: 2, ct: "c" })).toBe(false);
    expect(isEncryptedBlob([{ v: 1, ct: "c" }])).toBe(false);
    expect(isEncryptedBlob(null)).toBe(false);
  });
});

describe("parseImport — valid payloads", () => {
  it("round-trips a plain export", () => {
    const list = [validEntry(), validEntry({ id: "e2", title: "Second" })];
    const out = parseImport(JSON.stringify(list));
    expect(out.ok).toBe(true);
    expect(out.error).toBeUndefined();
    expect(out.entries.length).toBe(2);
    expect(out.entries[0].id).toBe("e1");
    expect(out.entries[1].title).toBe("Second");
    expect(out.warnings).toEqual([]);
  });

  it("preserves longitudinal reviews", () => {
    const list = [validEntry({ longitudinalReview: { actualActionTaken: "asked", actualOutcome: "it went fine", assumptionVerdict: "supported", calibrationNote: "n", reviewedAt: "2026-01-20T00:00:00.000Z" } })];
    const out = parseImport(JSON.stringify(list));
    expect(out.entries[0].longitudinalReview?.assumptionVerdict).toBe("supported");
    expect(out.entries[0].longitudinalReview?.actualActionTaken).toBe("asked");
  });
});

describe("parseImport — hostile / malformed payloads", () => {
  it("rejects encrypted vault exports instead of importing them as plaintext", () => {
    const out = parseImport(JSON.stringify({ v: 1, salt: "s", iv: "i", ct: "ciphertext" }));
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/encrypted/i);
    expect(out.entries).toEqual([]);
  });

  it("rejects non-JSON text", () => {
    const out = parseImport("not json at all {");
    expect(out.ok).toBe(false);
    expect(out.error).toMatch(/not valid json/i);
  });

  it("rejects non-array payloads", () => {
    expect(parseImport('{"entries":[]}').ok).toBe(false);
    expect(parseImport('"a string"').ok).toBe(false);
    expect(parseImport("42").ok).toBe(false);
  });

  it("skips hopeless rows and warns", () => {
    const out = parseImport(JSON.stringify([validEntry(), null, "text", 42, { id: "x" }]));
    expect(out.ok).toBe(true);
    expect(out.entries.length).toBe(2); // valid + {id:"x"}
    expect(out.warnings.some((w) => /skipped/i.test(w))).toBe(true);
  });

  it("dedupes by id — first wins", () => {
    const list = [validEntry({ title: "First" }), validEntry({ title: "Duplicate" })];
    const out = parseImport(JSON.stringify(list));
    expect(out.entries.length).toBe(1);
    expect(out.entries[0].title).toBe("First");
    expect(out.warnings.some((w) => /duplicate/i.test(w))).toBe(true);
  });

  it("caps at MAX_IMPORT_ENTRIES and warns", () => {
    const many = Array.from({ length: MAX_IMPORT_ENTRIES + 50 }, (_, i) => validEntry({ id: `e${i}` }));
    const out = parseImport(JSON.stringify(many));
    expect(out.entries.length).toBe(MAX_IMPORT_ENTRIES);
    expect(out.warnings.some((w) => /capped/i.test(w))).toBe(true);
  });
});

describe("sanitizeEntry", () => {
  it("coerces missing fields to safe defaults", () => {
    const e = sanitizeEntry({ id: "x", createdAt: "2026-01-01T00:00:00.000Z", status: "in_progress" }, 0)!;
    expect(e.title).toBe("Imported reflection");
    expect(e.messages).toEqual([]);
    // in_progress with no messages is pointless — demoted to complete
    expect(e.status).toBe("complete");
    expect(e.summary).toBeNull();
  });

  it("filters malformed messages and caps their content", () => {
    const e = sanitizeEntry(
      {
        id: "m1", createdAt: "2026-01-01T00:00:00.000Z", status: "complete",
        messages: [
          { role: "user", content: "  " },
          { role: "assistant", content: "hi there" },
          { role: "user", content: "x".repeat(10000) },
          "not a message",
          null,
          { role: "system", content: "dropped role" },
        ],
      },
      0,
    )!;
    expect(e.messages.length).toBe(2); // "hi there" + truncated user msg
    expect(e.messages[0].role).toBe("assistant");
    expect(e.messages[1].content.length).toBeLessThanOrEqual(8000);
  });

  it("drops summaries without a structured trace", () => {
    const e = sanitizeEntry({ id: "s1", createdAt: "2026-01-01T00:00:00.000Z", status: "complete", summary: { coreEmotion: "shame" } }, 0)!;
    expect(e.summary).toBeNull();
  });

  it("keeps a valid summary intact", () => {
    const raw = validEntry();
    const e = sanitizeEntry(raw, 0)!;
    expect(e.summary?.coreEmotion).toBe("shame");
    expect(e.summary?.trace.event).toBe("Manager gave feedback");
  });

  it("assigns a generated id when missing and keeps first-seen order", () => {
    const a = sanitizeEntry({ createdAt: "2026-01-01T00:00:00.000Z" }, 0)!;
    const b = sanitizeEntry({ createdAt: "2026-01-02T00:00:00.000Z" }, 1)!;
    expect(a.id).toMatch(/^import-/);
    expect(b.id).toMatch(/^import-/);
    expect(a.id).not.toBe(b.id);
  });

  it("normalises the verdict field", () => {
    const e = sanitizeEntry({ id: "v1", createdAt: "2026-01-01T00:00:00.000Z", longitudinalReview: { assumptionVerdict: "bogus", actualOutcome: "fine" } }, 0)!;
    expect(e.longitudinalReview?.assumptionVerdict).toBeNull();
    expect(e.longitudinalReview?.actualOutcome).toBe("fine");
  });
});
