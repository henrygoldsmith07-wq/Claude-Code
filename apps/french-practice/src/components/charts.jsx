import { useEffect, useRef } from 'react';
import { scoreColor } from './ui';

// Canvas + SVG chart primitives for the analytics overlay.
// SVG uses CSS variables directly; canvas resolves them at draw time so the
// charts follow the active light/dark theme.

function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const get = (name, fallback) => css.getPropertyValue(name).trim() || fallback;
  return {
    bg: get('--bg', '#fafafa'),
    surface2: get('--surface-2', '#efefef'),
    line: get('--line', '#d8d8d8'),
    ink: get('--ink', '#111111'),
    ink2: get('--ink-2', '#555555'),
    ink3: get('--ink-3', '#9b9b9b'),
  };
}

export function ProgressRing({ value, label, size = 84 }) {
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const c = scoreColor(value);
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg width={size} height={size} role="img" aria-label={`${label}: ${value} out of 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--line)" strokeWidth="7" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={c.ring}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - value / 100)}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.3, 0.8, 0.3, 1)' }}
        />
        <text x="50%" y="50%" dy="0.36em" textAnchor="middle" fill="var(--ink)" className="font-bold" fontSize={size / 4.4}>
          {value}
        </text>
      </svg>
      <figcaption className="text-[11px] text-ink2">{label}</figcaption>
    </figure>
  );
}

// Five-axis radar drawn on canvas (HiDPI-aware).
export function RadarChart({ axes, values, size = 260 }) {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const dpr = window.devicePixelRatio || 1;
    canvas.width = size * dpr;
    canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, size, size);

    const theme = themeColors();
    const cx = size / 2;
    const cy = size / 2;
    const R = size / 2 - 34;
    const n = axes.length;
    const angle = (i) => (Math.PI * 2 * i) / n - Math.PI / 2;

    // grid rings
    for (let ring = 1; ring <= 4; ring++) {
      ctx.beginPath();
      for (let i = 0; i <= n; i++) {
        const a = angle(i % n);
        const rr = (R * ring) / 4;
        const x = cx + rr * Math.cos(a);
        const y = cy + rr * Math.sin(a);
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.strokeStyle = theme.line;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // spokes + labels
    ctx.font = '11px system-ui, sans-serif';
    for (let i = 0; i < n; i++) {
      const a = angle(i);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(cx + R * Math.cos(a), cy + R * Math.sin(a));
      ctx.strokeStyle = theme.line;
      ctx.stroke();
      const lx = cx + (R + 18) * Math.cos(a);
      const ly = cy + (R + 18) * Math.sin(a);
      ctx.fillStyle = theme.ink2;
      ctx.textAlign = Math.abs(Math.cos(a)) < 0.3 ? 'center' : Math.cos(a) > 0 ? 'left' : 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(axes[i], lx, ly);
    }
    // data polygon
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const a = angle(i % n);
      const rr = (R * (values[i % n] || 0)) / 100;
      const x = cx + rr * Math.cos(a);
      const y = cy + rr * Math.sin(a);
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.globalAlpha = 0.14;
    ctx.fillStyle = theme.ink;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = theme.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
    // vertices
    for (let i = 0; i < n; i++) {
      const a = angle(i);
      const rr = (R * (values[i] || 0)) / 100;
      ctx.beginPath();
      ctx.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = theme.ink;
      ctx.fill();
    }
  }, [axes, values, size]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Radar: ${axes.map((a, i) => `${a} ${values[i]}`).join(', ')}`}
    />
  );
}

// Historical trend over the last sessions (SVG line chart).
export function TrendChart({ sessions }) {
  const w = 560;
  const h = 130;
  const pad = { l: 30, r: 10, t: 12, b: 20 };
  const points = sessions.map((s) => s.report.average_scores.overall);
  if (points.length < 2) {
    return (
      <p className="text-xs text-ink3 italic py-6 text-center">
        Finish at least two sessions to see your progress
      </p>
    );
  }
  const x = (i) => pad.l + (i / (points.length - 1)) * (w - pad.l - pad.r);
  const y = (v) => pad.t + (1 - v / 100) * (h - pad.t - pad.b);
  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const area = `${path} L${x(points.length - 1)},${h - pad.b} L${x(0)},${h - pad.b} Z`;

  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      className="w-full"
      role="img"
      aria-label={`Trend over ${points.length} sessions: ${points.join(', ')}`}
    >
      {[25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={w - pad.r} y1={y(g)} y2={y(g)} stroke="var(--line)" strokeWidth="1" />
          <text x={pad.l - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="var(--ink-3)">{g}</text>
        </g>
      ))}
      <path d={area} fill="var(--ink)" opacity="0.1" />
      <path d={path} fill="none" stroke="var(--ink)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="var(--surface)" stroke="var(--ink)" strokeWidth="2" />
      ))}
    </svg>
  );
}

// Renders an earned certificate to an offscreen canvas → PNG data URL.
export function renderCertificate({ title, requirement, stat, date }) {
  const w = 640;
  const h = 452;
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const theme = themeColors();

  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);
  // double rule border, certificate style
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 3;
  ctx.strokeRect(14, 14, w - 28, h - 28);
  ctx.lineWidth = 1;
  ctx.strokeRect(24, 24, w - 48, h - 48);

  ctx.textAlign = 'center';
  ctx.fillStyle = theme.ink3;
  ctx.font = 'bold 13px system-ui';
  ctx.fillText('LE STUDIO — FRENCH PRACTICE', w / 2, 78);
  ctx.fillStyle = theme.ink2;
  ctx.font = '15px system-ui';
  ctx.fillText('This certifies that the learner has earned the', w / 2, 150);
  ctx.fillStyle = theme.ink;
  ctx.font = 'bold 40px Georgia, serif';
  ctx.fillText(title, w / 2, 210);
  ctx.fillStyle = theme.ink2;
  ctx.font = '16px system-ui';
  ctx.fillText(requirement, w / 2, 250);
  ctx.fillStyle = theme.ink;
  ctx.font = 'bold 22px system-ui';
  ctx.fillText(stat, w / 2, 296);
  // rule + date
  ctx.strokeStyle = theme.line;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 120, 330);
  ctx.lineTo(w / 2 + 120, 330);
  ctx.stroke();
  ctx.fillStyle = theme.ink3;
  ctx.font = '14px system-ui';
  ctx.fillText(date, w / 2, 360);
  ctx.textAlign = 'start';

  return canvas.toDataURL('image/png');
}

// Renders the shareable progress card to an offscreen canvas → PNG data URL.
export function renderShareCard({ grade, scores, streak, scenarioTitle }) {
  const w = 640;
  const h = 400;
  const canvas = document.createElement('canvas');
  const scale = 2;
  canvas.width = w * scale;
  canvas.height = h * scale;
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  const theme = themeColors();

  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = theme.ink;
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.fillStyle = theme.ink;
  ctx.font = 'bold 15px system-ui';
  ctx.fillText('LE STUDIO — FRENCH PRACTICE', 36, 52);
  ctx.fillStyle = theme.ink;
  ctx.font = 'bold 88px system-ui';
  ctx.fillText(grade, 36, 160);
  ctx.fillStyle = theme.ink2;
  ctx.font = '16px system-ui';
  ctx.fillText(`Scenario: ${scenarioTitle}`, 36, 196);
  ctx.fillText(`Streak: ${streak} day${streak > 1 ? 's' : ''}`, 36, 222);
  ctx.fillText(new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }), 36, 248);

  const rows = [
    ['Grammar', scores.grammar],
    ['Naturalness', scores.naturalness],
    ['Relevance', scores.relevance],
    ['Fluency', scores.fluency],
    ['Overall', scores.overall],
  ];
  rows.forEach(([label, v], i) => {
    const bx = 36 + i * 118;
    ctx.fillStyle = theme.ink3;
    ctx.font = '12px system-ui';
    ctx.fillText(label, bx, 296);
    ctx.fillStyle = theme.surface2;
    ctx.fillRect(bx, 306, 96, 10);
    // score intensity mirrors the UI's monochrome ramp
    ctx.globalAlpha = v >= 85 ? 1 : v >= 70 ? 0.75 : v >= 55 ? 0.52 : 0.32;
    ctx.fillStyle = theme.ink;
    ctx.fillRect(bx, 306, (96 * v) / 100, 10);
    ctx.globalAlpha = 1;
    ctx.fillStyle = theme.ink;
    ctx.font = 'bold 16px system-ui';
    ctx.fillText(String(v), bx, 344);
  });

  return canvas.toDataURL('image/png');
}
