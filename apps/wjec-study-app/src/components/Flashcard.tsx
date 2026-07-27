"use client";

interface Props {
  front: string;
  back: string;
  revealed: boolean;
  onReveal: () => void;
}

export default function Flashcard({ front, back, revealed, onReveal }: Props) {
  return (
    <div className="flex min-h-56 w-full flex-col justify-between rounded-2xl border border-line bg-surface p-6">
      <p className="text-lg font-medium">{front}</p>
      {revealed ? (
        <p className="mt-4 border-t border-dashed border-line pt-4 text-ink2">
          {back}
        </p>
      ) : (
        <button
          onClick={onReveal}
          className="mt-4 self-start rounded-full border border-line px-4 py-1.5 text-sm hover:bg-surface2 dark:hover:bg-surface"
        >
          Show answer
        </button>
      )}
    </div>
  );
}
