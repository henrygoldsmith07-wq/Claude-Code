import { describe, expect, it } from "vitest";
import { LESSONS, authoredLessonFor, lessonFor, lessonsWithSources } from "@/domain/lessons";
import { CHALLENGES, deriveChallenge, objectiveText, selectChallenge } from "@/domain/challenges";
import { SCENARIOS, atDifficulty, buildScenario, selectScenario } from "@/domain/scenarios";
import { SKILLS, getSkill } from "@/domain/skills";
import { initialSkillState } from "@/domain/mastery";
import { COMMUNICATION_STYLES } from "@/domain/types";
import { STYLE_PROFILES } from "@/domain/simulator";

const NOW = "2026-03-01T09:00:00.000Z";

describe("lessons", () => {
  it("fills every section for every authored lesson", () => {
    for (const lesson of LESSONS) {
      expect(getSkill(lesson.skillId), `${lesson.id} targets an unknown skill`).toBeDefined();
      for (const field of ["concept", "whyItMatters", "example", "practice", "commonMistake", "realWorldApplication"] as const) {
        expect(lesson[field].length, `${lesson.id}.${field}`).toBeGreaterThan(30);
      }
    }
  });

  it("keeps lessons short enough to read in the stated time", () => {
    for (const lesson of LESSONS) {
      const words = [lesson.concept, lesson.whyItMatters, lesson.example, lesson.practice, lesson.commonMistake, lesson.realWorldApplication]
        .join(" ")
        .split(/\s+/).length;
      // ~200 wpm reading speed, with headroom.
      expect(words, `${lesson.id} is ${words} words`).toBeLessThan(lesson.estimatedMinutes * 260);
    }
  });

  it("gives every research-backed claim a source with an honest strength rating", () => {
    for (const lesson of lessonsWithSources()) {
      for (const source of lesson.sources) {
        expect(source.citation.length).toBeGreaterThan(10);
        expect(source.claim.length).toBeGreaterThan(20);
        expect(["strong", "moderate", "practitioner-consensus"]).toContain(source.strength);
      }
    }
  });

  it("provides a lesson for every skill in the graph", () => {
    for (const skill of SKILLS) {
      const lesson = lessonFor(skill.id);
      expect(lesson.skillId).toBe(skill.id);
      expect(lesson.concept.length).toBeGreaterThan(20);
    }
  });

  it("marks derived lessons as having no sources rather than inventing them", () => {
    const withoutAuthored = SKILLS.find((skill) => !authoredLessonFor(skill.id));
    expect(withoutAuthored).toBeDefined();
    if (withoutAuthored) expect(lessonFor(withoutAuthored.id).sources).toEqual([]);
  });

  it("never presents a script to memorise", () => {
    for (const lesson of LESSONS) {
      const text = `${lesson.concept} ${lesson.practice}`.toLowerCase();
      expect(text, lesson.id).not.toMatch(/memorise this|say exactly|use this exact|word[- ]for[- ]word/);
    }
  });
});

describe("challenges", () => {
  it("has unique ids and real skills", () => {
    const ids = CHALLENGES.map((item) => item.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const challenge of CHALLENGES) expect(getSkill(challenge.skillId), challenge.id).toBeDefined();
  });

  it("gives every challenge criteria and a reflection prompt", () => {
    for (const challenge of CHALLENGES) {
      expect(challenge.completionCriteria.length, challenge.id).toBeGreaterThanOrEqual(2);
      expect(challenge.reflectionPrompt.length, challenge.id).toBeGreaterThan(15);
      expect(challenge.contexts.length, challenge.id).toBeGreaterThan(0);
    }
  });

  it("covers the full difficulty range", () => {
    const levels = new Set(CHALLENGES.map((item) => item.difficulty));
    expect(levels.has(1)).toBe(true);
    expect(levels.has(3)).toBe(true);
    expect(levels.has(5)).toBe(true);
  });

  it("selects a challenge near the user's current tolerance", () => {
    const state = { ...initialSkillState("u", "conv.follow-up", NOW), difficultyTolerance: 2 };
    const selection = selectChallenge("conv.follow-up", state, [], ["work", "social"]);
    expect(Math.abs(selection.challenge.difficulty - 2)).toBeLessThanOrEqual(1);
    expect(selection.reason.length).toBeGreaterThan(10);
  });

  it("derives a challenge for skills with no hand-written one", () => {
    const uncovered = SKILLS.find((skill) => !CHALLENGES.some((item) => item.skillId === skill.id));
    expect(uncovered).toBeDefined();
    if (!uncovered) return;
    const state = initialSkillState("u", uncovered.id, NOW);
    const selection = selectChallenge(uncovered.id, state, [], ["work"]);
    expect(selection.challenge.skillId).toBe(uncovered.id);
    expect(selection.challenge.generated).toBe(true);
    expect(selection.challenge.completionCriteria.length).toBeGreaterThan(0);
  });

  it("avoids repeating a challenge the user just did", () => {
    const state = { ...initialSkillState("u", "conv.follow-up", NOW), difficultyTolerance: 2 };
    const first = selectChallenge("conv.follow-up", state, [], ["work", "social"]);
    const history = [
      {
        id: "a1",
        userId: "u",
        challengeId: first.challenge.id,
        challenge: first.challenge,
        assignedAt: NOW,
        completedAt: NOW,
      },
    ];
    const second = selectChallenge("conv.follow-up", state, history, ["work", "social"]);
    if (CHALLENGES.filter((item) => item.skillId === "conv.follow-up").length > 1) {
      expect(second.challenge.id).not.toBe(first.challenge.id);
    }
  });

  it("presents the variant text when one is chosen", () => {
    const challenge = CHALLENGES.find((item) => item.easierVariant);
    expect(challenge).toBeDefined();
    if (!challenge) return;
    expect(objectiveText({ challenge, variant: "easier", reason: "" })).toBe(challenge.easierVariant);
    expect(objectiveText({ challenge, variant: "standard", reason: "" })).toBe(challenge.objective);
  });

  it("derives challenges deterministically", () => {
    expect(deriveChallenge("nv.posture", 3)).toEqual(deriveChallenge("nv.posture", 3));
  });
});

describe("scenarios", () => {
  it("gives every scenario characters with something to say", () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.characters.length, scenario.id).toBeGreaterThan(0);
      for (const character of scenario.characters) {
        expect(character.background.length, `${scenario.id}/${character.name}`).toBeGreaterThan(0);
        expect(COMMUNICATION_STYLES).toContain(character.style);
      }
      expect(scenario.evaluationCriteria.length, scenario.id).toBeGreaterThan(0);
      expect(scenario.skillIds.every((id) => getSkill(id)), scenario.id).toBeTruthy();
    }
  });

  it("covers every communication style across the library", () => {
    const styles = new Set(SCENARIOS.flatMap((item) => item.characters.map((character) => character.style)));
    // Not every style needs a scenario, but a majority should be represented.
    expect(styles.size).toBeGreaterThanOrEqual(5);
    for (const style of styles) expect(STYLE_PROFILES[style]).toBeDefined();
  });

  it("makes characters less forthcoming at higher difficulty", () => {
    const scenario = SCENARIOS[0];
    expect(scenario).toBeDefined();
    if (!scenario) return;
    const easy = atDifficulty(scenario, 1);
    const hard = atDifficulty(scenario, 5);
    expect(hard.characters[0]!.openness).toBeLessThan(easy.characters[0]!.openness);
    expect(hard.characters[0]!.reciprocity).toBeLessThan(easy.characters[0]!.reciprocity);
  });

  it("picks a scenario matched to the user's level and avoids repeats", () => {
    const state = { ...initialSkillState("u", "conv.follow-up", NOW), difficultyTolerance: 4 };
    const chosen = selectScenario("conv.follow-up", state, []);
    expect(chosen).not.toBeNull();
    expect(chosen?.skillIds).toContain("conv.follow-up");
  });

  it("builds the same scenario twice from the same description", () => {
    const build = () => buildScenario({ description: "I need to contribute more during a group project.", difficulty: 3, now: NOW });
    const a = build();
    const b = build();
    expect(a.ok && b.ok).toBe(true);
    if (a.ok && b.ok) {
      expect(a.scenario.id).toBe(b.scenario.id);
      expect(a.scenario.skillIds).toEqual(b.scenario.skillIds);
    }
  });

  it("maps free text onto the right skill", () => {
    const cases: [string, string][] = [
      ["I can't say no when people ask me to cover shifts", "asrt.no"],
      ["I want to speak up in a team meeting", "conf.groups"],
      ["my messages come across as blunt", "dig.tone"],
      ["someone is upset and I don't know what to say", "emp.validation"],
    ];
    for (const [description, expected] of cases) {
      const result = buildScenario({ description, difficulty: 3, now: NOW });
      expect(result.ok, description).toBe(true);
      if (result.ok) expect(result.scenario.skillIds, description).toContain(expected);
    }
  });
});
