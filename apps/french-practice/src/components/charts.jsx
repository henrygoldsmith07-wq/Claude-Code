import { useEffect, useRef } from 'react';
import { scoreColor } from './ui';

// Canvas + SVG chart primitives for the analytics overlay.

export function ProgressRing({ value, label, size = 84 }) {
  const r = size / 2 - 7;
  const circ = 2 * Math.PI * r;
  const c = scoreColor(value);
  return (
    <figure className="flex flex-col items-center gap-1">
      <svg width={size} height={size} role="img" aria-label={`${label} : ${value} sur 100`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(30 41 59)" strokeWidth="7" />
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
        <text x="50%" y="50%" dy="0.36em" textAnchor="middle" className="fill-slate-100 font-bold" fontSize={size / 4.4}>
          {value}
        </text>
      </svg>
      <figcaption className="text-[11px] text-slate-400">{label}</figcaption>
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
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
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
      ctx.strokeStyle = 'rgba(51, 65, 85, 0.6)';
      ctx.stroke();
      const lx = cx + (R + 18) * Math.cos(a);
      const ly = cy + (R + 18) * Math.sin(a);
      ctx.fillStyle = 'rgb(148 163 184)';
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
    ctx.fillStyle = 'rgba(52, 211, 153, 0.18)';
    ctx.fill();
    ctx.strokeStyle = 'rgb(52 211 153)';
    ctx.lineWidth = 2;
    ctx.stroke();
    // vertices
    for (let i = 0; i < n; i++) {
      const a = angle(i);
      const rr = (R * (values[i] || 0)) / 100;
      ctx.beginPath();
      ctx.arc(cx + rr * Math.cos(a), cy + rr * Math.sin(a), 3.5, 0, Math.PI * 2);
      ctx.fillStyle = 'rgb(16 185 129)';
      ctx.fill();
    }
  }, [axes, values, size]);

  return (
    <canvas
      ref={ref}
      style={{ width: size, height: size }}
      role="img"
      aria-label={`Radar : ${axes.map((a, i) => `${a} ${values[i]}`).join(', ')}`}
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
      <p className="text-xs text-slate-500 italic py-6 text-center">
        Terminez au moins deux sessions pour voir votre progression 📈
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
      aria-label={`Tendance sur ${points.length} sessions : ${points.join(', ')}`}
    >
      {[25, 50, 75, 100].map((g) => (
        <g key={g}>
          <line x1={pad.l} x2={w - pad.r} y1={y(g)} y2={y(g)} stroke="rgb(30 41 59)" strokeWidth="1" />
          <text x={pad.l - 6} y={y(g) + 3} textAnchor="end" fontSize="9" fill="rgb(100 116 139)">{g}</text>
        </g>
      ))}
      <path d={area} fill="rgba(52, 211, 153, 0.12)" />
      <path d={path} fill="none" stroke="rgb(52 211 153)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {points.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r="3.5" fill="rgb(2 6 23)" stroke="rgb(52 211 153)" strokeWidth="2" />
      ))}
    </svg>
  );
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

  const bg = ctx.createLinearGradient(0, 0, w, h);
  bg.addColorStop(0, '#020617');
  bg.addColorStop(1, '#0f172a');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
  ctx.lineWidth = 2;
  ctx.strokeRect(10, 10, w - 20, h - 20);

  ctx.fillStyle = '#34d399';
  ctx.font = 'bold 15px system-ui';
  ctx.fillText('LE STUDIO — PRATIQUE DU FRANÇAIS 🇫🇷', 36, 52);
  ctx.fillStyle = '#f1f5f9';
  ctx.font = 'bold 88px system-ui';
  ctx.fillText(grade, 36, 160);
  ctx.fillStyle = '#94a3b8';
  ctx.font = '16px system-ui';
  ctx.fillText(`Scénario : ${scenarioTitle}`, 36, 196);
  ctx.fillText(`Série : ${streak} jour${streak > 1 ? 's' : ''} 🔥`, 36, 222);
  ctx.fillText(new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }), 36, 248);

  const rows = [
    ['Grammaire', scores.grammar],
    ['Naturel', scores.naturalness],
    ['Pertinence', scores.relevance],
    ['Fluidité', scores.fluency],
    ['Global', scores.overall],
  ];
  rows.forEach(([label, v], i) => {
    const yy = 300 + i * 0; // single row of mini-bars below
    void yy;
    const bx = 36 + i * 118;
    ctx.fillStyle = '#64748b';
    ctx.font = '12px system-ui';
    ctx.fillText(label, bx, 296);
    ctx.fillStyle = 'rgb(30 41 59)';
    ctx.fillRect(bx, 306, 96, 10);
    ctx.fillStyle = v >= 85 ? '#34d399' : v >= 70 ? '#2dd4bf' : v >= 55 ? '#fbbf24' : '#fb7185';
    ctx.fillRect(bx, 306, (96 * v) / 100, 10);
    ctx.fillStyle = '#f1f5f9';
    ctx.font = 'bold 16px system-ui';
    ctx.fillText(String(v), bx, 344);
  });

  return canvas.toDataURL('image/png');
}
