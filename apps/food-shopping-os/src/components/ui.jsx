import { useEffect, useState } from 'react';
import { cx, clamp } from '../lib/utils.js';

/* ---------- Layout ---------- */

export const Section = ({ title, action, onAction, children, className }) => (
  <section className={cx('px-5', className)}>
    {title && (
      <div className="flex items-baseline justify-between mb-3">
        <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
        {action && (
          <button onClick={onAction} className="text-[13px] font-semibold press" style={{ color: 'var(--accent)' }}>
            {action}
          </button>
        )}
      </div>
    )}
    {children}
  </section>
);

export const Card = ({ children, className, onClick, style }) => (
  <div
    onClick={onClick}
    style={style}
    className={cx('card p-4', onClick && 'press cursor-pointer', className)}
  >
    {children}
  </div>
);

export const Chip = ({ active, children, onClick, tone }) => (
  <button
    onClick={onClick}
    className="press shrink-0 rounded-full px-3.5 py-1.5 text-[13px] font-semibold border transition-colors"
    style={
      active
        ? { background: 'var(--accent)', color: 'var(--on-accent)', borderColor: 'var(--accent)' }
        : { background: 'var(--card)', color: tone || 'var(--muted)', borderColor: 'var(--line)' }
    }
  >
    {children}
  </button>
);

export const Pill = ({ children, tone = 'muted' }) => {
  const tones = {
    muted: { background: 'var(--card-2)', color: 'var(--muted)' },
    accent: { background: 'var(--accent-soft)', color: 'var(--accent-deep)' },
    good: { background: 'color-mix(in srgb, var(--good) 14%, transparent)', color: 'var(--good)' },
    warn: { background: 'color-mix(in srgb, var(--warn) 14%, transparent)', color: 'var(--warn)' },
    danger: { background: 'color-mix(in srgb, var(--danger) 14%, transparent)', color: 'var(--danger)' },
    faint: { background: 'var(--card-2)', color: 'var(--faint)' },
  };
  return (
    <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold" style={tones[tone]}>
      {children}
    </span>
  );
};

/* ---------- Data viz ---------- */

/** Circular progress ring with centred label. */
export const Ring = ({ value, max, size = 72, stroke = 7, color = 'var(--accent)', label, sub }) => {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = clamp(max ? value / max : 0, 0, 1);
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)}
          style={{ transition: 'stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="font-extrabold" style={{ fontSize: size / 4.4 }}>{label}</span>
        {sub && <span className="text-[9px] font-semibold mt-0.5" style={{ color: 'var(--faint)' }}>{sub}</span>}
      </div>
    </div>
  );
};

/** Compact sparkline; single series, area under line, dot on last point. */
export const Sparkline = ({ points, width = 120, height = 36, color = 'var(--series-1)' }) => {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const span = max - min || 1;
  const step = width / (points.length - 1);
  const y = (v) => 3 + (height - 6) * (1 - (v - min) / span);
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${(i * step).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const lastX = (points.length - 1) * step;
  return (
    <svg width={width} height={height} className="overflow-visible" aria-hidden="true">
      <path d={`${path} L${width},${height} L0,${height} Z`} fill={color} opacity="0.12" />
      <path d={path} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <circle cx={lastX} cy={y(points[points.length - 1])} r="3.5" fill={color} stroke="var(--card)" strokeWidth="2" />
    </svg>
  );
};

/** Vertical bar chart with rounded data-ends and direct label on peak+last. */
export const Bars = ({ data, height = 96, color = 'var(--series-1)', highlight, format = (v) => v }) => {
  const max = Math.max(...data.map((d) => d.value)) || 1;
  const peak = data.reduce((m, d, i) => (d.value > data[m].value ? i : m), 0);
  return (
    <div className="flex items-end gap-2" style={{ height }}>
      {data.map((d, i) => {
        const hl = highlight === undefined ? i === data.length - 1 : i === highlight;
        const labelled = i === peak || i === data.length - 1;
        return (
          <div key={d.label} className="flex-1 flex flex-col items-center justify-end gap-1 h-full min-w-0">
            {labelled && (
              <span className="text-[10px] font-bold leading-none" style={{ color: 'var(--muted)' }}>
                {format(d.value)}
              </span>
            )}
            <div
              className="w-full rounded-t"
              style={{
                height: `${Math.max(6, (d.value / max) * 72)}%`,
                background: hl ? color : 'color-mix(in srgb, ' + color + ' 32%, var(--card-2))',
                transition: 'height 500ms cubic-bezier(0.22,1,0.36,1)',
              }}
            />
            <span className="text-[10px] font-semibold" style={{ color: 'var(--faint)' }}>{d.label}</span>
          </div>
        );
      })}
    </div>
  );
};

/** Thin horizontal progress bar. */
export const Meter = ({ value, max, color = 'var(--accent)', height = 6 }) => (
  <div className="w-full rounded-full overflow-hidden" style={{ background: 'var(--line)', height }}>
    <div
      className="h-full rounded-full"
      style={{
        width: `${clamp((value / max) * 100, 0, 100)}%`,
        background: color,
        transition: 'width 500ms cubic-bezier(0.22,1,0.36,1)',
      }}
    />
  </div>
);

/* ---------- Overlays ---------- */

/** Bottom sheet / full-screen page overlay. */
export const Sheet = ({ open, onClose, children, full = false, title }) => {
  const [render, setRender] = useState(open);
  useEffect(() => {
    if (open) setRender(true);
    else {
      const t = setTimeout(() => setRender(false), 200);
      return () => clearTimeout(t);
    }
  }, [open]);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);
  if (!render) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div
        className="absolute inset-0 transition-opacity duration-200"
        style={{ background: 'rgba(10,10,12,0.45)', opacity: open ? 1 : 0 }}
        onClick={onClose}
      />
      <div
        className={cx('sheet-up relative w-full max-w-lg flex flex-col', full ? 'h-full' : 'max-h-[92%] rounded-t-3xl')}
        style={{ background: 'var(--bg)', transition: 'transform 200ms', transform: open ? 'none' : 'translateY(30px)' }}
      >
        {!full && <div className="mx-auto mt-2.5 mb-1 h-1 w-10 rounded-full shrink-0" style={{ background: 'var(--line)' }} />}
        {title && (
          <div className="flex items-center justify-between px-5 pt-3 pb-2 shrink-0">
            <h2 className="text-lg font-extrabold tracking-tight">{title}</h2>
            <button
              onClick={onClose}
              aria-label="Close"
              className="press h-8 w-8 rounded-full text-sm font-bold"
              style={{ background: 'var(--card-2)', color: 'var(--muted)' }}
            >
              ✕
            </button>
          </div>
        )}
        <div className="overflow-y-auto no-scrollbar flex-1 overscroll-contain">{children}</div>
      </div>
    </div>
  );
};

export const Stepper = ({ value, onChange, min = 1, max = 12 }) => (
  <div className="inline-flex items-center gap-3 rounded-full border px-2 py-1" style={{ borderColor: 'var(--line)', background: 'var(--card)' }}>
    <button className="press h-7 w-7 rounded-full font-bold" style={{ background: 'var(--card-2)' }} onClick={() => onChange(Math.max(min, value - 1))} aria-label="Decrease">−</button>
    <span className="w-5 text-center font-extrabold text-[15px]">{value}</span>
    <button className="press h-7 w-7 rounded-full font-bold" style={{ background: 'var(--accent-soft)', color: 'var(--accent-deep)' }} onClick={() => onChange(Math.min(max, value + 1))} aria-label="Increase">+</button>
  </div>
);

export const Toggle = ({ on, onChange }) => (
  <button
    onClick={onChange}
    role="switch"
    aria-checked={on}
    className="press relative h-7 w-12 rounded-full transition-colors"
    style={{ background: on ? 'var(--accent)' : 'var(--line)' }}
  >
    <span
      className="absolute top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform"
      style={{ transform: on ? 'translateX(22px)' : 'translateX(2px)', left: 0 }}
    />
  </button>
);

/** Emoji hero tile used as "food photography". */
export const FoodArt = ({ recipe, className, size = 'text-5xl' }) => (
  <div
    className={cx('flex items-center justify-center overflow-hidden', className)}
    style={{ background: recipe.grad }}
    aria-hidden="true"
  >
    <span className={cx(size, 'drop-shadow-lg')} style={{ filter: 'saturate(1.1)' }}>{recipe.emoji}</span>
  </div>
);
