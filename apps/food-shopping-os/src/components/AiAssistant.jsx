import { useEffect, useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';
import { RECIPES } from '../data/recipes.js';
import { expiringSoon } from '../data/pantry.js';
import { gbp } from '../lib/utils.js';

const QUICK_PROMPTS = [
  'I have £18 until Friday',
  'I only have chicken and potatoes',
  'My kids hate vegetables',
  'Meals under 600 calories',
  'I have 15 minutes',
  'Make tomorrow’s lunch',
];

const recipeLine = (r) => `• ${r.name} — ${r.time} min, ${gbp(r.costPerServing, { always: true })}/serving, ${r.kcal} kcal`;

/** Tiny scripted "coach": keyword-match the ask, answer from real app data. */
function answer(text) {
  const t = text.toLowerCase();
  const cheap = RECIPES.filter((r) => !r.tags.includes('breakfast')).sort((a, b) => a.costPerServing - b.costPerServing);
  const quick = RECIPES.filter((r) => r.time <= 20);
  const light = RECIPES.filter((r) => r.kcal <= 480);

  if (/£\s*\d|\b\d+\s*(quid|pounds?)\b|budget|friday/.test(t)) {
    const picks = cheap.slice(0, 3);
    const cost = picks.reduce((s, r) => s + r.costPerServing * 2, 0);
    return `Tight week — let's stretch it. Three dinners for two comes to ${gbp(cost, { always: true })}, leaving room for basics:\n\n${picks.map(recipeLine).join('\n')}\n\nThe chilli makes 6 portions, so freeze half and Thursday is free. Want me to build the list?`;
  }
  if (t.includes('chicken') && t.includes('potato')) {
    return `That's dinner already: Lemon Chicken Traybake needs just chicken, potatoes and a few pantry staples you have (onion, garlic, oil). 45 minutes, one tin, ${gbp(1.85, { always: true })}/serving. Missing only a lemon — 60p at Aldi.`;
  }
  if (t.includes('kid') || t.includes('veg')) {
    return `Classic. Three stealth-veg wins that test well with picky eaters:\n\n${['airfryer-fajitas', 'katsu-curry', 'slowcooker-ragu'].map((id) => recipeLine(RECIPES.find((r) => r.id === id))).join('\n')}\n\nGrate carrot and pepper into the ragù sauce — invisible after 8 hours. Build-your-own fajitas gives them control, which usually beats persuasion.`;
  }
  if (t.includes('600') || t.includes('calorie') || t.includes('light')) {
    return `Under 600 kcal and still dinner-shaped:\n\n${light.slice(0, 4).map(recipeLine).join('\n')}\n\nAll fit your protein goal too. Want one added to tonight?`;
  }
  if (t.includes('15 min') || t.includes('minutes') || t.includes('quick')) {
    return `Speed round — on the table in ~15:\n\n${quick.map(recipeLine).join('\n')}\n\nThe grain bowl needs zero cooking skill and you have most of it in the pantry.`;
  }
  if (t.includes('lunch') || t.includes('tomorrow')) {
    return `Tomorrow's lunch, sorted: Halloumi Grain Bowl — 15 min tonight, packs well, ${gbp(2, { always: true })}/serving. Or use up the leftover ragù portion in the fridge (free, and it beats waste). I'd do the ragù.`;
  }
  const exp = expiringSoon();
  if (t.includes('waste') || t.includes('expir') || t.includes('use up')) {
    return `Right now ${exp.length} items need using: ${exp.slice(0, 3).map((p) => `${p.name} (${p.expiryDays}d)`).join(', ')}. The Coconut Chickpea Curry takes the spinach; the sourdough freezes fine sliced.`;
  }
  return `I can plan meals around your budget, pantry, time, or goals. Try one of the quick prompts below — or tell me what's in your fridge and how long you've got.`;
}

export default function AiAssistant() {
  const [messages, setMessages] = useState([
    { role: 'ai', text: 'Hey! I\'m your food coach. I know your pantry, budget and goals — ask me anything.' },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, thinking]);

  const send = (text) => {
    const q = (text ?? input).trim();
    if (!q || thinking) return;
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: q }]);
    setThinking(true);
    setTimeout(() => {
      setMessages((m) => [...m, { role: 'ai', text: answer(q) }]);
      setThinking(false);
    }, 900);
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
          placeholder="Ask your food coach…"
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
