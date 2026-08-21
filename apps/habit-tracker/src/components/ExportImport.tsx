"use client";

import { useRef, useState } from "react";
import { serializeExport } from "@/lib/exportImport";
import type { HabitExportV1 } from "@/lib/types";

interface Props {
  exportData: () => Promise<HabitExportV1>;
  importData: (json: string) => Promise<{ ok: boolean; error?: string }>;
}

export function ExportImport({ exportData, importData }: Props) {
  const [status, setStatus] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const doExport = async () => {
    const data = await exportData();
    const blob = new Blob([serializeExport(data)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `habit-export-${data.exportedAt.slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus(`Exported ${data.habits.length} habits, ${data.checkins.length} check-ins (v${data.version})`);
  };

  const doImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const result = await importData(text);
    if (result.ok) setStatus("Import successful — data merged.");
    else setStatus(`Import failed: ${result.error}`);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <section aria-labelledby="export-import-title" className="rounded-xl border border-line bg-surface p-4">
      <h2 id="export-import-title" className="text-sm font-semibold">Backup &amp; restore</h2>
      <p className="mt-1 text-xs text-ink3">Export is a versioned JSON bundle (habits, check-ins, settings). Validate before importing.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={doExport} className="rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-onaccent hover:opacity-90">
          Export JSON
        </button>
        <label className="rounded-lg border border-line bg-bg px-3 py-1.5 text-sm font-medium cursor-pointer hover:bg-line">
          Import JSON
          <input ref={fileRef} type="file" accept="application/json" onChange={doImport} className="hidden" />
        </label>
      </div>
      {status ? <p className="mt-2 text-xs text-ink2">{status}</p> : null}
    </section>
  );
}
