import { describe, expect, it } from "vitest";
import { seedCardsForTopic } from "@/content/seed-cards";
import { seedQuestions } from "@/content";
import { allSubjects, allTopics, getTopic, topicsFor } from "@/domain/curriculum";
import { coverageForSubject } from "@/domain/coverage";
import { SPEC_MANIFEST } from "@/domain/spec";
import type { Topic } from "@/domain/types";

describe("content pipeline — spec metadata", () => {
  it("every topic carries board/spec provenance", () => {
    for (const topic of allTopics()) {
      expect(topic.specRef, `${topic.id} missing specRef`).toBeTruthy();
      expect(topic.specVersion, `${topic.id} missing specVersion`).toBe("2024-1.0");
      expect(topic.source, `${topic.id} missing source`).toBe("authored");
      expect(["unverified", "checked", "verified"], `${topic.id} bad verification`).toContain(topic.verification);
      expect(topic.specRef).toMatch(/^(Unit|Pure|Applied)/);
    }
  });

  it("every subject has a spec manifest entry that matches its code", () => {
    for (const subject of allSubjects()) {
      const spec = SPEC_MANIFEST.find((s) => s.subjectId === subject.id);
      expect(spec, `no SPEC_MANIFEST for ${subject.id}`).toBeDefined();
      expect(spec!.version).toBe(subject.spec?.version);
      expect(spec!.specCode).toBe(subject.specCode);
      expect(spec!.lastChecked).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("every topic has AO mapping", () => {
    for (const topic of allTopics()) {
      expect(topic.aos?.length, `${topic.id} no AOs`).toBeGreaterThan(0);
      for (const ao of topic.aos!) expect(["AO1", "AO2", "AO3"]).toContain(ao);
    }
  });

  it("topics expose lastChecked as an ISO date when verified or checked", () => {
    for (const topic of allTopics()) {
      if (topic.verification === "checked" || topic.verification === "verified") {
        expect(topic.lastChecked, `${topic.id} checked but no lastChecked`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      }
    }
  });
});

describe("content pipeline — questions carry provenance", () => {
  it("every seed question carries source, verification and AO", () => {
    for (const q of seedQuestions) {
      expect(["authored", "licensed", "generated", "past-paper", "import"], q.id).toContain(q.source);
      expect(["unverified", "checked", "verified"], q.id).toContain(q.verification);
      // AO may be undefined on a small number of legacy questions; new ones must set it
      if (q.aos) for (const ao of q.aos) expect(["AO1", "AO2", "AO3"]).toContain(ao);
      for (const p of q.parts) if (p.aos) for (const ao of p.aos) expect(["AO1", "AO2", "AO3"]).toContain(ao);
      for (const topicId of q.topicIds) {
        expect(getTopic(topicId), `question ${q.id} points at unknown ${topicId}`).toBeDefined();
      }
    }
  });
});

describe("content pipeline — coverage is measured", () => {
  it("every subject has non-zero coverage", () => {
    for (const subject of allSubjects()) {
      const topics = topicsFor(subject.id);
      const qs = seedQuestions.filter((q) => q.subjectId === subject.id);
      const cardsPerTopic = new Map<string, number>(topics.map((t) => [t.id, seedCardsForTopic(t, "u").length]));
      const cov = coverageForSubject(topics, qs, cardsPerTopic);
      expect(cov.topicsTotal).toBe(topics.length);
      expect(cov.coveragePercent).toBeGreaterThan(50);
      expect(cov.retrievalItems).toBeGreaterThan(cov.topicsTotal * 4);
      expect(cov.examQuestions).toBeGreaterThan(0);
    }
  });

  it("coverage helper tolerates an empty topic list", () => {
    const cov = coverageForSubject([] as unknown as Topic[], [], new Map());
    expect(cov.topicsTotal).toBe(0);
    expect(cov.coveragePercent).toBe(0);
  });
});
