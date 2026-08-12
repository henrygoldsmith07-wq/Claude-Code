#!/usr/bin/env node
// ---------------------------------------------------------------------------
// Content validator.
//
// Runs in `npm run verify` and in CI, before the tests. It checks the things
// that are properties of the *content* rather than of the code: that every
// challenge is completable by the user's own action, that no lesson smuggles in
// a script to memorise, that the skill graph is connected and acyclic, and that
// nothing in the shipped copy would fail the safety gate.
//
// These are cheap to check and expensive to get wrong: a single challenge
// phrased as "get them to agree" would undermine the product's central claim.
// ---------------------------------------------------------------------------

import { register } from "node:module";
import { pathToFileURL } from "node:url";

register("./ts-loader.mjs", pathToFileURL(`${import.meta.dirname}/`));

const { SKILLS, SKILL_DEPENDENCIES, graphIsAcyclic, getSkill } = await import("../src/domain/skills.ts");
const { LESSONS, lessonFor } = await import("../src/domain/lessons.ts");
const { CHALLENGES } = await import("../src/domain/challenges.ts");
const { SCENARIOS } = await import("../src/domain/scenarios.ts");
const { checkPracticeRequest, checkFeedbackLanguage } = await import("../src/domain/safety.ts");

const problems = [];
const fail = (message) => problems.push(message);

// --- Skill graph -----------------------------------------------------------

if (!graphIsAcyclic()) fail("Skill dependency graph contains a cycle.");

const ids = new Set();
for (const skill of SKILLS) {
  if (ids.has(skill.id)) fail(`Duplicate skill id: ${skill.id}`);
  ids.add(skill.id);
  if (skill.behaviours.length < 3) fail(`${skill.id}: needs at least three observable behaviours.`);
  if (!skill.summary.trim().endsWith(".")) fail(`${skill.id}: summary should be a sentence.`);
  if (skill.contexts.length === 0) fail(`${skill.id}: no contexts, so it can never be recommended.`);
}

for (const dep of SKILL_DEPENDENCIES) {
  if (!getSkill(dep.skill)) fail(`Dependency references unknown skill: ${dep.skill}`);
  if (!getSkill(dep.requires)) fail(`Dependency references unknown prerequisite: ${dep.requires}`);
  if (dep.rationale.length < 20) fail(`${dep.skill} -> ${dep.requires}: rationale is too thin to show a user.`);
  if (dep.minMastery <= 0 || dep.minMastery >= 1) fail(`${dep.skill} -> ${dep.requires}: minMastery must be between 0 and 1.`);
}

// --- Lessons ---------------------------------------------------------------

const SCRIPT_PHRASES = [/say exactly/i, /memorise this/i, /word[- ]for[- ]word/i, /use this exact/i];

for (const lesson of LESSONS) {
  if (!getSkill(lesson.skillId)) fail(`${lesson.id}: unknown skill ${lesson.skillId}`);
  const body = [lesson.concept, lesson.whyItMatters, lesson.example, lesson.practice, lesson.commonMistake, lesson.realWorldApplication];
  for (const [index, section] of body.entries()) {
    if (!section || section.length < 30) fail(`${lesson.id}: section ${index} is too short.`);
  }
  const words = body.join(" ").split(/\s+/).length;
  if (words > lesson.estimatedMinutes * 260) {
    fail(`${lesson.id}: ${words} words is longer than the stated ${lesson.estimatedMinutes} minute read.`);
  }
  for (const phrase of SCRIPT_PHRASES) {
    if (phrase.test(body.join(" "))) fail(`${lesson.id}: teaches a script rather than a principle.`);
  }
  for (const source of lesson.sources) {
    if (!["strong", "moderate", "practitioner-consensus"].includes(source.strength)) {
      fail(`${lesson.id}: source "${source.citation}" has an invalid strength rating.`);
    }
    if (source.claim.length < 20) fail(`${lesson.id}: source "${source.citation}" does not state what it supports.`);
  }
  const language = checkFeedbackLanguage(body.join(" "));
  if (language.verdict !== "ok") fail(`${lesson.id}: ${language.reasons.join(", ")}`);
}

for (const skill of SKILLS) {
  const lesson = lessonFor(skill.id);
  if (!lesson || lesson.concept.length < 20) fail(`${skill.id}: no usable lesson could be produced.`);
}

// --- Challenges ------------------------------------------------------------

// A challenge must be completable by what the user does. Anything that depends
// on the other person's reaction is out.
const REACTION_DEPENDENT = [
  /\bthey (?:like|enjoy|agree|respond well|are impressed)\b/i,
  /\bmake them\b/i,
  /\bget them to\b/i,
  /\buntil they\b/i,
  /\bso that they\b/i,
];

const challengeIds = new Set();
for (const challenge of CHALLENGES) {
  if (challengeIds.has(challenge.id)) fail(`Duplicate challenge id: ${challenge.id}`);
  challengeIds.add(challenge.id);
  if (!getSkill(challenge.skillId)) fail(`${challenge.id}: unknown skill ${challenge.skillId}`);
  if (challenge.completionCriteria.length < 2) fail(`${challenge.id}: needs at least two completion criteria.`);
  if (challenge.reflectionPrompt.length < 15) fail(`${challenge.id}: reflection prompt is too thin.`);
  if (challenge.contexts.length === 0) fail(`${challenge.id}: no contexts.`);

  const text = [challenge.objective, challenge.context, ...challenge.completionCriteria, challenge.easierVariant ?? "", challenge.harderVariant ?? ""].join(" ");
  for (const pattern of REACTION_DEPENDENT) {
    if (pattern.test(text)) fail(`${challenge.id}: completion depends on the other person's reaction (${pattern}).`);
  }
  const safety = checkPracticeRequest(text);
  if (safety.verdict !== "ok") fail(`${challenge.id}: fails the safety gate (${safety.reasons.join(", ")}).`);
}

const levels = new Set(CHALLENGES.map((item) => item.difficulty));
for (const level of [1, 2, 3, 4, 5]) {
  if (!levels.has(level)) fail(`No challenge at difficulty ${level}.`);
}

// --- Scenarios -------------------------------------------------------------

for (const scenario of SCENARIOS) {
  if (scenario.characters.length === 0) fail(`${scenario.id}: no characters.`);
  if (scenario.evaluationCriteria.length === 0) fail(`${scenario.id}: nothing to evaluate.`);
  for (const skillId of scenario.skillIds) {
    if (!getSkill(skillId)) fail(`${scenario.id}: unknown skill ${skillId}`);
  }
  for (const character of scenario.characters) {
    if (character.background.length === 0) fail(`${scenario.id}/${character.name}: no background, so there is nothing to follow up on.`);
  }
  const safety = checkPracticeRequest(`${scenario.context} ${scenario.objective}`);
  if (safety.verdict !== "ok") fail(`${scenario.id}: fails the safety gate (${safety.reasons.join(", ")}).`);
}

// --- Coverage --------------------------------------------------------------

const domainsWithScenarios = new Set(
  SCENARIOS.flatMap((scenario) => scenario.skillIds.map((id) => getSkill(id)?.domain)).filter(Boolean),
);
if (domainsWithScenarios.size < 6) {
  fail(`Only ${domainsWithScenarios.size} domains have a scenario; practice would be lopsided.`);
}

// --- Report ----------------------------------------------------------------

if (problems.length > 0) {
  console.error(`Content validation failed with ${problems.length} problem(s):\n`);
  for (const problem of problems) console.error(`  • ${problem}`);
  process.exit(1);
}

console.log(
  `Content OK — ${SKILLS.length} skills, ${SKILL_DEPENDENCIES.length} dependencies, ${LESSONS.length} authored lessons, ${CHALLENGES.length} challenges, ${SCENARIOS.length} scenarios.`,
);
