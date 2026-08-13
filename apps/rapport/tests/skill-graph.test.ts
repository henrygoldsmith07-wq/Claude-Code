import { describe, expect, it } from "vitest";
import {
  SKILLS,
  SKILL_DEPENDENCIES,
  DOMAIN_LABELS,
  ALL_DOMAINS,
  getSkill,
  graphIsAcyclic,
  prerequisitesOf,
  skillDepth,
  transitivePrerequisites,
  unmetPrerequisites,
} from "@/domain/skills";

describe("skill graph", () => {
  it("has unique ids", () => {
    const ids = SKILLS.map((skill) => skill.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("covers every domain with at least five skills", () => {
    for (const domain of ALL_DOMAINS) {
      const count = SKILLS.filter((skill) => skill.domain === domain).length;
      expect(count, `${domain} has too few skills`).toBeGreaterThanOrEqual(5);
    }
  });

  it("labels every domain", () => {
    for (const domain of ALL_DOMAINS) expect(DOMAIN_LABELS[domain]).toBeTruthy();
  });

  it("only references skills that exist", () => {
    for (const dep of SKILL_DEPENDENCIES) {
      expect(getSkill(dep.skill), `unknown skill ${dep.skill}`).toBeDefined();
      expect(getSkill(dep.requires), `unknown prerequisite ${dep.requires}`).toBeDefined();
    }
  });

  it("is acyclic", () => {
    expect(graphIsAcyclic()).toBe(true);
  });

  it("gives every dependency a rationale the UI can show", () => {
    for (const dep of SKILL_DEPENDENCIES) {
      expect(dep.rationale.length, `${dep.skill} -> ${dep.requires}`).toBeGreaterThan(20);
      expect(dep.minMastery).toBeGreaterThan(0);
      expect(dep.minMastery).toBeLessThan(1);
    }
  });

  it("defines behaviours in observable terms, not traits", () => {
    // Trait words would make a skill un-trainable, which is the whole premise.
    const forbidden = /\b(confident person|shy|introvert|extrovert|charismatic|likeable|awkward person)\b/i;
    for (const skill of SKILLS) {
      expect(skill.behaviours.length, skill.id).toBeGreaterThanOrEqual(3);
      for (const behaviour of skill.behaviours) {
        expect(forbidden.test(behaviour), `${skill.id}: ${behaviour}`).toBe(false);
      }
      expect(forbidden.test(skill.summary), skill.id).toBe(false);
    }
  });

  it("keeps harder skills deeper in the graph than foundational ones", () => {
    const conflict = skillDepth("diff.conflict");
    const opinions = skillDepth("conf.opinions");
    expect(conflict).toBeGreaterThan(opinions);
  });

  it("routes an unmet prerequisite chain deepest-first", () => {
    const mastery = (id: string) => (id === "conf.speaking-clearly" ? 0.1 : 0.1);
    const unmet = unmetPrerequisites("asrt.disagree", mastery);
    const ids = unmet.map((dep) => dep.requires);
    // Speaking clearly underpins opinions, which underpins disagreeing.
    expect(ids).toContain("conf.speaking-clearly");
    expect(ids).toContain("conf.opinions");
    expect(ids.indexOf("conf.speaking-clearly")).toBeLessThan(ids.indexOf("conf.opinions"));
  });

  it("reports no unmet prerequisites when everything is mastered", () => {
    expect(unmetPrerequisites("diff.conflict", () => 1)).toEqual([]);
  });

  it("terminates on transitive lookups for every skill", () => {
    for (const skill of SKILLS) {
      expect(() => transitivePrerequisites(skill.id)).not.toThrow();
    }
  });

  it("never makes a skill its own prerequisite", () => {
    for (const skill of SKILLS) {
      expect(prerequisitesOf(skill.id).some((dep) => dep.requires === skill.id)).toBe(false);
    }
  });
});
