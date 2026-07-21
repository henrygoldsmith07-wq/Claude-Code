"use client";

import { useState, useRef, useEffect } from "react";
import { useSpeechRecognition } from "./useSpeechRecognition";
import type { InputMode } from "@/lib/types";

export default function MessageComposer({
  onSubmit,
  disabled,
  placeholder,
}: {
  onSubmit: (message: string, inputMode: InputMode) => void;
  disabled: boolean;
  placeholder?: string;
}) {
  const [text, setText] = useState("");
  const [usedVoice, setUsedVoice] = useState(false);
  const { supported, listening, transcript, start, stop } = useSpeechRecognition();
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // While listening, the textarea mirrors the live transcript directly
  // instead of syncing it into state via an effect.
  const displayValue = listening ? transcript : text;

  useEffect(() => {
    if (!disabled && !listening) {
      textareaRef.current?.focus();
    }
  }, [disabled, listening]);

  function toggleListening() {
    if (listening) {
      setText(transcript);
      stop();
    } else {
      setUsedVoice(true);
      start();
    }
  }

  function submit() {
    const trimmed = displayValue.trim();
    if (!trimmed || disabled) return;
    onSubmit(trimmed, usedVoice ? "voice" : "text");
    setText("");
    setUsedVoice(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--rule)] pt-4">
      <textarea
        ref={textareaRef}
        value={displayValue}
        onChange={(e) => {
          setText(e.target.value);
          setUsedVoice(false);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder ?? "Make your case… (Ctrl/⌘+Enter to send)"}
        rows={3}
        disabled={disabled || listening}
        aria-label="Your debate response"
        className="w-full resize-none rounded-lg border border-[var(--rule)] bg-transparent px-3 py-2 text-sm disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2">
        {supported ? (
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled}
            aria-pressed={listening}
            className={`btn px-3 py-1.5 text-xs disabled:opacity-40 ${
              listening ? "border border-[var(--bad)] text-[var(--bad)]" : "btn-ghost"
            }`}
          >
            {listening ? "● Listening… tap to stop" : "🎙️ Speak instead"}
          </button>
        ) : (
          <span className="text-xs text-zinc-600">Voice input not supported in this browser.</span>
        )}
        <div className="flex items-center gap-3">
          <span className="text-xs text-zinc-600 tabular">
            {displayValue.trim().length > 0 ? `${displayValue.trim().length} chars` : ""}
          </span>
          <button
            type="button"
            onClick={submit}
            disabled={disabled || !displayValue.trim()}
            className="btn btn-primary px-4 py-1.5 text-sm disabled:opacity-40"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
