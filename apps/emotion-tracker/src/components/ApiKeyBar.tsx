"use client";

import { useTheme } from "@/lib/useTheme";

interface Props {
  apiKey: string;
  onChange: (value: string) => void;
}

export default function ApiKeyBar({ apiKey, onChange }: Props) {
  const { theme, toggle, mounted } = useTheme();

  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
      <label className="text-xs font-medium text-zinc-500">Anthropic API key (stored only in this browser)</label>
      <input
        value={apiKey}
        onChange={(e) => onChange(e.target.value)}
        type="password"
        placeholder="sk-ant-... (optional if the server has one configured)"
        autoComplete="off"
        className="w-full max-w-xs rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900 sm:w-80"
      />
      <div className="ml-auto flex items-center gap-2">
        {mounted && (
          <button
            onClick={toggle}
            className="rounded-md border border-zinc-300 px-2.5 py-1 text-xs font-medium hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
            aria-label="Toggle theme"
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
          >
            {theme === "dark" ? "☀️ Light" : "🌙 Dark"}
          </button>
        )}
      </div>
    </div>
  );
}
