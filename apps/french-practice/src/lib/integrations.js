// Chrono (scheduling) + Pulse (outcomes) integrations.
// These are local payload builders — the host app (if present) can consume them
// via postMessage / deep-link. No network here.

export function chronoPayload({ title, at, durationMin=10 }){
  return { kind: "chrono.schedule", title, at, durationMin };
}
export function pulsePayload({ skill, score, at }){
  return { kind: "pulse.outcome", skill, score, at: at || new Date().toISOString() };
}

export function progressionSnapshot({ level, xp, streak, srs, sessions }){
  // For Today's progression visualisation
  return { level, xp, streak, srsSize: Object.keys(srs||{}).length, sessions: (sessions||[]).length };
}
