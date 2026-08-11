// Chrono (scheduling) + Pulse (outcomes) integrations.
// Local payload builders; when a host app is present they can be consumed
// via postMessage / deep-link. No network here.

export function chronoPayload({ title, at, durationMin=10 }){
  return { kind: "chrono.schedule", title, at, durationMin };
}
export function pulsePayload({ skill, score, at }){
  return { kind: "pulse.outcome", skill, score, at: at || new Date().toISOString() };
}

export function progressionSnapshot({ level, xp, streak, srs, sessions }){
  return { level, xp, streak, srsSize: Object.keys(srs||{}).length, sessions: (sessions||[]).length };
}

export function chronoScheduleForLesson({ lesson, when = new Date() }){
  return chronoPayload({ title: `Le Studio: ${lesson?.title || lesson?.id || 'lesson'}`, at: when.toISOString(), durationMin: lesson?.durationMin || 10 });
}

export function pulseForSkill({ skill, score }){
  const payload = pulsePayload({ skill, score });
  // postMessage bridge when host is present
  try{ if(typeof window!=='undefined' && window.parent!==window) window.parent.postMessage(payload, '*'); }catch{}
  return payload;
}
