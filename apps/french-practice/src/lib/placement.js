// Adaptive placement test.
//
// The old test asked twelve fixed questions and mapped the raw score to a
// band. That has two problems: a B2 learner spends the first six questions
// proving they are not A1, and a lucky guess at C1 moves the band as much as
// a confident answer at A2. Worse, it reported a level with no notion of how
// sure it was.
//
// This runs a small computer-adaptive test instead. Items carry a difficulty
// on the CEFR logit scale; after each answer the learner's ability estimate
// moves toward the evidence, the next item is chosen closest to the current
// estimate (where it is most informative), and the test stops once the
// standard error is small enough — or the item budget runs out.
//
// The maths is Rasch (one-parameter IRT) with a Newton–Raphson update, which
// is the least machinery that gives a defensible standard error. Everything
// here is pure: no storage, no network.

import { LEVELS } from './cefr.js';

// Ability and difficulty share a scale where each CEFR band spans 1.0 logit
// and the band centres sit at these points.
export const BAND_CENTRE = { A1: -2, A2: -1, B1: 0, B2: 1, C1: 2, C2: 3 };

/** Ability (logits) → CEFR band. Boundaries sit midway between centres. */
export function abilityToLevel(theta) {
  if (theta < -1.5) return 'A1';
  if (theta < -0.5) return 'A2';
  if (theta < 0.5) return 'B1';
  if (theta < 1.5) return 'B2';
  if (theta < 2.5) return 'C1';
  return 'C2';
}

/** Rasch probability of a correct answer. */
export const pCorrect = (theta, difficulty) => 1 / (1 + Math.exp(-(theta - difficulty)));

const item = (id, cefr, skill, difficulty, q, options, answer, why) =>
  ({ id, cefr, skill, difficulty, q, options, answer, why });

/**
 * The item bank. Skills are mixed on purpose — a placement that only tests
 * verb endings mis-places anyone whose listening runs ahead of their grammar.
 * `difficulty` is the band centre nudged by ±0.3 so items within a band are
 * not interchangeable.
 */
export const ITEM_BANK = [
  // ---- A1 ----
  item('p-a1-1', 'A1', 'grammar', -2.3, '« Bonjour, comment ça ___ ? »', ['va', 'vas', 'allez'], 0, 'Fixed phrase: comment ça va.'),
  item('p-a1-2', 'A1', 'grammar', -2.1, 'Je ___ anglais.', ['es', 'suis', 'est'], 1, 'être: je suis.'),
  item('p-a1-3', 'A1', 'vocab', -2.0, '« le pain » veut dire :', ['bread', 'pan', 'pain'], 0, 'False friend — «pain» is bread.'),
  item('p-a1-4', 'A1', 'grammar', -1.8, 'Elle a ___ frère.', ['un', 'une', 'des'], 0, 'frère is masculine singular.'),
  item('p-a1-5', 'A1', 'vocab', -1.9, 'Pour demander l’heure :', ['Il est quelle heure ?', 'Où est l’heure ?', 'Quel heure il fait ?'], 0, 'Standard way to ask the time.'),
  item('p-a1-6', 'A1', 'grammar', -1.7, 'Nous ___ à Paris.', ['habitons', 'habitez', 'habite'], 0, '-er verb, nous form.'),
  item('p-a1-7', 'A1', 'reading', -2.2, '« Fermé le lundi » signifie :', ['Closed on Mondays', 'Open on Mondays', 'Closes at one'], 0, 'Shop-sign reading.'),
  item('p-a1-8', 'A1', 'vocab', -1.8, '« l’eau » se boit ou se mange ?', ['se boit', 'se mange', 'les deux'], 0, 'Water is drunk.'),

  // ---- A2 ----
  item('p-a2-1', 'A2', 'grammar', -1.3, 'Hier, nous ___ au cinéma.', ['allons', 'sommes allés', 'irons'], 1, 'Passé composé with être.'),
  item('p-a2-2', 'A2', 'grammar', -1.1, 'Il y a ___ lait dans le frigo.', ['du', 'de la', 'des'], 0, 'lait is masculine → du.'),
  item('p-a2-3', 'A2', 'grammar', -0.9, 'Quand j’étais petit, je ___ souvent au parc.', ['allais', 'suis allé', 'irai'], 0, 'Repeated past habit → imparfait.'),
  item('p-a2-4', 'A2', 'vocab', -1.2, '« une grève » est :', ['a strike', 'a beach', 'a grief'], 0, 'Homograph with «grève» (shore) but the common sense is a strike.'),
  item('p-a2-5', 'A2', 'grammar', -0.8, 'Je travaille ici ___ deux ans.', ['depuis', 'pendant', 'dans'], 0, 'Still ongoing → depuis.'),
  item('p-a2-6', 'A2', 'listening', -1.0, '« Le train à destination de Lille partira voie 4 » — que fait-on ?', ['aller voie 4', 'descendre du train', 'acheter un billet'], 0, 'Station announcement comprehension.'),
  item('p-a2-7', 'A2', 'grammar', -1.4, 'Tu ___ venir demain ?', ['peux', 'peut', 'pouvez'], 0, 'pouvoir, tu form.'),
  item('p-a2-8', 'A2', 'vocab', -0.9, 'Le contraire de « cher » :', ['bon marché', 'lourd', 'ouvert'], 0, 'cheap vs expensive.'),

  // ---- B1 ----
  item('p-b1-1', 'B1', 'grammar', -0.3, 'Si j’avais le temps, je ___ plus de sport.', ['fais', 'ferai', 'ferais'], 2, 'si + imparfait → conditionnel présent.'),
  item('p-b1-2', 'B1', 'grammar', -0.1, 'C’est la ville ___ je suis né.', ['que', 'où', 'dont'], 1, 'Place → où.'),
  item('p-b1-3', 'B1', 'grammar', 0.1, 'Le livre ___ je parle est épuisé.', ['dont', 'que', 'lequel'], 0, 'parler de → dont.'),
  item('p-b1-4', 'B1', 'vocab', -0.2, '« améliorer » signifie :', ['to improve', 'to worsen', 'to postpone'], 0, 'Core B1 verb.'),
  item('p-b1-5', 'B1', 'grammar', 0.2, 'Il a réussi ___ travaillant beaucoup.', ['en', 'de', 'par'], 0, 'Gérondif: en + participe présent.'),
  item('p-b1-6', 'B1', 'reading', 0.0, '« Faute de moyens, le projet a été reporté. » Pourquoi ?', ['manque d’argent', 'trop de succès', 'erreur de date'], 0, '«faute de» = for lack of.'),
  item('p-b1-7', 'B1', 'listening', 0.3, '« Je vous rappelle dans la foulée » veut dire :', ['tout de suite après', 'demain', 'jamais'], 0, 'Common workplace idiom.'),
  item('p-b1-8', 'B1', 'grammar', -0.4, 'Nous ___ déjà mangé quand il est arrivé.', ['avions', 'avons', 'aurons'], 0, 'Plus-que-parfait.'),

  // ---- B2 ----
  item('p-b2-1', 'B2', 'grammar', 0.8, 'Il faut que tu ___ à l’heure.', ['es', 'sois', 'seras'], 1, 'il faut que + subjonctif.'),
  item('p-b2-2', 'B2', 'grammar', 1.0, 'Le rapport ___ tu parles n’existe pas.', ['dont', 'que', 'auquel'], 0, 'parler de → dont.'),
  item('p-b2-3', 'B2', 'grammar', 1.2, 'Bien qu’il ___ tard, on continue.', ['soit', 'est', 'serait'], 0, 'bien que + subjonctif.'),
  item('p-b2-4', 'B2', 'vocab', 0.9, '« Certes, … » annonce :', ['une concession', 'une conclusion', 'une cause'], 0, 'Concessive marker.'),
  item('p-b2-5', 'B2', 'grammar', 1.1, 'Je ne bois ___ du thé. (only tea)', ['que', 'pas', 'plus'], 0, 'ne… que = restriction.'),
  item('p-b2-6', 'B2', 'reading', 1.3, '« L’écart se creuse » décrit :', ['une différence qui augmente', 'un trou dans la route', 'un accord'], 0, 'Figurative use in press French.'),
  item('p-b2-7', 'B2', 'grammar', 0.7, 'Il a dit qu’il ___ fatigué.', ['était', 'est', 'sera'], 0, 'Concordance des temps.'),
  item('p-b2-8', 'B2', 'vocab', 1.2, '« sensible » en français signifie surtout :', ['perceptible / sensitive', 'raisonnable', 'ennuyeux'], 0, 'False friend with English "sensible".'),

  // ---- C1 ----
  item('p-c1-1', 'C1', 'grammar', 1.8, '« Quoi qu’il ___, je pars demain. »', ['arrive', 'arrivera', 'arriverait'], 0, 'quoi que + subjonctif.'),
  item('p-c1-2', 'C1', 'vocab', 2.0, 'Elle a réussi, ___ tous les obstacles.', ['en dépit de', 'à cause de', 'grâce à'], 0, 'Concessive preposition.'),
  item('p-c1-3', 'C1', 'vocab', 2.2, '« Ce n’est pas mauvais » est :', ['une litote (= très bon)', 'une critique', 'une question'], 0, 'Litote — assertion by negated opposite.'),
  item('p-c1-4', 'C1', 'grammar', 2.1, '« Le suspect aurait pris la fuite » exprime :', ['une info non confirmée', 'un regret', 'une condition'], 0, 'Conditionnel journalistique.'),
  item('p-c1-5', 'C1', 'reading', 2.3, '« Force est de constater que… » introduit :', ['un constat qu’on ne peut nier', 'une hypothèse', 'une question'], 0, 'Formal assertion.'),
  item('p-c1-6', 'C1', 'grammar', 1.9, 'J’ai beau ___, je ne comprends pas.', ['relire', 'relis', 'relisant'], 0, 'avoir beau + infinitif.'),
  item('p-c1-7', 'C1', 'vocab', 2.4, '« mine de rien » signifie :', ['sans en avoir l’air', 'avec colère', 'très vite'], 0, 'Spoken idiom.'),
  item('p-c1-8', 'C1', 'grammar', 2.0, 'Elles se sont ___ compte de l’erreur.', ['rendu', 'rendues', 'rendus'], 0, '«compte» is the object — no agreement.'),

  // ---- C2 probes: only reached by a very strong run ----
  item('p-c2-1', 'C2', 'vocab', 2.9, '« Il n’est pas sans savoir » signifie :', ['il sait parfaitement', 'il ne sait pas', 'il hésite'], 0, 'Double negative litote.'),
  item('p-c2-2', 'C2', 'grammar', 3.1, '« Encore eût-il fallu que je le ___. »', ['susse', 'sache', 'saurais'], 0, 'Subjonctif imparfait of savoir.'),
  item('p-c2-3', 'C2', 'vocab', 3.0, '« à l’envi » signifie :', ['à volonté, sans cesse', 'avec jalousie', 'à contrecœur'], 0, 'Not «à l’envie» — a distinct word.'),
];

export const DEFAULT_CONFIG = {
  minItems: 8,
  maxItems: 18,
  // Stop once the standard error falls below this (logits). Each item
  // contributes at most 0.25 information, so 18 items floor the error near
  // 0.47 — 0.5 is therefore the tightest target that can actually be met, and
  // claiming better precision from a test this short would be a fiction.
  targetSe: 0.5,
  startTheta: 0,
};

/** A fresh test state. `seedLevel` (from onboarding) biases the first item. */
export function startPlacement({ seedLevel = null, config = {} } = {}) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const theta = seedLevel && BAND_CENTRE[seedLevel] !== undefined ? BAND_CENTRE[seedLevel] : cfg.startTheta;
  return { theta, se: 99, asked: [], responses: [], config: cfg, done: false };
}

/**
 * Choose the most informative unasked item — under Rasch that is the one whose
 * difficulty is closest to the current ability estimate. Ties break toward the
 * skill the test has sampled least, so the item set stays balanced.
 */
export function selectItem(state, bank = ITEM_BANK) {
  const asked = new Set(state.asked);
  const pool = bank.filter((i) => !asked.has(i.id));
  if (!pool.length) return null;

  const skillCounts = {};
  for (const id of state.asked) {
    const it = bank.find((i) => i.id === id);
    if (it) skillCounts[it.skill] = (skillCounts[it.skill] || 0) + 1;
  }

  let best = null;
  let bestKey = Infinity;
  for (const it of pool) {
    const distance = Math.abs(it.difficulty - state.theta);
    // Distance dominates; the skill count only separates near-ties.
    const key = distance + (skillCounts[it.skill] || 0) * 0.05;
    if (key < bestKey) {
      bestKey = key;
      best = it;
    }
  }
  return best;
}

/**
 * Maximum-likelihood ability estimate over the responses so far, by
 * Newton–Raphson. Falls back to a bounded step when every answer is correct or
 * every answer is wrong (where the MLE is undefined and would run to ±∞).
 */
export function estimateAbility(responses, start = 0) {
  if (!responses.length) return { theta: start, se: 99, information: 0 };

  const allRight = responses.every((r) => r.correct);
  const allWrong = responses.every((r) => !r.correct);

  let theta = start;
  if (!allRight && !allWrong) {
    for (let iter = 0; iter < 40; iter += 1) {
      let numerator = 0;
      let denominator = 0;
      for (const r of responses) {
        const p = pCorrect(theta, r.difficulty);
        numerator += (r.correct ? 1 : 0) - p;
        denominator += p * (1 - p);
      }
      if (denominator < 1e-9) break;
      const step = numerator / denominator;
      theta += Math.max(-1, Math.min(1, step));
      if (Math.abs(step) < 1e-4) break;
    }
  } else {
    // Undefined MLE: sit a bounded distance beyond the hardest item passed
    // (or below the easiest failed), which is the honest reading of
    // "we never found their ceiling".
    const ds = responses.map((r) => r.difficulty);
    theta = allRight ? Math.max(...ds) + 0.8 : Math.min(...ds) - 0.8;
  }

  theta = Math.max(-4, Math.min(4, theta));

  let information = 0;
  for (const r of responses) {
    const p = pCorrect(theta, r.difficulty);
    information += p * (1 - p);
  }
  // An all-right/all-wrong run genuinely has not pinned the ability down;
  // inflate the error rather than reporting false precision.
  const se = information > 0 ? 1 / Math.sqrt(information) : 99;
  return { theta, se: allRight || allWrong ? Math.max(se, 0.9) : se, information };
}

/** Record an answer and re-estimate. Returns the next state. */
export function answerItem(state, itemOrId, choiceIndex, bank = ITEM_BANK) {
  const it = typeof itemOrId === 'string' ? bank.find((i) => i.id === itemOrId) : itemOrId;
  if (!it) return state;

  const correct = choiceIndex === it.answer;
  const responses = [...state.responses, {
    id: it.id, difficulty: it.difficulty, correct, skill: it.skill, cefr: it.cefr, choice: choiceIndex,
  }];
  const { theta, se } = estimateAbility(responses, state.theta);
  const asked = [...state.asked, it.id];

  const { minItems, maxItems, targetSe } = state.config;
  const exhausted = asked.length >= Math.min(maxItems, bank.length);
  const done = exhausted || (asked.length >= minItems && se <= targetSe);

  return { ...state, theta, se, asked, responses, done };
}

/**
 * Final report. `confidence` is the standard error expressed as a 0..1 number
 * the rest of the app can consume (proficiency, assistance fading), and the
 * band range is the honest ±1 SE window rather than a single claim.
 */
export function placementResultFrom(state) {
  const { theta, se, responses } = state;
  const level = abilityToLevel(theta);
  const lower = abilityToLevel(theta - se);
  const upper = abilityToLevel(theta + se);

  const bySkill = {};
  for (const r of responses) {
    const s = (bySkill[r.skill] ||= { asked: 0, correct: 0 });
    s.asked += 1;
    if (r.correct) s.correct += 1;
  }
  for (const s of Object.values(bySkill)) s.pct = Math.round((s.correct / s.asked) * 100);

  // A tight SE means a confident placement; 0.45 logits ≈ 0.8 confidence.
  const confidence = Math.max(0, Math.min(1, 1 - se / 1.5));

  return {
    level,
    theta: Math.round(theta * 100) / 100,
    se: Math.round(se * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    range: lower === upper ? level : `${lower}–${upper}`,
    itemsAsked: responses.length,
    correct: responses.filter((r) => r.correct).length,
    bySkill,
    // Where they were strongest and weakest, for the first study plan.
    strongest: strongestSkill(bySkill),
    weakest: weakestSkill(bySkill),
  };
}

function rankSkills(bySkill) {
  return Object.entries(bySkill)
    .filter(([, s]) => s.asked >= 2)
    .sort((a, b) => b[1].pct - a[1].pct);
}
const strongestSkill = (bySkill) => rankSkills(bySkill)[0]?.[0] || null;
const weakestSkill = (bySkill) => rankSkills(bySkill).slice(-1)[0]?.[0] || null;

/** Run a whole test from an answer function — used by tests and mock mode. */
export function runPlacement(answerFn, { bank = ITEM_BANK, ...opts } = {}) {
  let state = startPlacement(opts);
  while (!state.done) {
    const next = selectItem(state, bank);
    if (!next) break;
    state = answerItem(state, next, answerFn(next), bank);
  }
  return placementResultFrom(state);
}

/** Items per level, so the UI can show what the bank actually holds. */
export function bankStats(bank = ITEM_BANK) {
  const byLevel = {};
  const bySkill = {};
  for (const i of bank) {
    byLevel[i.cefr] = (byLevel[i.cefr] || 0) + 1;
    bySkill[i.skill] = (bySkill[i.skill] || 0) + 1;
  }
  return { total: bank.length, byLevel, bySkill, levels: LEVELS };
}
