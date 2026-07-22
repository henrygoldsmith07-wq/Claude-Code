"use client";

interface Props {
  front: string;
  back: string;
  revealed: boolean;
  onReveal: () => void;
}

export default function Flashcard({ front, back, revealed, onReveal }: Props) {
  return (
    <div
      className="flex min-h-56 w-full flex-col justify-between rounded-2xl border border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900"
      role="region"
      aria-label={revealed ? "Flashcard answer revealed" : "Flashcard prompt"}
    >
      <p className="text-lg font-medium">{front}</p>
      {revealed ? (
        <p className="mt-4 border-t border-dashed border-zinc-300 pt-4 text-zinc-700 dark:border-zinc-700 dark:text-zinc-300">
          {back}
        </p>
      ) : (
        <button
          type="button"
          onClick={onReveal}
          className="mt-4 self-start rounded-full border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-800"
        >
          Show answer <span className="text-zinc-400">(Space)</span>
        </button>
      )}
    </div>
  );
}
