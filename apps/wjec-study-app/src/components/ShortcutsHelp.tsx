"use client";

import { useEffect, useState } from "react";

const SHORTCUTS = [
  { keys: "Space / Enter", action: "Reveal flashcard answer" },
  { keys: "1 / 2 / 3 / 4", action: "Grade Again / Hard / Good / Easy" },
  { keys: "R", action: "Toggle reverse cards (answer first)" },
  { keys: "U", action: "Undo last grade in this session" },
  { keys: "1–4 (quiz)", action: "Select an answer option" },
  { keys: "Enter (quiz)", action: "Next question / finish" },
  { keys: "?", action: "Toggle this shortcuts panel" },
];

export default function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "?" || (e.key === "/" && e.shiftKey)) {
        e.preventDefault();
        setOpen((v) => !v);
      }
      if (e.key === "Escape") setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-zinc-300 px-3 py-1 text-xs hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        title="Keyboard shortcuts"
      >
        Shortcuts (?)
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Keyboard shortcuts"
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-300 bg-white p-6 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Keyboard shortcuts</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-sm text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200"
              >
                Close
              </button>
            </div>
            <ul className="flex flex-col gap-2">
              {SHORTCUTS.map((s) => (
                <li
                  key={s.keys}
                  className="flex items-center justify-between gap-3 rounded-lg border border-zinc-200 px-3 py-2 text-sm dark:border-zinc-800"
                >
                  <span className="text-zinc-600 dark:text-zinc-400">{s.action}</span>
                  <kbd className="shrink-0 rounded bg-zinc-100 px-2 py-0.5 font-mono text-xs dark:bg-zinc-800">
                    {s.keys}
                  </kbd>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}
