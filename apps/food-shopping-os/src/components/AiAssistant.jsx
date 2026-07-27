import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { RECIPES } from '../data/recipes.js';
import { useApp } from '../lib/store.jsx';
import { expiringSoon, recipesUsing } from '../lib/kitchen.js';
import { gbp } from '../lib/utils.js';

const QUICK_PROMPTS = [
  'What should I cook tonight?',
  'What needs using up?',
  'How am I doing on protein?',
  'What can I afford this week?',
  'Something in 15 minutes',
  'What have I been eating?',
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

  if (/waste|expir|use ?up|using up|going off|needs? using/.test(t)) {
    if (!expiring.length) {
      return pantry.length
        ? 'Nothing in your pantry is close to its use-by date. Add dates as you shop and I’ll flag things here.'
        : 'Your pantry is empty, so there’s nothing for me to watch. Add a few items and I’ll tell you what to cook before it turns.';
    }
    const uses = recipesUsing(pantry, 2, app.day);
    return `${expiring.length} thing${expiring.length === 1 ? '' : 's'} need using: ${expiring.slice(0, 4).map((p) => p.name).join(', ')}.${
      uses.length ? `\n\n${uses.map((u) => recipeLine(u.recipe)).join('\n')}` : ''
    }`;
  }

  if (/protein|macro|calorie|kcal|how am i doing/.test(t)) {
    if (!app.entries.length) return 'Nothing logged today yet — add a meal in the diary and I can tell you where you stand.';
    const left = Math.round(app.targets.protein - app.totals.protein);
    const kcalLeft = app.targets.kcal - app.totals.kcal;
    const pick = [...RECIPES].sort((a, b) => b.protein - a.protein)[0];
    return `You're on ${app.totals.kcal.toLocaleString()} kcal of ${app.targets.kcal.toLocaleString()} and ${Math.round(app.totals.protein)}g of ${app.targets.protein}g protein.\n\n${
      left > 0
        ? `${left}g of protein and ${kcalLeft.toLocaleString()} kcal to go. ${pick.name} would bring ${pick.protein}g.`
        : 'Protein target already met — nice.'
    }`;
  }

  if (/afford|budget|money|spend|£/.test(t)) {
    if (!app.weeklyBudget) return 'No weekly budget set yet — add one in your profile and I’ll track headroom against the shops you record.';
    const left = app.weeklyBudget - app.spentThisWeek;
    const cheap = [...RECIPES].sort((a, b) => a.costPerServing - b.costPerServing).slice(0, 3);
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
    const quick = RECIPES.filter((r) => r.time <= 25).sort((a, b) => a.time - b.time);
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
    const uses = recipesUsing(pantry, 3, app.day);
    if (uses.length) return `Based on what's in your kitchen:\n\n${uses.map((u) => recipeLine(u.recipe)).join('\n')}`;
  }

  return 'I answer from your own data — pantry, diary, budget and plan. Ask what needs using up, how today’s macros look, what you can afford, or what to cook tonight.';
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
