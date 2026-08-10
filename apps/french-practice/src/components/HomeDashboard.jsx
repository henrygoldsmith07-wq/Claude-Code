import { getStreak, getTodayXp, getSrs, getNotebook, getSettings, getSessions, getHabits, getGrammarProgress } from '../lib/storage';
import { dueEntries, notebookAsEntries, weakEntries } from '../lib/memory';
import { getScenarios } from '../lib/data';
import { allEntries } from '../lib/vocab';
import { getLanguage } from '../lib/languages';
import { ArrowRight, Layers, MessageCircle, Play, Target, Mic, BookOpen, StudioMark } from './icons';
import { weaknessAnalysis, dailyRecommendations } from '../lib/personalise';
import { SCENARIO_ICONS } from './icons';

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
  const todayRecs = (()=>{ try{ const srs=getSrs(); const habits=getHabits(); const grammar=getGrammarProgress(); const weak=weakEntries([...allEntries(), ...notebookAsEntries(getNotebook())], srs); const areas=weaknessAnalysis({ habits, grammarProgress: grammar, sessions: getSessions(), weakWordCount: weak.length, dueCount }); return dailyRecommendations({ prefs: { learningStyle: 'balanced', lessonLength: 'medium' }, weaknesses: areas, dueCount, suggestedScenario: suggested }).slice(0,2); }catch{ return []; }})();
  const SuggestedIcon = SCENARIO_ICONS[suggested.id] || MessageCircle;
  const goal = Math.max(1, dailyGoal);
  const goalPct = Math.min(100, Math.round((todayXp / goal) * 100));
  const goalDone = todayXp >= goal;

  const startConversation = (minutes = 5) => {
    try { sessionStorage.setItem('fp.sessionMins', String(minutes)); } catch { /* restricted */ }
    onPickScenario(suggested);
    onNavigate('arena');
  };

  return (
    <div className="h-full overflow-y-auto nice-scroll">
      <div className="max-w-[1020px] mx-auto px-[22px] py-6 space-y-10">
        {/* Hero — mirrors le-studio-site .hero: centered, calm, no clutter */}
        <section className="text-center pt-4 pb-2" aria-labelledby="today-hero-title">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-line text-[11px] font-semibold text-ink2">
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" aria-hidden />
            Le Studio · {language.name} · Today
            {streak.count > 0 ? <span className="hidden sm:inline">· {streak.count}-day streak</span> : null}
          </div>
          <h2 id="today-hero-title" className="mt-5 text-[clamp(30px,6vw,52px)] font-extrabold leading-[1.05] tracking-[-0.03em] text-ink text-balance">
            {lastActivity ? (
              <>Pick up<br />where you left off.</>
            ) : (
              <>Calm tools.<br /><span className="text-ink2">Honest practice.</span></>
            )}
          </h2>
          <p className="mx-auto mt-4 max-w-[640px] text-[clamp(15px,2.4vw,19px)] leading-relaxed text-ink2">
            {lastActivity
              ? lastActivity.label
              : <>Have a 5-minute <span lang={language.id} className="font-semibold text-ink">{language.name}</span> conversation now. Speak naturally, get one useful correction, leave with a phrase worth remembering.</>}
          </p>
          <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={lastActivity ? () => onResume(lastActivity) : () => startConversation(5)}
              className="inline-flex items-center gap-2 bg-ink text-bg font-bold rounded-[14px] px-[26px] py-[13px] text-[15px] hover:opacity-85 hover:-translate-y-px transition"
            >
              {lastActivity ? <Play size={16} /> : <MessageCircle size={16} />}
              {lastActivity ? 'Resume practice' : 'Start a 5-minute conversation'}
            </button>
            <button
              type="button"
              onClick={() => startConversation(5)}
              className="inline-flex items-center gap-2 text-ink font-semibold px-5 py-3 text-[15px] hover:opacity-70 transition"
            >
              {lastActivity ? 'Start something new' : `Try ${suggested.title}`} <ArrowRight size={16} />
            </button>
          </div>
          {lastActivity ? (
            <p className="mt-3 text-xs text-ink3">Or browse another scenario — your last session is still ready in Speak.</p>
          ) : (
            <p className="mt-3 text-xs text-ink3">No account · Works offline · Voice or text</p>
          )}
        </section>

        {/* Stats — same calm grid as le-studio-site .stats */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-label="Today at a glance">
          <Stat value={todayXp} label="XP today" sub={`${goal - todayXp > 0 && !goalDone ? `${goal - todayXp} to goal` : goalDone ? 'Goal reached' : '—'}`} />
          <Stat value={streak.count} label="day streak" sub={goalDone ? 'Keep it going' : 'Practice daily'} />
          <Stat value={dueCount} label="words due" sub={dueCount ? 'Review queue' : 'All clear'} />
          <Stat value={level || settings.level || '—'} label="your level" sub="CEFR · adaptive" />
        </section>

        {/* Today’s progress — thin bar like the site’s muted cards, but functional */}
        <section className="bg-surface border border-line rounded-[20px] p-[22px]" aria-labelledby="today-progress-heading">
          <div className="flex items-baseline justify-between gap-4">
            <div>
              <h3 id="today-progress-heading" className="text-[11px] font-bold uppercase tracking-[0.14em] text-ink2">Today’s progress</h3>
              <p className="mt-1 text-sm text-ink2"><span className="font-bold text-ink tabular-nums">{todayXp}</span> / {goal} XP · level {level || settings.level}</p>
            </div>
            <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${goalDone ? 'bg-success-soft border-success text-success' : 'bg-surface2 border-line text-ink3'}`}>{goalPct}%</span>
          </div>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface2" role="progressbar" aria-valuenow={Math.min(todayXp, goal)} aria-valuemin={0} aria-valuemax={goal} aria-label={`Daily goal ${todayXp} of ${goal} XP`}>
            <div className={`h-full rounded-full transition-all duration-500 ${goalDone ? 'bg-success' : 'bg-ink'}`} style={{ width: `${goalPct}%` }} />
          </div>
          <p className="mt-2 text-xs text-ink3">{goalDone ? 'Daily goal complete — anything more today is bonus.' : `${goal - todayXp} XP to reach today’s goal.`}</p>
        </section>

        {/* The studio, in three calm products — mirrors le-studio-site .products */}
        <section aria-labelledby="today-studio-heading">
          <h3 id="today-studio-heading" className="text-center text-[clamp(22px,4vw,30px)] font-bold tracking-[-0.02em] text-ink">The studio, in three</h3>
          <p className="text-center text-ink2 mt-2 mb-5 text-sm">Speak, review, deepen — pick one, the rest waits.</p>
          <div className="grid gap-3.5 sm:grid-cols-3">
            <ProductCard
              icon={SuggestedIcon}
              title={suggested.title}
              kicker="Speak · 5 min"
              body="Voice roleplay with per-turn corrections. Order a bistro coffee or survive a job interview."
              meta="No account · Voice or text"
              cta={lastActivity ? 'Resume practice' : 'Start speaking'}
              onClick={lastActivity ? () => onResume(lastActivity) : () => startConversation(5)}
            />
            <ProductCard
              icon={Layers}
              title={dueCount > 0 ? `${dueCount} words due` : 'Review vocabulary'}
              kicker="Review · Spaced"
              body={dueCount > 0 ? 'A short review now beats relearning later — most-forgotten first.' : 'Browse 520+ flashcards whenever you need a refresher.'}
              meta="SM-2 · Frontier tier"
              cta={dueCount > 0 ? 'Review now' : 'Open vocab'}
              onClick={() => onNavigate('cards')}
            />
            <ProductCard
              icon={Target}
              title="Deepen the craft"
              kicker="Learn · At leisure"
              body="Grammar, dictée, reading and writing — all grouped under Learn when you have time."
              meta="25 topics · 4 skills"
              cta="Explore Learn"
              onClick={() => onNavigate('grammar')}
            />
          </div>
        </section>

        {/* Explore when you have time — muted, secondary, like le-studio-site .grid */}
        <section aria-labelledby="today-explore-heading" className="pb-2">
          <h3 id="today-explore-heading" className="text-center text-[clamp(20px,3vw,26px)] font-bold tracking-[-0.02em]">Explore when you have time</h3>
          <p className="text-center text-ink2 mt-1 text-sm">Useful next steps, kept out of today’s decision.</p>
          <div className="grid gap-3.5 sm:grid-cols-3 mt-5">
            <MiniCard
              icon={Mic}
              title="Dictée"
              desc="Listen and type — ears first."
              onClick={() => onStartLesson({ type: 'dictation' })}
            />
            <MiniCard
              icon={BookOpen}
              title="Reading"
              desc="Stories, tap-to-translate."
              onClick={() => onStartLesson({ type: 'reading' })}
            />
            <MiniCard
              icon={StudioMark}
              title="Your path"
              desc="12 units · checkpoints · CEFR"
              onClick={() => onNavigate('grammar')}
            />
          </div>
          {todayRecs.length>0 && (<div className="mt-6 grid gap-2 sm:grid-cols-2"><p className="sm:col-span-2 text-center text-xs text-ink3">Today picks for you</p>{todayRecs.map(r=>(<div key={r.type} className="bg-surface border border-line rounded-xl px-4 py-3 flex items-center justify-between"><span className="text-sm font-semibold">{r.title}</span><span className="text-xs text-ink3">{r.subtitle}</span></div>))}</div>)}
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <span className="inline-block bg-surface border border-line rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink2">Installable PWA</span>
            <span className="inline-block bg-surface border border-line rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink2">Works offline</span>
            <span className="inline-block bg-surface border border-line rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink2">No account required</span>
            <span className="inline-block bg-surface border border-line rounded-full px-3.5 py-1.5 text-xs font-semibold text-ink2">Private by architecture</span>
          </div>
        </section>
      </div>
    </div>
  );
}

function Stat({ value, label, sub }) {
  return (
    <div className="bg-surface border border-line rounded-2xl px-4 py-4 text-center">
      <b className="block text-[26px] font-extrabold tracking-[-0.02em] leading-none tabular-nums">{value}</b>
      <span className="block text-xs text-ink3 mt-1">{label}</span>
      <span className="block text-[11px] text-ink3 mt-1">{sub}</span>
    </div>
  );
}

function ProductCard({ icon: Icon, kicker, title, body, meta, cta, onClick }) {
  return (
    <div className="bg-surface border border-line rounded-[20px] p-[22px] flex flex-col gap-2.5">
      <span className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.12em] text-ink2">
        <span className="w-7 h-7 grid place-items-center rounded-full bg-surface2 border border-line text-ink"><Icon size={13} /></span>
        {kicker}
      </span>
      <h4 className="text-[18px] font-bold tracking-[-0.02em] leading-tight">{title}</h4>
      <p className="text-sm text-ink2 flex-1 leading-relaxed">{body}</p>
      <p className="text-xs text-ink3 font-semibold">{meta}</p>
      <button type="button" onClick={onClick} className="mt-1 inline-flex items-center justify-center bg-ink text-bg font-bold rounded-[14px] px-4 py-3 text-sm hover:opacity-90 transition">
        {cta}
      </button>
    </div>
  );
}

function MiniCard({ icon: Icon, title, desc, onClick }) {
  return (
    <button type="button" onClick={onClick} className="bg-surface border border-line rounded-[18px] p-5 text-left hover:border-ink3 transition flex flex-col gap-1.5">
      <span className="w-9 h-9 grid place-items-center rounded-xl bg-surface2 border border-line text-ink"><Icon size={16} /></span>
      <span className="text-[15px] font-bold tracking-[-0.01em] flex items-center gap-1.5">{title} <ArrowRight size={13} className="text-ink3" /></span>
      <span className="text-[13px] text-ink2 leading-snug">{desc}</span>
    </button>
  );
}
