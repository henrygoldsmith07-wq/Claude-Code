"use client";

interface Tab {
  id: string;
  label: string;
}

interface Props {
  tabs: Tab[];
  active: string;
  onChange: (id: string) => void;
}

export default function TabBar({ tabs, active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5 border-b-2 border-[var(--ink)] pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={
            tab.id === active
              ? "rounded-full bg-[var(--accent)] px-3 py-1.5 text-xs font-medium text-[var(--surface)]"
              : "rounded-full px-3 py-1.5 text-xs text-[var(--ink-2)] hover:bg-[var(--surface-2)]"
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
