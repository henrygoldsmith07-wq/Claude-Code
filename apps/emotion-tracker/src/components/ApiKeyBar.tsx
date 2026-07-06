"use client";

interface Props {
  apiKey: string;
  onChange: (value: string) => void;
}

export default function ApiKeyBar({ apiKey, onChange }: Props) {
  return (
    <div className="flex items-center gap-2 border-b border-zinc-200 px-4 py-2 dark:border-zinc-800">
      <label className="text-xs font-medium text-zinc-500">Gemini API key (stored only in this browser)</label>
      <input
        value={apiKey}
        onChange={(e) => onChange(e.target.value)}
        type="password"
        placeholder="AIza... (optional if the server has one configured)"
        autoComplete="off"
        className="w-80 rounded-md border border-zinc-300 px-2 py-1 text-sm dark:border-zinc-700 dark:bg-zinc-900"
      />
    </div>
  );
}
