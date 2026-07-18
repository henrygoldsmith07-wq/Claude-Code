// Focus & habit helpers: Pomodoro phase config, habit-streak maths, and the
// goal-streak calendar (which days met the daily XP goal). Pure/offline.

export const POMODORO = {
  work: 25 * 60,
  break: 5 * 60,
  longBreak: 15 * 60,
  cyclesBeforeLongBreak: 4,
};

const dayStamp = (d) => new Date(d).toISOString().slice(0, 10);

// Consecutive-days streak for a single habit, counting back from today (or
// yesterday, so a not-yet-done-today habit doesn't read as broken).
export function habitStreak(doneMap, now = new Date()) {
  if (!doneMap) return 0;
  let streak = 0;
  const start = doneMap[dayStamp(now)] ? 0 : 1; // allow today to be pending
  for (let i = start; i < 400; i++) {
    const day = dayStamp(now.getTime() - i * 86400000);
    if (doneMap[day]) streak += 1;
    else break;
  }
  return streak;
}

// Did the learner meet the daily XP goal on each day? Returns a month grid of
// { day, met, xp } cells (Monday-first), plus the current goal streak.
export function goalCalendar(xpLog, goal, now = new Date()) {
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const lead = (new Date(year, month, 1).getDay() + 6) % 7;
  const cellFor = (d) => {
    const stamp = new Date(Date.UTC(year, month, d)).toISOString().slice(0, 10);
    const xp = xpLog[stamp] || 0;
    return { day: d, xp, met: xp >= goal };
  };
  const cells = Array.from({ length: daysInMonth }, (_, i) => cellFor(i + 1));
  return { lead, cells, month, year };
}

// Current run of consecutive goal-met days ending today/yesterday.
export function goalStreak(xpLog, goal, now = new Date()) {
  let streak = 0;
  const todayMet = (xpLog[dayStamp(now)] || 0) >= goal;
  for (let i = todayMet ? 0 : 1; i < 400; i++) {
    const day = dayStamp(now.getTime() - i * 86400000);
    if ((xpLog[day] || 0) >= goal) streak += 1;
    else break;
  }
  return streak;
}

// mm:ss for a countdown.
export function fmtClock(seconds) {
  const s = Math.max(0, Math.round(seconds));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
