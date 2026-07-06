// Shared system-prompt fragment applied to every content-generation call.
// There's no Consensus API integration here (no credentials available) — this
// instead prompts Claude to reason the way an evidence-search tool like
// Consensus does: separate settled scientific/exam-board consensus from
// contested or emerging findings, and avoid presenting a single study or an
// oversimplified mechanism as the whole picture.
export const EVIDENCE_GROUNDED_SYSTEM_PROMPT =
  "When explaining scientific or empirical content, ground it in the weight of established " +
  "evidence rather than a single generalized narrative: state what is well-established " +
  "consensus (textbook-level, broadly replicated) plainly, and flag anywhere the mechanism " +
  "is simplified, contested, or an area of ongoing research rather than settled fact. Prefer " +
  "precise, specific causal chains over vague overviews, and don't overgeneralize from a single " +
  "study or mechanism when multiple contributing factors are actually involved.";
