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
    const timer = setTimeout(onDismiss, 6000);
    return () => clearTimeout(timer);
  }, [message, onDismiss]);

  return (
    <div className="fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 text-sm shadow-lg">
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="font-medium text-speak hover:underline"
        >
          {actionLabel}
        </button>
      )}
      <button onClick={onDismiss} className="text-ink3 hover:text-ink2">
        ✕
      </button>
    </div>
  );
}
