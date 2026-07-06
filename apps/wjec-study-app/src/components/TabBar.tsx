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
    <div className="flex flex-wrap gap-1.5 border-b-2 border-[#201e1a] pb-2">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={
            tab.id === active
              ? "rounded-full bg-[#3b4a6b] px-3 py-1.5 text-xs font-medium text-[#fbfaf7]"
              : "rounded-full px-3 py-1.5 text-xs text-[#5a544b] hover:bg-[#e7eaf1]"
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
