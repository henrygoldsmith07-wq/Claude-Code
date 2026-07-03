"use client";

import { useRef, useState } from "react";
import type { Theme } from "@/lib/useTheme";

interface Props {
  theme: Theme;
  onThemeChange: (theme: Theme) => void;
  showShare: boolean;
  onShowShareChange: (value: boolean) => void;
  onExportBackup: () => void;
  onImportBackup: (file: File) => void;
  onImportCsv: (file: File) => void;
  onCopySummary: () => void;
  onExportCsv: () => void;
}

export default function SettingsBar({
  theme,
  onThemeChange,
  showShare,
  onShowShareChange,
  onExportBackup,
  onImportBackup,
  onImportCsv,
  onCopySummary,
  onExportCsv,
}: Props) {
  const backupInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    onCopySummary();
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex flex-wrap items-center gap-3 text-xs">
      <select
        value={theme}
        onChange={(e) => onThemeChange(e.target.value as Theme)}
        className="rounded-full border border-zinc-300 px-3 py-1 dark:border-zinc-700 dark:bg-zinc-900"
      >
        <option value="system">Theme: System</option>
        <option value="light">Theme: Light</option>
        <option value="dark">Theme: Dark</option>
      </select>

      <label className="flex items-center gap-1.5">
        <input
          type="checkbox"
          checked={showShare}
          onChange={(e) => onShowShareChange(e.target.checked)}
          className="h-3.5 w-3.5"
        />
        Show your share (not full cost)
      </label>

      <button
        onClick={handleCopy}
        className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        {copied ? "Copied!" : "Copy summary"}
      </button>

      <button
        onClick={onExportCsv}
        className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Export CSV
      </button>

      <button
        onClick={onExportBackup}
        className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Backup (JSON)
      </button>

      <button
        onClick={() => backupInputRef.current?.click()}
        className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Restore backup
      </button>
      <input
        ref={backupInputRef}
        type="file"
        accept="application/json"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportBackup(file);
          e.target.value = "";
        }}
      />

      <button
        onClick={() => csvInputRef.current?.click()}
        className="rounded-full border border-zinc-300 px-3 py-1 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
      >
        Import CSV
      </button>
      <input
        ref={csvInputRef}
        type="file"
        accept="text/csv"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onImportCsv(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
