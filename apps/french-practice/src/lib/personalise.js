// Personalisation: learning-style / lesson-length / favourite-topic
// preferences, a locally-computed weakness analysis, adaptive difficulty,
// and a daily recommendation engine that reorders what the app suggests.
// All deterministic and offline — it reads the same local data the rest of
// the app records (habits, grammar scores, session scores, SRS).

export const LEARNING_STYLES = [
  { id: 'balanced', emoji: '⚖️', title: 'Balanced', desc: 'A bit of everything, evenly' },
  { id: 'conversation', emoji: '💬', title: 'Conversation-first', desc: 'Speaking and roleplay lead' },
  { id: 'grammar', emoji: '📐', title: 'Grammar-focused', desc: 'Rules, drills and precision' },
  { id: 'vocabulary', emoji: '🗃️', title: 'Vocabulary-builder', desc: 'Words, cards and recall' },
  { id: 'immersion', emoji: '🎧', title: 'Immersion', desc: 'Listening and reading heavy' },
];

export const LESSON_LENGTHS = [
  { id: 'short', title: 'Short', minutes: '~5 min', items: 2 },
  { id: 'medium', title: 'Medium', minutes: '~10 min', items: 3 },
  { id: 'long', title: 'Long', minutes: '~20 min', items: 5 },
];

export const TOPICS = [
  { id: 'travel', emoji: '🧳', title: 'Travel', scenarioId: 'vol' },
  { id: 'food', emoji: '🍽️', title: 'Food & dining', scenarioId: 'bistro' },
  { id: 'work', emoji: '💼', title: 'Work & business', scenarioId: 'reunion' },
  { id: 'culture', emoji: '🎭', title: 'Culture & arts' },
  { id: 'daily', emoji: '🏠', title: 'Daily life', scenarioId: 'colloc' },
  { id: 'shopping', emoji: '🛍️', title: 'Shopping', scenarioId: 'marche' },
  { id: 'health', emoji: '🩺', title: 'Health', scenarioId: 'pharmacie' },
  { id: 'study', emoji: '🎓', title: 'Study & exams', scenarioId: 'cours' },
];

export const lessonLength = (id) => LESSON_LENGTHS.find((l) => l.id === id) || LESSON_LENGTHS[1];
export const learningStyle = (id) => LEARNING_STYLES.find((s) => s.id === id) || LEARNING_STYLES[0];

// ---- adaptive difficulty ----

const CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

// Nudge the effective level from the average of recent session scores: a run
// of strong scores bumps up one step, a run of weak ones eases down one.
export function adaptiveLevel(baseLevel, sessions, enabled) {
  const idx = Math.max(0, CEFR.indexOf(baseLevel));
  if (!enabled) return { level: baseLevel, shift: 0 };
  const recent = sessions.slice(-4).map((s) => s.report?.average_scores?.overall).filter((n) => typeof n === 'number');
  if (recent.length < 3) return { level: baseLevel, shift: 0 };
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  let shift = 0;
  if (avg >= 88) shift = 1;
  else if (avg < 60) shift = -1;
  const next = Math.min(CEFR.length - 1, Math.max(0, idx + shift));
  return { level: CEFR[next], shift: next - idx, avg: Math.round(avg) };
}

// ---- weakness analysis ----

// Build a ranked list of weak areas from the learner's own data. Each area:
// { id, label, severity 0..1, detail, action: {type,label} }.
export function weaknessAnalysis({ habits, grammarProgress, sessions, weakWordCount, dueCount }) {
  const areas = [];

  // Grammar: recurring mistakes + low-scoring / untried topics.
  const habitHits = habits.reduce((a, h) => a + h.count, 0);
  const grammarScores = Object.values(grammarProgress).map((g) => g.best);
  const lowGrammar = grammarScores.filter((s) => s < 80).length;
  if (habitHits >= 2 || lowGrammar > 0) {
    areas.push({
      id: 'grammar',
      label: 'Grammar accuracy',
      severity: Math.min(1, habitHits / 8 + lowGrammar / 6),
      detail: habits[0]
        ? `Recurring: “${habits[0].text}”${lowGrammar ? ` · ${lowGrammar} topic${lowGrammar > 1 ? 's' : ''} under 80%` : ''}`
        : `${lowGrammar} grammar topic${lowGrammar > 1 ? 's' : ''} still under 80%`,
      action: { type: 'grammar', label: 'Drill grammar' },
    });
  }

  // Vocabulary retention: weak words + a backlog of due cards.
  if (weakWordCount > 0 || dueCount >= 10) {
    areas.push({
      id: 'vocab',
      label: 'Vocabulary retention',
      severity: Math.min(1, weakWordCount / 12 + dueCount / 40),
      detail: `${weakWordCount} weak word${weakWordCount !== 1 ? 's' : ''}${dueCount ? ` · ${dueCount} due for review` : ''}`,
      action: { type: 'cards', label: 'Review words' },
    });
  }

  // Fluency / naturalness from session sub-scores.
  const subs = sessions.slice(-5).map((s) => s.report?.average_scores).filter(Boolean);
  if (subs.length) {
    const meanOf = (k) => subs.reduce((a, s) => a + (s[k] || 0), 0) / subs.length;
    const fluency = meanOf('fluency');
    const naturalness = meanOf('naturalness');
    const weakest = fluency <= naturalness ? { k: 'fluency', v: fluency } : { k: 'naturalness', v: naturalness };
    if (weakest.v && weakest.v < 78) {
      areas.push({
        id: 'speaking',
        label: weakest.k === 'fluency' ? 'Speaking fluency' : 'Sounding natural',
        severity: Math.min(1, (80 - weakest.v) / 40),
        detail: `Recent ${weakest.k} averages ${Math.round(weakest.v)}/100`,
        action: { type: 'quickfire', label: 'Quick Fire drill' },
      });
    }
  } else {
    areas.push({
      id: 'speaking',
      label: 'Speaking practice',
      severity: 0.5,
      detail: 'No conversations yet — the Arena is where fluency grows',
      action: { type: 'arena', label: 'Start a conversation' },
    });
  }

  return areas.sort((a, b) => b.severity - a.severity);
}

// ---- daily recommendations ----

// Weight of each activity type by learning style; higher = surfaced sooner.
const STYLE_WEIGHTS = {
  balanced: { arena: 1, grammar: 1, cards: 1, dictation: 1, reading: 1, quickfire: 1 },
  conversation: { arena: 2, quickfire: 1.6, grammar: 0.8, cards: 0.8, dictation: 0.7, reading: 0.7 },
  grammar: { grammar: 2, cards: 1.2, arena: 1, dictation: 0.8, reading: 0.9, quickfire: 0.7 },
  vocabulary: { cards: 2, reading: 1.3, grammar: 1, arena: 0.9, dictation: 0.9, quickfire: 0.7 },
  immersion: { reading: 1.8, dictation: 1.7, arena: 1.1, cards: 1, grammar: 0.8, quickfire: 0.9 },
};

// Produce an ordered list of recommendation cards. Weakness areas get a boost
// so the plan attacks gaps first; the list is capped to the lesson length.
export function dailyRecommendations({ prefs, weaknesses, dueCount, suggestedScenario }) {
  const weights = STYLE_WEIGHTS[prefs.learningStyle] || STYLE_WEIGHTS.balanced;
  const weakBoost = {};
  weaknesses.forEach((w, i) => {
    const type = w.action.type === 'arena' ? 'arena' : w.action.type;
    weakBoost[type] = (weakBoost[type] || 0) + (weaknesses.length - i);
  });

  const pool = [
    { type: 'arena', title: `Roleplay: ${suggestedScenario.title}`, subtitle: 'Conversation practice', base: weights.arena },
    { type: 'cards', title: dueCount > 0 ? `Review ${dueCount} word${dueCount > 1 ? 's' : ''}` : 'Vocabulary cards', subtitle: 'Spaced repetition', base: weights.cards, badge: dueCount || null },
    { type: 'grammar', title: 'Grammar lesson', subtitle: 'Rules, drills and a quiz', base: weights.grammar },
    { type: 'quickfire', title: 'Quick Fire', subtitle: '45-second improv', base: weights.quickfire },
    { type: 'dictation', title: 'Dictée', subtitle: 'Train your ear', base: weights.dictation },
    { type: 'reading', title: 'Reading', subtitle: 'Stories, news, tap-to-translate', base: weights.reading },
  ];

  return pool
    .map((c) => ({ ...c, score: c.base + (weakBoost[c.type] || 0) * 0.8 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, lessonLength(prefs.lessonLength).items);
}
