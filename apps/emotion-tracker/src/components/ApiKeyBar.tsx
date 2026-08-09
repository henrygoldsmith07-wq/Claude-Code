"use client";

interface Props {
  apiKey: string;
  onChange: (value: string) => void;
}

export default function ApiKeyBar({ apiKey, onChange }: Props) {
  return (
    <div className="flex items-center gap-3 border-b border-border bg-card/60 px-4 py-2 backdrop-blur-sm">
      <label className="shrink-0 text-[11px] font-medium uppercase tracking-wide text-muted">
        API key
      </label>
      <input
        value={apiKey}
        onChange={(e) => onChange(e.target.value)}
        type="password"
        placeholder="sk-ant-… (optional if server key is set)"
        autoComplete="off"
        className="w-full max-w-md rounded-lg border border-border bg-background px-2.5 py-1 text-sm outline-none transition-colors placeholder:text-muted/50 focus:border-accent focus:ring-1 focus:ring-accent/20"
      />
      <span className="hidden text-[10px] text-muted sm:inline">
        Stored only in this browser
      </span>
    </div>
  );
}
