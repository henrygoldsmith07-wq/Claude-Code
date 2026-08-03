import { getStreak, getTodayXp, getSrs, getNotebook, getSettings, getSessions } from '../lib/storage';
import { dueEntries, notebookAsEntries } from '../lib/memory';
import { getScenarios } from '../lib/data';
import { allEntries } from '../lib/vocab';
import { getLanguage } from '../lib/languages';
import { ArrowRight, Layers, MessageCircle, Mic, Play, Target, SCENARIO_ICONS, StudioMark } from './icons';

function suggestScenario(sessions) {
  const scenarios = getScenarios();
  if (!scenarios.length) return { id: 'open', title: 'Open conversation' };

  const lastSeen = {};
  sessions.forEach((session, index) => { lastSeen[session.scenarioId] = index; });
  const unseen = scenarios.find((scenario) => !(scenario.id in lastSeen));
  return unseen || [...scenarios].sort((a, b) => (lastSeen[a.id] ?? -1) - (lastSeen[b.id] ?? -1))[0];
}

export default function HomeDashboard({ dailyGoal = 30, level, onStartLesson, onNavigate, onPickScenario, lastActivity, onResume }) {
  const settings = getSettings();
  const language = getLanguage(settings.language);
  const streak = getStreak();
  const todayXp = getTodayXp();
  const dueCount = dueEntries([...allEntries(), ...notebookAsEntries(getNotebook())], getSrs()).length;
  const suggested = suggestScenario(getSessions());
  const SuggestedIcon = SCENARIO_ICONS[suggested.id] || MessageCircle;
  const goal = Math.max(1, dailyGoal);
  const goalPct = Math.min(100, Math.round((todayXp / goal) * 100));
  const goalDone = todayXp >= goal;

  const startConversation = (minutes = 5) => {
    try { sessionStorage.setItem('fp.sessionMins', String(minutes)); } catch { /* unavailable in restricted browsers */ }
    onPickScenario(suggested);
    onNavigate('arena');
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll px-4 py-6">
      <div className="max-w-lg mx-auto space-y-5">
        <section className="home-hero rounded-2xl px-5 py-5 sm:px-6 sm:py-6 elev-card" aria-labelledby="home-primary-heading">
          <div className="home-brand-lockup">
            <StudioMark size={34} />
            <div className="home-brand-copy">
              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-ink">Le Studio</p>
              <p className="text-[11px] text-ink3">Your private speaking coach</p>
            </div>
          </div>

          <div className="mt-6 max-w-sm">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-speak">
              {lastActivity ? 'Resume your practice' : "Today's practice"}
            </p>
            <h2 id="home-primary-heading" className="mt-2 text-[clamp(1.8rem,8vw,2.55rem)] font-black leading-[1.04] tracking-[-0.04em] text-ink">
              {lastActivity
                ? 'Pick up where you left off.'
                : <>Have a 5-minute <span className="text-speak" lang={language.id}>{language.name}</span> conversation now.</>}
            </h2>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-ink2">
              {lastActivity
                ? lastActivity.label
                : 'Speak naturally, get one useful correction, and leave with a phrase worth remembering.'}
            </p>
          </div>

          <button
            type="button"
            onClick={lastActivity ? () => onResume(lastActivity) : () => startConversation(5)}
            className="mt-5 flex min-h-14 w-full items-center gap-3 rounded-2xl bg-speak px-4 py-3 text-left font-bold text-onspeak shadow-sm transition hover:brightness-95"
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-onspeak/15" aria-hidden="true">
              {lastActivity ? <Play size={18} /> : <MessageCircle size={18} />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm">{lastActivity ? 'Resume practice' : 'Start a 5-minute conversation'}</span>
              <span className="mt-0.5 block text-[11px] font-medium opacity-75">
                {lastActivity ? 'Your previous activity is ready' : `${suggested.title} · voice or text`}
              </span>
            </span>
            <ArrowRight size={18} />
          </button>

          {lastActivity && (
            <button type="button" onClick={() => startConversation(5)} className="mt-3 text-[11px] font-semibold text-ink2 underline decoration-line underline-offset-2 hover:text-ink">
              Start a new 5-minute conversation instead
            </button>
          )}
        </section>

        <section className="flex items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-4 elev-card" aria-labelledby="review-heading">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-reviewsoft text-review" aria-hidden="true"><Layers size={19} /></span>
          <div className="min-w-0 flex-1">
            <p id="review-heading" className="text-[11px] font-bold uppercase tracking-wider text-ink2">Review due vocabulary</p>
            <p className="mt-0.5 text-sm font-semibold text-ink">
              {dueCount > 0 ? `${dueCount} word${dueCount === 1 ? '' : 's'} ready` : 'Your queue is clear'}
            </p>
            <p className="mt-0.5 text-xs text-ink3">
              {dueCount > 0 ? 'A short review keeps conversations fluent.' : 'Browse vocabulary whenever you need a refresher.'}
            </p>
          </div>
          <button type="button" onClick={() => onNavigate('cards')} className="btn btn-secondary min-h-10 shrink-0 rounded-xl px-3 text-xs">
            {dueCount > 0 ? 'Review' : 'Open vocab'}
          </button>
        </section>

        <section className="rounded-2xl border border-line bg-surface px-4 py-4 elev-card" aria-labelledby="progress-heading">
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p id="progress-heading" className="text-[11px] font-bold uppercase tracking-wider text-ink2">Today&apos;s progress</p>
              <p className="mt-1 text-sm text-ink2">
                <span className="font-bold text-ink tabular-nums">{todayXp}</span>/{goal} XP
                <span className="mx-1.5 text-ink3" aria-hidden="true">·</span>
                level {level || settings.level}
              </p>
            </div>
            <p className="shrink-0 text-right text-xs text-ink2">
              <span className="block text-lg font-black leading-none text-ink tabular-nums">{streak.count}</span>
              day streak
            </p>
          </div>
          <div className="mt-3" role="progressbar" aria-label={`Daily goal: ${todayXp} of ${goal} XP`} aria-valuenow={Math.min(todayXp, goal)} aria-valuemin="0" aria-valuemax={goal}>
            <div className="h-2 overflow-hidden rounded-full bg-surface2">
              <div className={`h-full rounded-full transition-all duration-500 ${goalDone ? 'bg-success' : 'bg-ink'}`} style={{ width: `${goalPct}%` }} />
            </div>
            <p className="mt-2 text-[11px] text-ink3">{goalDone ? 'Daily goal complete. Anything more is bonus.' : `${goal - todayXp} XP to reach today&apos;s goal.`}</p>
          </div>
        </section>

        <section aria-labelledby="discover-heading" className="space-y-2.5">
          <div>
            <h3 id="discover-heading" className="text-[11px] font-bold uppercase tracking-wider text-ink2">Explore when you have time</h3>
            <p className="mt-1 text-xs text-ink3">Useful next steps, kept out of today&apos;s decision.</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            <ModeCard
              tone="speak"
              icon={SuggestedIcon}
              eyebrow="Scenario"
              title={suggested.title}
              description="Practise aloud"
              onClick={() => startConversation(5)}
            />
            <ModeCard
              tone="build"
              icon={Target}
              eyebrow="Build accuracy"
              title="Grammar"
              description="Make fewer mistakes"
              onClick={() => onNavigate('grammar')}
            />
            <ModeCard
              tone="review"
              icon={Mic}
              eyebrow="Train your ear"
              title="Dictée"
              description="Listen and type"
              onClick={() => onStartLesson({ type: 'dictation' })}
            />
          </div>
        </section>
      </div>
    </div>
  );
}

function ModeCard({ tone, icon: Icon, eyebrow, title, description, onClick }) {
  return (
    <button type="button" onClick={onClick} className={`home-mode-card home-mode-card-${tone}`}>
      <span className="home-mode-icon" aria-hidden="true"><Icon size={18} /></span>
      <span className="mt-1 pr-5 text-[10px] font-bold uppercase tracking-wider text-ink3">{eyebrow}</span>
      <span className="text-sm font-bold leading-tight text-ink">{title}</span>
      <span className="text-[11px] leading-tight text-ink3">{description}</span>
      <ArrowRight size={14} className="home-mode-arrow" aria-hidden="true" />
    </button>
  );
}
