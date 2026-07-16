import { useEffect, useRef, useState } from 'react';
import { speak, stopSpeaking, ttsSupported } from '../lib/tts';

// ---- score color ramp (shared everywhere) ----

export function scoreColor(v) {
  if (v >= 85) return { text: 'text-emerald-400', bg: 'bg-emerald-500', ring: '#34d399' };
  if (v >= 70) return { text: 'text-teal-300', bg: 'bg-teal-500', ring: '#2dd4bf' };
  if (v >= 55) return { text: 'text-amber-300', bg: 'bg-amber-500', ring: '#fbbf24' };
  return { text: 'text-rose-400', bg: 'bg-rose-500', ring: '#fb7185' };
}

export function ScoreBadge({ value, size = 'md' }) {
  const c = scoreColor(value);
  const cls = size === 'lg' ? 'w-14 h-14 text-lg' : 'w-9 h-9 text-xs';
  return (
    <div
      className={`${cls} ${c.text} rounded-full grid place-items-center font-bold border-2 shrink-0`}
      style={{ borderColor: c.ring, background: `${c.ring}18` }}
      aria-label={`Score ${value} sur 100`}
    >
      {value}
    </div>
  );
}

// ---- modal shell (dialog semantics + escape/backdrop close) ----

export function Modal({ open, onClose, children, wide = false }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-6"
      onClick={onClose}
      role="presentation"
    >
      <div
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
        className={`sheet-enter w-full ${wide ? 'sm:max-w-3xl' : 'sm:max-w-md'} max-h-[92dvh] overflow-y-auto nice-scroll bg-slate-900 border border-slate-700/60 rounded-t-3xl sm:rounded-3xl shadow-2xl shadow-black/50`}
      >
        {children}
      </div>
    </div>
  );
}

// ---- minimal markdown → HTML with a strict tag allowlist ----
// The LLM is told to use <s>/<mark>; everything else gets escaped first.

const ALLOWED = ['s', 'del', 'mark', 'strong', 'em', 'code', 'br', 'ul', 'li'];

export function renderMarkdown(md) {
  let html = String(md)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
  // restore allowlisted bare tags (no attributes survive)
  for (const tag of ALLOWED) {
    html = html
      .replace(new RegExp(`&lt;${tag}&gt;`, 'gi'), `<${tag}>`)
      .replace(new RegExp(`&lt;/${tag}&gt;`, 'gi'), `</${tag}>`)
      .replace(new RegExp(`&lt;${tag} ?/&gt;`, 'gi'), `<${tag}/>`);
  }
  html = html
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>')
    .replace(/`([^`]+)`/g, '<code>$1</code>');
  // bullet lists
  html = html.replace(/(?:^|\n)((?:[-*] .+(?:\n|$))+)/g, (_, block) => {
    const items = block.trim().split('\n').map((l) => `<li>${l.replace(/^[-*] /, '')}</li>`).join('');
    return `\n<ul>${items}</ul>`;
  });
  return html.replace(/\n/g, '<br/>');
}

export function Markdown({ children, className = '' }) {
  return (
    <div
      className={`corrections-body ${className}`}
      dangerouslySetInnerHTML={{ __html: renderMarkdown(children) }}
    />
  );
}

// ---- TTS replay button (with optional slow-mo rate) ----

export function SpeakButton({ text, rate = 1, slow = false, label }) {
  const [speaking, setSpeaking] = useState(false);
  const timeout = useRef(null);
  useEffect(() => () => clearTimeout(timeout.current), []);
  if (!ttsSupported()) return null;

  const onClick = () => {
    if (speaking) {
      stopSpeaking();
      setSpeaking(false);
      return;
    }
    setSpeaking(true);
    speak(text, { rate: slow ? Math.min(rate, 0.75) : rate, onEnd: () => setSpeaking(false) });
    // Safety: onend is unreliable on some mobile browsers
    timeout.current = setTimeout(() => setSpeaking(false), 30000);
  };

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label || (slow ? 'Écouter au ralenti' : 'Écouter')}
      className={`inline-flex items-center gap-1 px-2 py-1 min-h-8 rounded-lg text-[11px] font-medium transition-colors ${
        speaking
          ? 'bg-emerald-500/25 text-emerald-300'
          : 'bg-slate-700/40 text-slate-300 hover:bg-slate-700/80 active:bg-slate-600'
      }`}
    >
      {speaking ? '◼' : '▶'} {slow ? '0.75×' : label || 'Écouter'}
    </button>
  );
}

export function RateSlider({ rate, onChange }) {
  return (
    <label className="flex items-center gap-2 text-[11px] text-slate-400">
      <span aria-hidden="true">🐢</span>
      <input
        type="range"
        min="0.5"
        max="1.5"
        step="0.1"
        value={rate}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-24 accent-emerald-400"
        aria-label="Vitesse de lecture"
      />
      <span aria-hidden="true">🐇</span>
      <span className="font-mono w-8">{rate.toFixed(1)}×</span>
    </label>
  );
}

export function Spinner({ label }) {
  return (
    <span className="inline-flex items-center gap-2 text-slate-400 text-sm">
      <span className="w-4 h-4 rounded-full border-2 border-slate-600 border-t-emerald-400 animate-spin" />
      {label}
    </span>
  );
}
