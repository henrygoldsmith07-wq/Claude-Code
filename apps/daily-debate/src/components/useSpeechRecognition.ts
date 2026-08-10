"use client";

import { useCallback, useRef, useState, useSyncExternalStore } from "react";

// Minimal ambient shape for the (non-standard, Chrome-only) Web Speech API
// Safari/Firefox: no SpeechRecognition — composer shows dictation + paste + keyboard path instead. —
// not part of TypeScript's DOM lib.
interface SpeechRecognitionResultLike {
  transcript: string;
}
interface SpeechRecognitionEventLike extends Event {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
}

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function getSpeechRecognitionCtor(): SpeechRecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function subscribeNoop() {
  return () => {};
}

export function useSpeechRecognition() {
  const supported = useSyncExternalStore(
    subscribeNoop,
    () => getSpeechRecognitionCtor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback(() => {
    const Ctor = getSpeechRecognitionCtor();
    if (!Ctor) return;

    const recognition = new Ctor();
    recognition.lang = "en-US";
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.onresult = (event) => {
      let combined = "";
      for (let i = 0; i < event.results.length; i += 1) {
        combined += event.results[i][0].transcript;
      }
      setTranscript(combined);
    };
    recognition.onend = () => setListening(false);
    recognition.onerror = () => setListening(false);

    recognitionRef.current = recognition;
    setTranscript("");
    setListening(true);
    recognition.start();
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setListening(false);
  }, []);

  return { supported, listening, transcript, start, stop, resetTranscript: () => setTranscript("") };
}
