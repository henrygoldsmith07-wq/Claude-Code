// Targeted drills: shadowing, dictation, minimal pairs, grammar transforms, listening discrimination
// Pure data + prompt templates. Speaking-time tracking is logged via storage metrics.

export const MINIMAL_PAIRS = [
  { a: "dessus", b: "dessous", cue: "u vs ou" },
  { a: "pain", b: "pin", cue: "nasal an vs in" },
  { a: "rue", b: "roue", cue: "y (u) vs ou" },
  { a: "vin", b: "vent", cue: "in vs an" },
];

export const TRANSFORMATIONS = [
  { from: "présent", to: "passé composé", example: "Je mange → J\'ai mangé" },
  { from: "affirmatif", to: "négatif", example: "Je sais → Je ne sais pas" },
  { from: "tu", to: "vous", example: "Tu veux → Vous voulez" },
];

export function dictationPrompt(sentence){ return { fr: sentence, en: "" } }

export function shadowingPlan(sentences){
  return sentences.map(s=> ({ text: s, slowRate: 0.75, normalRate: 1 }));
}
