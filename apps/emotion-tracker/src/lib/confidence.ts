export interface ConfidenceLanguage {
  label: string;
  detail: string;
}

/** Replace percentage-only confidence with language that communicates limits. */
export function confidenceLanguage(value: number): ConfidenceLanguage {
  const confidence = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  if (confidence < 0.45) {
    return { label: "Very tentative", detail: "There is limited evidence for this reading." };
  }
  if (confidence < 0.6) {
    return { label: "Tentative", detail: "This is possible, but the evidence is weak." };
  }
  if (confidence < 0.75) {
    return { label: "Plausible", detail: "This reading fits some of the evidence, but other explanations remain open." };
  }
  if (confidence < 0.9) {
    return { label: "Fairly clear", detail: "This reading fits the evidence reasonably well, but it is still an estimate." };
  }
  return { label: "Strongly supported", detail: "The available evidence supports this reading; it is not a diagnosis or certainty." };
}
