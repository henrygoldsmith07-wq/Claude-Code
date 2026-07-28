import { useState } from 'react';
import { Check, Info, RotateCcw, SlidersHorizontal, TriangleAlert } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { alcoholUnits, nutrientAlerts, nutrientRows } from '../lib/nutrition.js';
import { NUTRIENT_GROUPS, formatAmount } from '../data/nutrients.js';
import { Card, Meter, Pill, Ring, Section } from './ui.jsx';
import WaterGlasses from './WaterGlasses.jsx';

const TONE_COLOR = {
  good: 'var(--good)',
  warn: 'var(--warn)',
  danger: 'var(--danger)',
  muted: 'var(--series-1)',
  faint: 'var(--series-3)',
};

/** One nutrient: what you've had, what you're aiming at, how far along. */
const NutrientRow = ({ row, editing, onTarget }) => (
  <div className="py-2.5">
    <div className="flex items-baseline justify-between gap-2 mb-1.5">
      <span className="text-[13px] font-bold">{row.label}</span>
      {editing ? (
        <span className="inline-flex items-center gap-1.5">
          <input
            type="number"
            min="0"
            value={row.target}
            onChange={(e) => onTarget(row.key, e.target.value)}
            aria-label={`${row.label} target`}
            className="w-20 rounded-xl border px-2 py-1 text-[13px] font-bold text-right outline-none"
            style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
          />
          <span className="text-[11px] font-bold" style={{ color: 'var(--faint)' }}>{row.unit}</span>
        </span>
      ) : (
        <span className="text-[12px] font-semibold tabular-nums" style={{ color: 'var(--muted)' }}>
          {formatAmount(row.key, row.value)}
          <span style={{ color: 'var(--faint)' }}> / {formatAmount(row.key, row.target)}</span>
        </span>
      )}
    </div>
    <div className="flex items-center gap-2">
      <div className="flex-1">
        <Meter value={Math.min(row.value, row.target)} max={row.target} color={TONE_COLOR[row.tone]} height={5} />
      </div>
      <span className="w-10 text-right text-[11px] font-bold tabular-nums" style={{ color: TONE_COLOR[row.tone] }}>
        {row.pct}%
      </span>
    </div>
  </div>
);

/** Water: the eight glasses, plus anything drunk that the diary already knows about. */
const WaterCard = () => {
  const app = useApp();
  const { fromDrinks, fromGlasses, total } = app.hydration;
  const target = app.targets.water;
  return (
    <Card>
      <div className="flex items-baseline justify-between">
        <p className="text-[12px] font-bold uppercase tracking-wide" style={{ color: 'var(--faint)' }}>Water intake</p>
        <p className="text-[12px] font-semibold" style={{ color: 'var(--muted)' }}>
          {total.toLocaleString()} / {target.toLocaleString()} ml
        </p>
      </div>
      <div className="mt-2.5"><WaterGlasses size={20} /></div>
      <div className="mt-3"><Meter value={total} max={target} height={6} /></div>
      <div className="mt-3 flex gap-2">
        {[250, 500, 750].map((ml) => (
          <button
            key={ml}
            onClick={() => app.addWaterMl(ml)}
            className="press flex-1 rounded-2xl border py-2 text-[12.5px] font-extrabold"
            style={{ borderColor: 'var(--line)' }}
          >
            +{ml} ml
          </button>
        ))}
      </div>
      <p className="mt-3 text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
        {fromGlasses.toLocaleString()} ml tracked ({app.water} glass{app.water === 1 ? '' : 'es'}
        {app.waterExtraMl ? ` + ${app.waterExtraMl} ml` : ''}) · {fromDrinks.toLocaleString()} ml from
        food and drinks in your diary
      </p>
    </Card>
  );
};

/**
 * The full nutrition picture for today: all 24 tracked nutrients against their
 * daily reference intakes, grouped, with every target editable.
 */
export default function NutritionPanel() {
  const app = useApp();
  const [editing, setEditing] = useState(false);
  // Hydration counts the glasses tracker as well as the water in your food.
  const totals = { ...app.totals, water: app.hydration.total };
  const targets = app.targets;
  const rows = nutrientRows(totals, targets);
  const alerts = nutrientAlerts(totals, targets);
  const kcal = rows.find((r) => r.key === 'kcal');
  const units = alcoholUnits(totals.alcohol);

  return (
    <div className="px-5 pb-10 space-y-5">
      {/* Headline */}
      <Card>
        <div className="flex items-center gap-5">
          <Ring
            value={totals.kcal}
            max={targets.kcal}
            size={86}
            stroke={9}
            color="var(--series-2)"
            label={totals.kcal.toLocaleString()}
            sub={`of ${targets.kcal.toLocaleString()}`}
          />
          <div className="flex-1 space-y-1.5">
            <p className="text-[13px] font-bold">
              {kcal.pct}% of your energy target
            </p>
            <div className="flex flex-wrap gap-1.5">
              <Pill tone="good"><Check size={11} strokeWidth={3} /> {alerts.hit.length} targets hit</Pill>
              {alerts.over.length > 0 && (
                <Pill tone="danger"><TriangleAlert size={11} /> {alerts.over.length} over limit</Pill>
              )}
              {alerts.low.length > 0 && <Pill tone="warn">{alerts.low.length} running low</Pill>}
            </div>
          </div>
        </div>
        {(alerts.over.length > 0 || alerts.low.length > 0) && (
          <p className="mt-3 pt-3 border-t text-[12.5px] font-semibold" style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}>
            {alerts.over.length > 0 && <>Over: {alerts.over.map((r) => r.label).join(', ')}. </>}
            {alerts.low.length > 0 && <>Short on: {alerts.low.slice(0, 4).map((r) => r.label).join(', ')}.</>}
          </p>
        )}
      </Card>

      {/* Honesty about where the numbers come from */}
      <div className="flex items-start gap-2 rounded-2xl border p-3" style={{ borderColor: 'var(--line)' }}>
        <Info size={14} className="mt-0.5 shrink-0" style={{ color: 'var(--faint)' }} />
        <p className="text-[11.5px] font-semibold leading-snug" style={{ color: 'var(--muted)' }}>
          Micronutrients are carried by {app.coverage.pct}% of today’s calories — quick-adds and
          custom foods without a full profile contribute energy and macros only.
        </p>
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => setEditing((v) => !v)}
          className="press flex-1 rounded-2xl border py-2.5 text-[13px] font-extrabold"
          style={editing
            ? { background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'var(--accent)' }
            : { borderColor: 'var(--line)' }}
        >
          <span className="inline-flex items-center gap-1.5">
            <SlidersHorizontal size={14} /> {editing ? 'Done editing targets' : 'Edit daily targets'}
          </span>
        </button>
        {editing && (
          <button
            onClick={app.resetTargets}
            aria-label="Reset targets"
            className="press rounded-2xl border px-4"
            style={{ borderColor: 'var(--line)', color: 'var(--muted)' }}
          >
            <RotateCcw size={15} />
          </button>
        )}
      </div>

      {NUTRIENT_GROUPS.map((group) => (
        <Section key={group.id} title={group.label} className="!px-0">
          {group.id === 'other' && <div className="mb-3"><WaterCard /></div>}
          <Card className="!py-2">
            {rows.filter((r) => r.group === group.id).map((row) => (
              <NutrientRow
                key={row.key}
                row={row}
                editing={editing}
                onTarget={app.setTarget}
              />
            ))}
            {group.id === 'other' && totals.alcohol > 0 && (
              <p className="pb-2 text-[11.5px] font-semibold" style={{ color: 'var(--muted)' }}>
                {units} UK unit{units === 1 ? '' : 's'} today · guidance is under 14 a week.
              </p>
            )}
          </Card>
        </Section>
      ))}
    </div>
  );
}
