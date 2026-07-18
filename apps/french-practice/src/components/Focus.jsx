import { useEffect, useRef, useState } from 'react';
import {
  getHabitTracker, addHabit, removeHabit, toggleHabit, getXpLog, getSettings,
} from '../lib/storage';
import { POMODORO, habitStreak, goalCalendar, goalStreak, fmtClock } from '../lib/focus';
import { X, Play, Square, RefreshCw, Check, Plus, Trash, Clock, Flame, Target } from './icons';

// Focus & habits (full-screen): a study/Pomodoro timer with a distraction-free
// focus mode, a daily habit tracker with streaks, and a goal-streak calendar.

const VIEWS = [
  { id: 'timer', label: 'Timer' },
  { id: 'habits', label: 'Habits' },
  { id: 'calendar', label: 'Streak' },
];

function beep() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.value = 660;
    o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.2, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
    o.start(); o.stop(ctx.currentTime + 0.42);
    setTimeout(() => ctx.close(), 600);
  } catch { /* audio unavailable */ }
}

function announce(title, body) {
  beep();
  try { navigator.vibrate?.(200); } catch { /* no haptics */ }
  try {
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  } catch { /* notifications unavailable */ }
}

export default function Focus({ open, onClose }) {
  const [view, setView] = useState('timer');
  const [focusMode, setFocusMode] = useState(false);

  if (!open) return null;

  if (focusMode) return <FocusTimer onExit={() => setFocusMode(false)} />;

  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col" role="dialog" aria-modal="true" aria-label="Focus and habits">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-line bg-surface shrink-0">
        <h2 className="flex-1 text-sm font-semibold text-ink">Focus & habits</h2>
        <button onClick={onClose} aria-label="Close focus" className="w-10 h-10 grid place-items-center rounded-full text-ink2 hover:bg-surface2 hover:text-ink">
          <X size={18} />
        </button>
      </div>

      <div className="flex gap-1 px-4 pt-3 shrink-0">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            onClick={() => setView(v.id)}
            aria-pressed={view === v.id}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-colors ${view === v.id ? 'bg-surface2 text-ink' : 'text-ink3 hover:text-ink'}`}
          >
            {v.label}
          </button>
        ))}
      </div>

      <div className="flex-1 min-h-0">
        {view === 'timer' && <Timer onFocus={() => setFocusMode(true)} />}
        {view === 'habits' && <Habits />}
        {view === 'calendar' && <StreakCalendar />}
      </div>
    </div>
  );
}

// Shared timer engine: study count-up and Pomodoro cycles.
function useTimer() {
  const [mode, setMode] = useState('pomodoro'); // 'pomodoro' | 'study'
  const [phase, setPhase] = useState('work'); // pomodoro phase
  const [running, setRunning] = useState(false);
  const [remaining, setRemaining] = useState(POMODORO.work); // pomodoro seconds left
  const [elapsed, setElapsed] = useState(0); // study seconds
  const [completed, setCompleted] = useState(0); // finished focus sessions
  const ref = useRef({ endAt: 0, startAt: 0 });

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      const now = Date.now();
      if (mode === 'study') {
        setElapsed(Math.round((now - ref.current.startAt) / 1000));
        return;
      }
      const left = Math.round((ref.current.endAt - now) / 1000);
      if (left <= 0) {
        setRunning(false);
        if (phase === 'work') {
          const next = (completed + 1) % POMODORO.cyclesBeforeLongBreak === 0 ? 'longBreak' : 'break';
          setCompleted((c) => c + 1);
          setPhase(next);
          setRemaining(POMODORO[next]);
          announce('Break time', 'Nice focus session — take a breather.');
        } else {
          setPhase('work');
          setRemaining(POMODORO.work);
          announce('Back to it', 'Break over — start your next focus block.');
        }
      } else {
        setRemaining(left);
      }
    }, 250);
    return () => clearInterval(id);
  }, [running, mode, phase, completed]);

  const start = () => {
    const now = Date.now();
    if (mode === 'study') ref.current.startAt = now - elapsed * 1000;
    else ref.current.endAt = now + remaining * 1000;
    setRunning(true);
  };
  const pause = () => {
    if (mode === 'pomodoro') setRemaining(Math.max(0, Math.round((ref.current.endAt - Date.now()) / 1000)));
    setRunning(false);
  };
  const reset = () => {
    setRunning(false);
    if (mode === 'study') setElapsed(0);
    else { setPhase('work'); setRemaining(POMODORO.work); setCompleted(0); }
  };
  const switchMode = (m) => { setRunning(false); setMode(m); setPhase('work'); setRemaining(POMODORO.work); setElapsed(0); };

  return { mode, phase, running, remaining, elapsed, completed, start, pause, reset, switchMode };
}

const PHASE_LABEL = { work: 'Focus', break: 'Short break', longBreak: 'Long break' };

function Timer({ onFocus }) {
  const t = useTimer();
  const display = t.mode === 'study' ? fmtClock(t.elapsed) : fmtClock(t.remaining);

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-5 text-center">
        <div className="flex rounded-xl border border-line overflow-hidden" role="radiogroup" aria-label="Timer mode">
          {[['pomodoro', 'Pomodoro'], ['study', 'Study timer']].map(([id, label]) => (
            <button
              key={id}
              role="radio"
              aria-checked={t.mode === id}
              onClick={() => t.switchMode(id)}
              className={`flex-1 py-2.5 text-xs font-semibold transition-colors ${t.mode === id ? 'bg-accent text-onaccent' : 'bg-surface text-ink2 hover:text-ink'}`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-surface border border-line rounded-2xl p-8 space-y-2">
          {t.mode === 'pomodoro' && (
            <p className="text-[11px] font-bold uppercase tracking-wider text-ink3">{PHASE_LABEL[t.phase]} · {t.completed} done</p>
          )}
          <p className="text-6xl font-bold text-ink tabular-nums leading-none">{display}</p>
          {t.mode === 'study' && <p className="text-[11px] text-ink3">Counting up — time is logged automatically</p>}
        </div>

        <div className="flex justify-center gap-2">
          {!t.running ? (
            <button onClick={t.start} className="btn btn-primary min-h-11 px-6 rounded-xl text-sm"><Play size={13} /> Start</button>
          ) : (
            <button onClick={t.pause} className="btn btn-secondary min-h-11 px-6 rounded-xl text-sm"><Square size={13} /> Pause</button>
          )}
          <button onClick={t.reset} aria-label="Reset timer" className="btn btn-secondary min-h-11 px-4 rounded-xl text-sm"><RefreshCw size={13} /></button>
        </div>

        <button onClick={onFocus} className="w-full flex items-center justify-center gap-2 bg-surface2 border border-line rounded-xl px-4 py-3 text-sm text-ink hover:border-ink3 transition-colors">
          <Target size={15} /> Enter focus mode
        </button>
        <p className="text-[11px] text-ink3">Pomodoro: {POMODORO.work / 60}-minute focus blocks with short breaks, a long break every {POMODORO.cyclesBeforeLongBreak}.</p>
      </div>
    </div>
  );
}

// Distraction-free full-screen Pomodoro.
function FocusTimer({ onExit }) {
  const t = useTimer();
  useEffect(() => { t.start(); /* auto-start on entering */ }, []); // eslint-disable-line
  return (
    <div className="fixed inset-0 z-50 bg-bg flex flex-col items-center justify-center gap-8 px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.3em] text-ink3">{PHASE_LABEL[t.phase]}</p>
      <p className="text-[22vw] sm:text-8xl font-bold text-ink tabular-nums leading-none">{fmtClock(t.remaining)}</p>
      <div className="flex gap-3">
        {!t.running ? (
          <button onClick={t.start} className="btn btn-primary min-h-12 px-8 rounded-xl text-sm"><Play size={14} /> Resume</button>
        ) : (
          <button onClick={t.pause} className="btn btn-secondary min-h-12 px-8 rounded-xl text-sm"><Square size={14} /> Pause</button>
        )}
      </div>
      <button onClick={onExit} className="text-xs text-ink3 hover:text-ink underline underline-offset-2">Exit focus mode</button>
    </div>
  );
}

function Habits() {
  const [tracker, setTracker] = useState(getHabitTracker);
  const [name, setName] = useState('');
  const today = new Date().toISOString().slice(0, 10);

  const add = () => {
    if (!name.trim()) return;
    setTracker(addHabit(name.trim()));
    setName('');
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <p className="text-xs text-ink2 text-center">Tick each habit as you do it. Small daily reps build the streak.</p>

        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && add()}
            placeholder="Add a habit…"
            aria-label="New habit"
            className="flex-1 min-w-0 bg-surface border border-line rounded-xl px-4 py-2.5 text-sm text-ink placeholder:text-ink3 focus:outline-none focus:border-ink"
          />
          <button onClick={add} disabled={!name.trim()} aria-label="Add habit" className="btn btn-primary w-11 rounded-xl"><Plus size={16} /></button>
        </div>

        <ul className="space-y-2">
          {tracker.list.map((h) => {
            const done = Boolean(tracker.done[h.id]?.[today]);
            const streak = habitStreak(tracker.done[h.id]);
            return (
              <li key={h.id} className="flex items-center gap-3 bg-surface border border-line rounded-2xl px-4 py-3">
                <button
                  onClick={() => setTracker(toggleHabit(h.id))}
                  aria-pressed={done}
                  aria-label={`Mark "${h.name}" ${done ? 'not done' : 'done'} today`}
                  className={`w-8 h-8 shrink-0 grid place-items-center rounded-full border transition-colors ${done ? 'bg-accent text-onaccent border-accent' : 'border-line text-ink3 hover:border-ink'}`}
                >
                  <Check size={16} />
                </button>
                <span className="flex-1 min-w-0">
                  <span className={`block text-sm ${done ? 'text-ink font-semibold' : 'text-ink2'}`}>{h.name}</span>
                  <span className="flex items-center gap-1 text-[11px] text-ink3">
                    <Flame size={11} className={streak > 0 ? 'text-ink2' : 'text-ink3'} /> {streak}-day streak
                  </span>
                </span>
                <button onClick={() => setTracker(removeHabit(h.id))} aria-label={`Remove ${h.name}`} className="w-8 h-8 grid place-items-center rounded-full text-ink3 hover:text-ink hover:bg-surface2">
                  <Trash size={13} />
                </button>
              </li>
            );
          })}
          {tracker.list.length === 0 && <p className="text-xs text-ink3 text-center py-6">No habits yet — add one above.</p>}
        </ul>
      </div>
    </div>
  );
}

function StreakCalendar() {
  const goal = getSettings().dailyGoal;
  const xpLog = getXpLog();
  const { lead, cells, month, year } = goalCalendar(xpLog, goal);
  const streak = goalStreak(xpLog, goal);
  const today = new Date().getDate();
  const monthName = new Date(year, month, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-5">
      <div className="max-w-md mx-auto space-y-4">
        <div className="bg-surface border border-line rounded-2xl p-5 flex items-center gap-4">
          <span className="w-12 h-12 shrink-0 grid place-items-center rounded-2xl bg-surface2 text-ink"><Flame size={22} /></span>
          <div>
            <p className="text-2xl font-bold text-ink tabular-nums leading-none">{streak}</p>
            <p className="text-xs text-ink3 mt-1">day goal streak · {goal} XP/day target</p>
          </div>
        </div>

        <div className="bg-surface border border-line rounded-2xl p-5 space-y-3">
          <div className="flex items-baseline justify-between">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-ink2">Goal calendar</h3>
            <span className="text-[11px] text-ink3">{monthName}</span>
          </div>
          <div className="grid grid-cols-7 gap-1.5 text-center">
            {['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((dd, i) => <span key={i} className="text-[9px] font-bold text-ink3">{dd}</span>)}
            {Array.from({ length: lead }).map((_, i) => <span key={`l${i}`} />)}
            {cells.map((c) => (
              <span
                key={c.day}
                title={c.met ? `${c.xp} XP — goal met` : `${c.xp} XP`}
                className={`aspect-square grid place-items-center rounded-lg text-[10px] tabular-nums ${
                  c.met ? 'bg-ink text-bg font-semibold' : 'text-ink3'
                } ${c.day === today ? 'ring-1 ring-ink' : ''}`}
              >
                {c.day}
              </span>
            ))}
          </div>
          <p className="text-[11px] text-ink3">Filled days are days you hit your daily XP goal. Keep the chain unbroken.</p>
        </div>
      </div>
    </div>
  );
}
