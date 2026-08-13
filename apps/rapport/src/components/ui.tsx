"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

// ---------------------------------------------------------------------------
// The component vocabulary.
//
// Small and deliberately plain. The distinguishing pieces are `Evidence` and
// `Hedged`, which exist because the product has to be able to show the
// difference between something it counted and something it inferred — and that
// distinction has to be visible, not just present in the copy.
// ---------------------------------------------------------------------------

export function Card({
  children,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article" | "li";
}) {
  return (
    <Tag
      className={`rounded-[var(--radius)] border p-5 ${className}`}
      style={{ background: "var(--surface)", borderColor: "var(--border)", boxShadow: "var(--shadow)" }}
    >
      {children}
    </Tag>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md";
};

export function Button({ variant = "primary", size = "md", className = "", ...props }: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 rounded-[10px] font-medium transition-colors disabled:opacity-45 disabled:cursor-not-allowed";
  const sizes = size === "sm" ? "px-3 py-1.5 text-sm" : "px-4 py-2.5 text-[15px]";
  const styles: Record<string, React.CSSProperties> = {
    primary: { background: "var(--accent)", color: "var(--accent-text)", border: "1px solid transparent" },
    secondary: { background: "var(--surface)", color: "var(--text)", border: "1px solid var(--border-strong)" },
    ghost: { background: "transparent", color: "var(--text-muted)", border: "1px solid transparent" },
    danger: { background: "var(--danger-soft)", color: "var(--danger)", border: "1px solid var(--danger)" },
  };
  return <button {...props} className={`${base} ${sizes} ${className}`} style={{ ...styles[variant], ...props.style }} />;
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "accent" | "warn" | "danger" }) {
  const tones: Record<string, React.CSSProperties> = {
    neutral: { background: "var(--bg)", color: "var(--text-muted)", borderColor: "var(--border)" },
    accent: { background: "var(--accent-soft)", color: "var(--accent)", borderColor: "transparent" },
    warn: { background: "var(--warn-soft)", color: "var(--warn)", borderColor: "transparent" },
    danger: { background: "var(--danger-soft)", color: "var(--danger)", borderColor: "transparent" },
  };
  return (
    <span
      className="inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap"
      style={tones[tone]}
    >
      {children}
    </span>
  );
}

/**
 * A bar with an explicit uncertainty band. Where the app is unsure it shows a
 * wider band rather than a more precise-looking number — the visual has to
 * carry the same honesty as the copy.
 */
export function Meter({
  value,
  uncertainty = 0,
  label,
  sublabel,
}: {
  value: number;
  uncertainty?: number;
  label: string;
  sublabel?: string;
}) {
  const percent = Math.round(Math.min(1, Math.max(0, value)) * 100);
  const bandLow = Math.max(0, percent - uncertainty * 100);
  const bandWidth = Math.min(100 - bandLow, uncertainty * 200);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-sm" style={{ color: "var(--text-muted)" }}>{label}</span>
        {sublabel ? <span className="text-xs" style={{ color: "var(--text-faint)" }}>{sublabel}</span> : null}
      </div>
      <div
        className="relative mt-1.5 h-2 w-full overflow-hidden rounded-full"
        style={{ background: "var(--border)" }}
        role="img"
        aria-label={`${label}: ${percent} percent${uncertainty > 0.12 ? ", estimate is uncertain" : ""}`}
      >
        {uncertainty > 0 ? (
          <div
            className="absolute inset-y-0 rounded-full"
            style={{ left: `${bandLow}%`, width: `${bandWidth}%`, background: "var(--accent-soft)" }}
          />
        ) : null}
        <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: `${percent}%`, background: "var(--accent)", opacity: 0.85 }} />
      </div>
    </div>
  );
}

/** Counted facts. Rendered in a monospaced-ish, unemphatic style on purpose. */
export function Evidence({ items }: { items: string[] }) {
  if (items.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1">
      {items.map((item) => (
        <li key={item} className="text-[13px] leading-snug" style={{ color: "var(--text-muted)" }}>
          <span aria-hidden="true" className="mr-1.5">·</span>
          {item}
        </li>
      ))}
    </ul>
  );
}

/** Anything the app inferred rather than counted, visually marked as such. */
export function Hedged({ children, label = "Interpretation" }: { children: ReactNode; label?: string }) {
  return (
    <div
      className="mt-3 rounded-[10px] border border-dashed px-3 py-2.5"
      style={{ borderColor: "var(--border-strong)", background: "var(--bg)" }}
    >
      <span className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--text-faint)" }}>
        {label}
      </span>
      <div className="mt-1 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{children}</div>
    </div>
  );
}

export function EmptyState({ title, body, action }: { title: string; body: string; action?: ReactNode }) {
  return (
    <Card className="text-center">
      <h3 className="text-base font-semibold">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </Card>
  );
}

export function Skeleton({ className = "h-4 w-full" }: { className?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden="true" />;
}

export function PageHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="mb-6">
      <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
      {subtitle ? <p className="mt-1.5 text-sm leading-relaxed" style={{ color: "var(--text-muted)" }}>{subtitle}</p> : null}
    </header>
  );
}

/** Where an AI-written string is shown, its provenance is shown with it. */
export function SourceNote({ source, note }: { source: "ai" | "fallback" | "deterministic" | "ai-assisted"; note?: string }) {
  const label =
    source === "ai" || source === "ai-assisted"
      ? "Wording generated by a model; the measurements are computed on your device."
      : "Computed on your device — no model involved.";
  return (
    <p className="mt-3 text-[11px] leading-relaxed" style={{ color: "var(--text-faint)" }}>
      {label}
      {note ? ` ${note}` : ""}
    </p>
  );
}

export function Field({ label, hint, children, id }: { label: string; hint?: string; children: ReactNode; id: string }) {
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium">{label}</label>
      {hint ? <p className="mt-0.5 text-xs" style={{ color: "var(--text-faint)" }}>{hint}</p> : null}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

export function TextInput({ id, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { id: string }) {
  return (
    <input
      id={id}
      {...props}
      className={`w-full rounded-[10px] border px-3 py-2 text-[15px] outline-none ${props.className ?? ""}`}
      style={{ background: "var(--surface)", borderColor: "var(--border-strong)", color: "var(--text)" }}
    />
  );
}

export function TextArea({ id, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { id: string }) {
  return (
    <textarea
      id={id}
      {...props}
      className={`w-full resize-y rounded-[10px] border px-3 py-2 text-[15px] leading-relaxed outline-none ${props.className ?? ""}`}
      style={{ background: "var(--surface)", borderColor: "var(--border-strong)", color: "var(--text)" }}
    />
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  id,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  id: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div className="min-w-0">
        <label htmlFor={id} className="text-sm font-medium">{label}</label>
        {description ? <p className="mt-0.5 text-xs leading-relaxed" style={{ color: "var(--text-muted)" }}>{description}</p> : null}
      </div>
      <button
        id={id}
        role="switch"
        aria-checked={checked}
        aria-label={label}
        onClick={() => onChange(!checked)}
        className="relative mt-0.5 h-6 w-11 shrink-0 rounded-full transition-colors"
        style={{ background: checked ? "var(--accent)" : "var(--border-strong)" }}
      >
        <span
          className="absolute top-0.5 h-5 w-5 rounded-full transition-transform"
          style={{ background: "var(--surface)", transform: checked ? "translateX(22px)" : "translateX(2px)" }}
        />
      </button>
    </div>
  );
}
