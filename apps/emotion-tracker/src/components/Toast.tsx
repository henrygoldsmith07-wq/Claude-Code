"use client";

import { useEffect } from "react";

interface Props {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  onDismiss: () => void;
}

export default function Toast({ message, actionLabel, onAction, onDismiss }: Props) {
  useEffect(() => {
    const timer = setTimeout(onDismiss, 5000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-zinc-300 bg-white px-4 py-2.5 text-sm shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={() => {
            onAction();
            onDismiss();
          }}
          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
        >
          {actionLabel}
        </button>
      )}
      <button
        onClick={onDismiss}
        className="rounded p-0.5 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
        aria-label="Dismiss"
      >
        ✕
      </button>
    </div>
  );
}
