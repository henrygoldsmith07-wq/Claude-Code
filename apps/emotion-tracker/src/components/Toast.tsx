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
    // Schedule per message only — parent re-renders must not reset the timer,
    // and the dismiss callback stays behaviourally stable (clears the toast).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message]);

  return (
    <div
      role="status"
      aria-live="polite"
      className="elev-pop fixed bottom-6 left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-line bg-surface px-4 py-2 text-sm text-ink"
    >
      <span>{message}</span>
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="font-medium text-speak hover:underline"
        >
          {actionLabel}
        </button>
      )}
      <button onClick={onDismiss} aria-label="Dismiss notification" className="text-ink3 hover:text-ink">
        ✕
      </button>
    </div>
  );
}
