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
    <div
      role="tablist"
      aria-label="Study sections"
      className="-mx-1 flex gap-1.5 overflow-x-auto border-b-2 border-[#201e1a] px-1 pb-2"
    >
      {tabs.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            role="tab"
            type="button"
            aria-selected={isActive}
            onClick={() => onChange(tab.id)}
            className={
              isActive
                ? "shrink-0 rounded-full bg-[#3b4a6b] px-3 py-1.5 text-xs font-medium text-[#fbfaf7]"
                : "shrink-0 rounded-full px-3 py-1.5 text-xs text-[#5a544b] hover:bg-[#e7eaf1]"
            }
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
