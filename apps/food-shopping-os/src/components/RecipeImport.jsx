import { useState } from 'react';
import { Check, ClipboardPaste, Link2, ShoppingCart, Sparkles } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { importRecipeText, importRecipeUrl } from '../lib/foodlog.js';
import { buildEntry, mealForTime, timeStamp } from '../lib/nutrition.js';
import { itemsFromRecipes } from '../data/stores.js';
import { Card, Chip, Pill, Stepper } from './ui.jsx';
import { MacroSummary, MealPicker } from './FoodDetail.jsx';

const SAMPLE = `Peanut butter overnight oats
Serves 2
80g porridge oats
250ml semi-skimmed milk
2 tbsp peanut butter
1 banana
40g blueberries
1 tsp honey`;

/**
 * Recipe importer. A pasted recipe is parsed for real — quantities, units and
 * ingredient matches drive the per-serving estimate. A link resolves against
 * the bundled recipe set, since the app ships without a backend to fetch with.
 */
export default function RecipeImport({ defaultMeal, onDone }) {
  const app = useApp();
  const [mode, setMode] = useState('paste');
  const [url, setUrl] = useState('');
  const [text, setText] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [servings, setServings] = useState(1);
  const [meal, setMeal] = useState(defaultMeal || mealForTime());
  const [saved, setSaved] = useState(false);
  const [listed, setListed] = useState(false);

  const run = () => {
    setError('');
    setSaved(false);
    setListed(false);
    const out = mode === 'url' ? importRecipeUrl(url) : importRecipeText(text, app.catalogue);
    if (!out) {
      setError(mode === 'url' ? 'That doesn’t look like a recipe link.' : 'Paste a title and a few ingredient lines.');
      setResult(null);
      return;
    }
    setResult(out);
    setServings(1);
  };

  const log = () => {
    const food = result.food;
    const grams = food.servings[0].grams * servings;
    app.logEntry(buildEntry(food, {
      grams,
      meal,
      time: timeStamp(),
      source: 'recipe',
      servingLabel: servings === 1 ? '1 serving' : `${servings} servings`,
    }));
    onDone();
  };

  const macros = result
    ? Object.fromEntries(Object.entries(result.perServing).map(([k, v]) => [k, Math.round(v * servings * 10) / 10]))
    : null;

  return (
    <div className="px-5 pb-10 space-y-4">
      <div className="flex gap-2">
        <Chip active={mode === 'paste'} onClick={() => { setMode('paste'); setResult(null); }}>Paste recipe</Chip>
        <Chip active={mode === 'url'} onClick={() => { setMode('url'); setResult(null); }}>From a link</Chip>
      </div>

      {mode === 'url' ? (
        <label className="block">
          <span className="text-[11px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Recipe URL</span>
          <div className="mt-1 flex items-center gap-2 rounded-2xl border px-4 py-3" style={{ background: 'var(--card)', borderColor: 'var(--line)' }}>
            <Link2 size={15} style={{ color: 'var(--faint)' }} />
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://bbcgoodfood.com/recipes/…"
              aria-label="Recipe URL"
              className="w-full bg-transparent text-[14px] font-semibold outline-none"
              style={{ color: 'var(--ink)' }}
            />
          </div>
        </label>
      ) : (
        <>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={7}
            placeholder={'Recipe title\nServes 4\n400g chicken breast\n200g rice\n…'}
            aria-label="Recipe text"
            className="w-full rounded-2xl border px-4 py-3 text-[13.5px] font-semibold outline-none resize-none"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
          <button
            onClick={() => setText(SAMPLE)}
            className="press inline-flex items-center gap-1.5 text-[12.5px] font-bold"
            style={{ color: 'var(--accent)' }}
          >
            <ClipboardPaste size={13} /> Use an example
          </button>
        </>
      )}

      <button
        onClick={run}
        disabled={mode === 'url' ? !url.trim() : !text.trim()}
        className="press w-full rounded-2xl py-3.5 text-[15px] font-extrabold disabled:opacity-40"
        style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
      >
        <span className="inline-flex items-center gap-2"><Sparkles size={16} /> Import recipe</span>
      </button>

      {error && <Pill tone="danger">{error}</Pill>}

      {result && (
        <div className="space-y-4 rise">
          <Card>
            <p className="font-extrabold text-[16px] leading-tight">{result.title}</p>
            <p className="mt-0.5 text-[12.5px] font-semibold" style={{ color: 'var(--muted)' }}>
              {result.domain ? `From ${result.domain} · ` : ''}makes {result.servings} servings
              {result.matchedCount !== undefined && ` · ${result.matchedCount}/${result.ingredients.length} ingredients matched`}
            </p>
            <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--line)' }}>
              <MacroSummary macros={macros} size="sm" />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <span className="text-[12.5px] font-bold">Servings eaten</span>
              <Stepper value={servings} onChange={setServings} min={1} max={6} />
            </div>
          </Card>

          <Card className="!p-0 divide-y" style={{ borderColor: 'var(--line)' }}>
            {result.ingredients.slice(0, 14).map((ing, i) => (
              <div key={`${ing.name}-${i}`} className="flex items-center gap-3 p-3 text-[13.5px]">
                <span className="flex-1 font-semibold truncate">{ing.line}</span>
                {ing.food
                  ? <Pill tone="good">{ing.grams} g · {ing.food.name}</Pill>
                  : <Pill tone="faint">not matched</Pill>}
              </div>
            ))}
          </Card>

          <MealPicker value={meal} onChange={setMeal} />

          <div className="grid grid-cols-2 gap-2.5">
            <button
              onClick={() => { app.addCustomFood(result.food); setSaved(true); }}
              disabled={saved}
              className="press rounded-2xl border py-3 text-[13.5px] font-extrabold disabled:opacity-60"
              style={{ borderColor: saved ? 'var(--good)' : 'var(--line)', color: saved ? 'var(--good)' : 'var(--ink)' }}
            >
              <span className="inline-flex items-center gap-1.5">
                {saved ? <><Check size={14} strokeWidth={3} /> In My foods</> : 'Save to My foods'}
              </span>
            </button>
            {result.recipe && (
              <button
                onClick={() => { app.addToList(itemsFromRecipes([result.recipe])); setListed(true); }}
                disabled={listed}
                className="press rounded-2xl border py-3 text-[13.5px] font-extrabold disabled:opacity-60"
                style={{ borderColor: listed ? 'var(--good)' : 'var(--line)', color: listed ? 'var(--good)' : 'var(--ink)' }}
              >
                <span className="inline-flex items-center gap-1.5">
                  <ShoppingCart size={14} /> {listed ? 'On your list' : 'Shop missing'}
                </span>
              </button>
            )}
          </div>

          <button
            onClick={log}
            className="press w-full rounded-2xl py-3.5 text-[15px] font-extrabold"
            style={{ background: 'var(--accent)', color: 'var(--on-accent)' }}
          >
            Log {servings} serving{servings === 1 ? '' : 's'} · {macros.kcal} kcal
          </button>
        </div>
      )}
    </div>
  );
}
