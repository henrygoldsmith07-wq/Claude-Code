"use client";

import { useState } from "react";
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

  // While listening, the textarea mirrors the live transcript directly
  // instead of syncing it into state via an effect.
  const displayValue = listening ? transcript : text;

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

  return (
    <div className="flex flex-col gap-2 border-t border-[var(--rule)] pt-4">
      <textarea
        value={displayValue}
        onChange={(e) => {
          setText(e.target.value);
          setUsedVoice(false);
        }}
        placeholder={placeholder ?? "Make your case…"}
        rows={3}
        disabled={disabled || listening}
        className="w-full resize-none rounded-lg border border-[var(--rule)] bg-transparent px-3 py-2 text-sm disabled:opacity-50"
      />
      <div className="flex items-center justify-between gap-2">
        {supported ? (
          <button
            type="button"
            onClick={toggleListening}
            disabled={disabled}
            className={`btn px-3 py-1.5 text-xs disabled:opacity-40 ${
              listening ? "border border-[var(--bad)] text-[var(--bad)]" : "btn-ghost"
            }`}
          >
            {listening ? "● Listening… tap to stop" : "🎙️ Speak instead"}
          </button>
        ) : (
          <span className="text-xs text-zinc-600">Voice input not supported in this browser.</span>
        )}
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
  );
}
