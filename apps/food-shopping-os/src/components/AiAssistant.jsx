import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { RECIPES } from '../data/recipes.js';
import { useApp } from '../lib/store.jsx';
import { expiringSoon, recipesUsing } from '../lib/kitchen.js';
import { filterByDiet, goalSummary, recipeAllowed } from '../lib/goals.js';
import { habitAnalysis, predictProgress } from '../lib/coach.js';
import { healthierSwaps, personalTips, restaurantPicks } from '../lib/advice.js';
import { gbp } from '../lib/utils.js';

const QUICK_PROMPTS = [
  'What should I cook tonight?',
  'What needs using up?',
  'How am I doing on protein?',
  'Am I on track?',
  'What are my habits?',
  'Give me a tip',
  'Eating out — what fits?',
  'What can I afford this week?',
  'Something in 15 minutes',
  'What are my targets?',
];

const recipeLine = (r) => `• ${r.name} — ${r.time} min, ${gbp(r.costPerServing, { always: true })}/serving, ${r.kcal} kcal`;

/**
 * A coach that only says what your own data supports. Every branch reads the
 * pantry, diary, budget or plan — when there's nothing recorded, it says so
 * instead of inventing a week you didn't have.
 */
export function answer(text, app) {
  const t = text.toLowerCase();
  const pantry = app.pantry;
  const expiring = expiringSoon(pantry, 3, app.day);
  // Every recipe the coach offers has to fit the patterns you set.
  const book = filterByDiet(RECIPES, app.diets);

  if (/waste|expir|use ?up|using up|going off|needs? using/.test(t)) {
    if (!expiring.length) {
      return pantry.length
        ? 'Nothing in your pantry is close to its use-by date. Add dates as you shop and I’ll flag things here.'
        : 'Your pantry is empty, so there’s nothing for me to watch. Add a few items and I’ll tell you what to cook before it turns.';
    }
    const uses = recipesUsing(pantry, 4, app.day).filter((u) => recipeAllowed(u.recipe, app.diets)).slice(0, 2);
    return `${expiring.length} thing${expiring.length === 1 ? '' : 's'} need using: ${expiring.slice(0, 4).map((p) => p.name).join(', ')}.${
      uses.length ? `\n\n${uses.map((u) => recipeLine(u.recipe)).join('\n')}` : ''
    }`;
  }

  if (/on track|progress|predict|losing|gaining|weight|pace/.test(t)) {
    const p = predictProgress(app, { today: app.day });
    if (!p.ready) return `${p.reason}\n\nI'd rather say nothing than guess at your progress.`;
    const line = `At ${p.avgKcal.toLocaleString()} kcal a day against ${p.maintenance.toLocaleString()} maintenance, you're ${p.direction} at about ${Math.abs(p.perWeekKg)} kg a week (${p.days} logged days).`;
    const target = p.toTarget?.weeks
      ? `\n\n${Math.abs(p.toTarget.gapKg)} kg to your target — roughly ${p.toTarget.weeks} weeks at this rate.`
      : '';
    return `${line}${target}\n\n${p.onCourse ? 'That matches what your goal asks for.' : 'That isn’t the direction your goal asks for.'}\n\n${p.caveat}`;
  }

  if (/habit|pattern|when do i|snack|weekend|window/.test(t)) {
    const h = habitAnalysis(app.log, { today: app.day });
    if (!h.days) return 'Your diary is empty, so I can’t see any patterns yet. Log a few days and ask again.';
    const bits = [`Across ${h.days} logged day${h.days === 1 ? '' : 's'}: ${h.perDay} entries a day, ${h.snackShare}% of calories from snacks.`];
    if (h.window) bits.push(`You eat between ${h.window.first} and ${h.window.last} — a ${h.window.hours} hour window.`);
    if (h.weekendGap !== null && Math.abs(h.weekendGap) >= 200) {
      bits.push(`Weekends run ${h.weekendGap > 0 ? 'heavier' : 'lighter'} by about ${Math.abs(h.weekendGap)} kcal a day.`);
    }
    if (h.skipped.length) bits.push(`${h.skipped[0].label} is logged on only ${h.skipped[0].days} of those days.`);
    return bits.join('\n\n');
  }

  if (/tip|advice|suggest|what should i change|improve/.test(t)) {
    const tips = personalTips(app, { today: app.day });
    return tips.map((tip) => `• ${tip.title}\n  ${tip.detail}\n  (${tip.evidence})`).join('\n\n');
  }

  if (/eat(ing)? out|restaurant|takeaway|takeout|nando|greggs|pret/.test(t)) {
    const out = restaurantPicks(app, { today: app.day });
    if (!out.picks.length) return 'Nothing on the menus this app ships fits what’s left of today. It only knows a handful of chains — it has no idea what’s near you.';
    return `${out.kcalLeft ? `${out.kcalLeft.toLocaleString()} kcal left today. ` : ''}Best protein per calorie from the menus I have:\n\n${
      out.picks.map((p) => `• ${p.food.name} (${p.food.chain}) — ${p.kcal} kcal, ${p.protein}g protein`).join('\n')
    }\n\nThese are the only chains I ship figures for.`;
  }

  if (/swap|instead of|healthier|alternative/.test(t)) {
    const recent = app.recentFoods?.[0];
    if (!recent) return 'Log something first and I’ll suggest swaps for it — I only compare foods I can see in your diary.';
    const swaps = healthierSwaps(recent, { catalogue: app.catalogue, diets: app.planDiets });
    if (!swaps.length) return `Nothing in the catalogue clearly beats ${recent.name} on protein, fibre, saturated fat or sugar.`;
    return `Instead of ${recent.name}:\n\n${swaps.map((s) => `• ${s.food.name} — ${s.why}`).join('\n')}`;
  }

  if (/goal|target|aiming/.test(t)) {
    return `You're set to ${goalSummary(app)}: ${app.targets.kcal.toLocaleString()} kcal a day (${app.weeklyKcalTarget.toLocaleString()} across the week), ${app.targets.protein}g protein, ${app.targets.carbs}g carbs, ${app.targets.fat}g fat.${
      app.week.eaten ? `\n\nThis week you're at ${app.week.eaten.toLocaleString()} kcal — ${app.week.left >= 0 ? `${app.week.left.toLocaleString()} left` : `${Math.abs(app.week.left).toLocaleString()} over`}.` : ''
    }`;
  }

  if (/protein|macro|calorie|kcal|how am i doing/.test(t)) {
    if (!app.entries.length) return 'Nothing logged today yet — add a meal in the diary and I can tell you where you stand.';
    const left = Math.round(app.targets.protein - app.totals.protein);
    const kcalLeft = app.targets.kcal - app.totals.kcal;
    const pick = [...book].sort((a, b) => b.protein - a.protein)[0];
    return `You're on ${app.totals.kcal.toLocaleString()} kcal of ${app.targets.kcal.toLocaleString()} and ${Math.round(app.totals.protein)}g of ${app.targets.protein}g protein.\n\n${
      left > 0
        ? `${left}g of protein and ${kcalLeft.toLocaleString()} kcal to go. ${pick.name} would bring ${pick.protein}g.`
        : 'Protein target already met — nice.'
    }`;
  }

  if (/afford|budget|money|spend|£/.test(t)) {
    if (!app.weeklyBudget) return 'No weekly budget set yet — add one in your profile and I’ll track headroom against the shops you record.';
    const left = app.weeklyBudget - app.spentThisWeek;
    const cheap = [...book].sort((a, b) => a.costPerServing - b.costPerServing).slice(0, 3);
    return `You've recorded ${gbp(app.spentThisWeek, { always: true })} of your ${gbp(app.weeklyBudget)} budget this week — ${
      left >= 0 ? `${gbp(left, { always: true })} left` : `${gbp(-left, { always: true })} over`
    }.\n\nCheapest per serving in your recipe book:\n${cheap.map(recipeLine).join('\n')}`;
  }

  if (/15 min|20 min|quick|fast|tonight|dinner/.test(t)) {
    const planned = app.plan[app.day]?.dinner;
    if (planned && /tonight|dinner/.test(t)) {
      const r = RECIPES.find((x) => x.id === planned);
      return `Dinner is already planned: ${r.name} — ${r.time} minutes, ${gbp(r.costPerServing, { always: true })} a serving.`;
    }
    const quick = book.filter((r) => r.time <= 25).sort((a, b) => a.time - b.time);
    return `Quickest things in your recipe book:\n\n${quick.slice(0, 4).map(recipeLine).join('\n')}`;
  }

  if (/eaten|been eating|diary|history|week/.test(t)) {
    const days = Object.keys(app.log).filter((d) => app.log[d].length);
    if (!days.length) return 'Your diary is empty so far. Log a meal — search, barcode, photo or voice — and I can spot patterns.';
    const cooked = app.cooked.length;
    return `You've logged food on ${days.length} day${days.length === 1 ? '' : 's'} and cooked ${cooked} meal${cooked === 1 ? '' : 's'} from the app.${
      app.streak ? ` Current cooking streak: ${app.streak} days.` : ''
    }`;
  }

  if (pantry.length && /cook|make|recipe|what should/.test(t)) {
    const uses = recipesUsing(pantry, 5, app.day).filter((u) => recipeAllowed(u.recipe, app.diets)).slice(0, 3);
    if (uses.length) return `Based on what's in your kitchen:\n\n${uses.map((u) => recipeLine(u.recipe)).join('\n')}`;
  }

  return 'I answer from your own data — pantry, diary, budget and plan. Ask what needs using up, how today’s macros look, whether you’re on track, what your habits are, what fits if you’re eating out, or what to cook tonight.';
}

export default function AiAssistant() {
  const app = useApp();
  const [messages, setMessages] = useState([
    {
      role: 'ai',
      text: app.pantry.length || app.entries.length
        ? 'Hey! Ask me about your pantry, your diary, your budget or tonight’s dinner.'
        : 'Hey! I read your pantry, diary and budget — there’s not much there yet, so start by logging a meal or adding what’s in your kitchen.',
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    // Guarded: not every environment (or older browser) implements it.
    if (typeof endRef.current?.scrollIntoView === 'function') {
      endRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, thinking]);

  const send = (text) => {
    const q = (text ?? input).trim();
    if (!q || thinking) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setThinking(true);
    setTimeout(() => {
      setMessages((m) => [...m, { role: 'ai', text: answer(q, app) }]);
      setThinking(false);
    }, 500);
  };

  return (
    <div className="flex flex-col h-[70vh]">
      <div className="flex-1 overflow-y-auto no-scrollbar px-5 py-3 space-y-3">
        {messages.map((m, i) => (
          <div key={i} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className="max-w-[85%] rounded-2xl px-4 py-2.5 text-[14px] font-medium leading-relaxed whitespace-pre-line"
              style={m.role === 'user'
                ? { background: 'var(--accent)', color: 'var(--on-accent)', borderBottomRightRadius: 6 }
                : { background: 'var(--card)', border: '1px solid var(--line)', borderBottomLeftRadius: 6 }}
            >
              {m.text}
            </div>
          </div>
        ))}
        {thinking && (
          <div className="flex justify-start">
            <div className="rounded-2xl px-4 py-3" style={{ background: 'var(--card)', border: '1px solid var(--line)' }}>
              <span className="inline-flex gap-1">
                {[0, 1, 2].map((i) => (
                  <span key={i} className="pulse-dot h-1.5 w-1.5 rounded-full inline-block" style={{ background: 'var(--faint)', animationDelay: `${i * 200}ms` }} />
                ))}
              </span>
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      <div className="px-5 pb-2 flex gap-2 overflow-x-auto no-scrollbar shrink-0">
        {QUICK_PROMPTS.map((p) => (
          <button
            key={p}
            onClick={() => send(p)}
            className="press shrink-0 rounded-full border px-3 py-1.5 text-[12px] font-bold"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            {p}
          </button>
        ))}
      </div>

      <div className="px-5 pb-5 pt-2 flex gap-2 shrink-0">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && send()}
          placeholder="Ask about your kitchen…"
          className="flex-1 rounded-2xl border px-4 py-3 text-[14px] font-semibold outline-none"
          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
        <button
          onClick={() => send()}
          aria-label="Send"
          className="press flex h-12 w-12 items-center justify-center rounded-2xl"
          style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
        >
          <ArrowUp size={20} strokeWidth={2.4} />
        </button>
      </div>
    </div>
  );
}
