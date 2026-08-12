import { describe, expect, it } from "vitest";
import {
  checkCriticismBalance,
  checkFeedbackLanguage,
  checkForDistress,
  checkGeneratedContent,
  checkPracticeRequest,
} from "@/domain/safety";
import { route } from "@/domain/coach";
import { buildScenario } from "@/domain/scenarios";
import { CHALLENGES } from "@/domain/challenges";
import { initialSkillState } from "@/domain/mastery";
import { SKILLS } from "@/domain/skills";

const NOW = "2026-03-01T09:00:00.000Z";
const states = SKILLS.map((skill) => initialSkillState("u", skill.id, NOW));

describe("practice request gate", () => {
  it("allows ordinary training requests", () => {
    const allowed = [
      "I need to contribute more during a group project.",
      "I want to be able to say no to extra work.",
      "Conversations with new people dry up after a minute.",
      "I want to tell my manager I disagree with the plan.",
      "I'd like to invite a colleague for coffee.",
    ];
    for (const text of allowed) {
      expect(checkPracticeRequest(text).verdict, text).toBe("ok");
    }
  });

  it("refuses manipulation framing with a usable alternative", () => {
    const result = checkPracticeRequest("How do I get them to agree to my plan without them noticing?");
    expect(result.verdict).toBe("rewrite");
    expect(result.message).toMatch(/clear|plainly/i);
  });

  it("blocks unsafe approach scenarios", () => {
    const result = checkPracticeRequest("practise approaching someone at night in an empty car park");
    expect(result.verdict).toBe("block");
    expect(result.reasons).toContain("isolation");
  });

  it("blocks pressing past a refusal", () => {
    expect(checkPracticeRequest("what do I say if she won't take no for an answer from me").verdict).toBe("block");
    expect(checkPracticeRequest("keep messaging until they reply").verdict).toBe("block");
  });

  it("blocks seduction technique", () => {
    expect(checkPracticeRequest("teach me pickup lines").verdict).toBe("rewrite");
    expect(checkPracticeRequest("how does negging work").verdict).toBe("rewrite");
  });

  it("steps out of the way when someone discloses distress", () => {
    const result = checkForDistress("Honestly I've been thinking about ending my life.");
    expect(result?.verdict).toBe("support");
    expect(result?.message).toMatch(/116 123|emergency/i);
    // It must not steer the person back into the product.
    expect(result?.message).not.toMatch(/try (?:a|an|the) (?:exercise|challenge|simulation)|practise this|next session/i);
  });

  it("recognises disclosed abuse as out of scope for training", () => {
    const result = checkForDistress("My partner threatens me when I try to leave.");
    expect(result?.verdict).toBe("support");
    expect(result?.message).toMatch(/0808 2000 247/);
  });

  it("prioritises distress over any other verdict", () => {
    const result = checkPracticeRequest("I want to make them agree with me. I want to die.");
    expect(result.verdict).toBe("support");
  });
});

describe("generated content gate", () => {
  it("blocks model output that drifts into persuasion technique", () => {
    const result = checkGeneratedContent("Try to wear them down until they say yes.");
    expect(result.verdict).toBe("block");
  });

  it("passes ordinary coaching language", () => {
    expect(checkGeneratedContent("Ask one follow-up question about the detail they mentioned.").verdict).toBe("ok");
  });

  it("blocks appearance comments in feedback", () => {
    expect(checkFeedbackLanguage("You came across as very attractive and confident.").verdict).toBe("block");
  });

  it("blocks trait inference in feedback", () => {
    expect(checkFeedbackLanguage("You sound quite socially anxious in this transcript.").verdict).toBe("block");
    expect(checkFeedbackLanguage("You're clearly an introvert.").verdict).toBe("block");
  });

  it("allows behavioural feedback", () => {
    expect(
      checkFeedbackLanguage("Three of your five replies referenced what they had just said.").verdict,
    ).toBe("ok");
  });

  it("requires at least one thing that worked before an improvement", () => {
    expect(checkCriticismBalance([], 2).verdict).toBe("rewrite");
    expect(checkCriticismBalance(["You asked two open questions."], 1).verdict).toBe("ok");
  });
});

describe("safety at the product surface", () => {
  it("refuses manipulation questions in the coach and offers a rewrite", () => {
    const result = route("How do I manipulate my colleague into covering my shift?", states);
    expect(result.kind).toBe("refused");
    if (result.kind === "refused") expect(result.message.length).toBeGreaterThan(40);
  });

  it("refuses to build an unsafe scenario", () => {
    const result = buildScenario({
      description: "I want to follow her home and talk to her",
      difficulty: 3,
      now: NOW,
    });
    expect(result.ok).toBe(false);
  });

  it("builds an ordinary scenario without complaint", () => {
    const result = buildScenario({
      description: "I need to contribute more during a group project.",
      difficulty: 3,
      now: NOW,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.scenario.characters.length).toBeGreaterThan(0);
      expect(result.scenario.safetyCheckedAt).toBe(NOW);
      expect(result.scenario.evaluationCriteria.length).toBeGreaterThan(0);
    }
  });

  it("keeps every challenge completable by the user's own action", () => {
    // A challenge whose completion depends on the other person's reaction is
    // exactly the failure mode this product is built to avoid.
    const reactionWords = /\b(they (like|enjoy|agree|respond well)|make them|get them to|until they)\b/i;
    for (const challenge of CHALLENGES) {
      expect(reactionWords.test(challenge.objective), challenge.id).toBe(false);
      for (const criterion of challenge.completionCriteria) {
        expect(reactionWords.test(criterion), `${challenge.id}: ${criterion}`).toBe(false);
      }
    }
  });

  it("never asks a user to do something unsafe in a challenge", () => {
    for (const challenge of CHALLENGES) {
      const text = `${challenge.objective} ${challenge.context} ${challenge.easierVariant ?? ""} ${challenge.harderVariant ?? ""}`;
      expect(checkPracticeRequest(text).verdict, challenge.id).toBe("ok");
    }
  });
});
