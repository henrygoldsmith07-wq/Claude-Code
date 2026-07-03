"use client";

interface Props {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}

export default function Toast({ message, actionLabel, onAction, onDismiss }: Props) {
  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-zinc-300 bg-white px-4 py-2 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {actionLabel}
        </button>
      )}
      <button onClick={onDismiss} className="text-zinc-400 hover:text-zinc-600">
        ✕
      </button>
    </div>
  );
}
