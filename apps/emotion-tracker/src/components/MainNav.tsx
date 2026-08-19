"use client";

export type MainView = "reflect" | "history" | "patterns" | "settings";

const items: { id: MainView; label: string; icon: string }[] = [
  { id: "reflect", label: "Reflect", icon: "✦" },
  { id: "history", label: "History", icon: "↺" },
  { id: "patterns", label: "Patterns", icon: "⌁" },
  { id: "settings", label: "Settings", icon: "⚙" },
];

export default function MainNav({ view, onChange }: { view: MainView; onChange: (view: MainView) => void }) {
  return (
    <nav aria-label="Main navigation" className="flex items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card/70 p-1">
      {items.map((item) => {
        const active = item.id === view;
        return (
          <button
            key={item.id}
            type="button"
            aria-current={active ? "page" : undefined}
            onClick={() => onChange(item.id)}
            className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${active ? "bg-accent text-white shadow-sm" : "text-muted hover:bg-card-hover hover:text-foreground"}`}
          >
            <span aria-hidden="true">{item.icon}</span>
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
