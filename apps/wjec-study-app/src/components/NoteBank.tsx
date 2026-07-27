"use client";

import { useRef, useState } from "react";
import { useNotes } from "@/lib/useNotes";
import type { Note } from "@/lib/types";
import SketchPad from "./SketchPad";

interface Props {
  apiKey: string;
  initialNotes: Note[];
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export default function NoteBank({ apiKey, initialNotes }: Props) {
  const { notes, addNote, deleteNote } = useNotes(initialNotes);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [tagsInput, setTagsInput] = useState("");
  const [sketchDataUrl, setSketchDataUrl] = useState<string | null>(null);
  const [audioDataUrl, setAudioDataUrl] = useState<string | null>(null);
  const [showSketch, setShowSketch] = useState(false);
  const [recording, setRecording] = useState(false);
  const [ocrBusy, setOcrBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const photoInputRef = useRef<HTMLInputElement>(null);

  async function handleRecord() {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => chunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        setAudioDataUrl(await blobToDataUrl(blob));
        stream.getTracks().forEach((t) => t.stop());
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      setRecording(true);
    } catch {
      setError("Microphone access was denied or is unavailable.");
    }
  }

  async function handleScanPhoto(file: File) {
    setError(null);
    setOcrBusy(true);
    try {
      const dataUrl = await blobToDataUrl(file);
      const [, base64] = dataUrl.split(",");
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          imageBase64: base64,
          mediaType: file.type || "image/jpeg",
          apiKey: apiKey || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to scan photo");
      setBody((prev) => (prev ? `${prev}\n\n${data.text}` : data.text));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to scan photo");
    } finally {
      setOcrBusy(false);
    }
  }

  function handleSave() {
    if (!title.trim() && !body.trim() && !sketchDataUrl && !audioDataUrl) return;
    addNote({
      title: title.trim() || "Untitled note",
      body,
      sketchDataUrl,
      audioDataUrl,
      tags: tagsInput
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      subjectId: null,
      topicId: null,
    });
    setTitle("");
    setBody("");
    setTagsInput("");
    setSketchDataUrl(null);
    setAudioDataUrl(null);
    setShowSketch(false);
  }

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Note title"
          className="rounded-lg border border-line px-3 py-2 text-sm"
        />
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Type your notes…"
          className="rounded-lg border border-line p-2 text-sm"
        />
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="Tags (comma separated)"
          className="rounded-lg border border-line px-3 py-2 text-sm"
        />

        {error && <p className="text-sm text-danger">{error}</p>}

        <div className="flex flex-wrap gap-2 text-xs">
          <button
            onClick={() => setShowSketch((s) => !s)}
            className="rounded-full border border-line px-3 py-1"
          >
            {showSketch ? "Hide sketch" : sketchDataUrl ? "Edit sketch" : "+ Sketch"}
          </button>
          <button
            onClick={handleRecord}
            className="rounded-full border border-line px-3 py-1"
          >
            {recording ? "Stop recording" : audioDataUrl ? "Re-record audio" : "🎙 Record audio"}
          </button>
          <button
            onClick={() => photoInputRef.current?.click()}
            disabled={ocrBusy}
            className="rounded-full border border-line px-3 py-1 disabled:opacity-50"
          >
            {ocrBusy ? "Scanning…" : "📷 Scan photo"}
          </button>
          <input
            ref={photoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleScanPhoto(file);
              e.target.value = "";
            }}
          />
        </div>

        {showSketch && (
          <SketchPad
            onSave={(dataUrl) => {
              setSketchDataUrl(dataUrl);
              setShowSketch(false);
            }}
            onCancel={() => setShowSketch(false)}
          />
        )}
        {!showSketch && sketchDataUrl && (
          // eslint-disable-next-line @next/next/no-img-element -- local canvas data: URL, not an optimizable remote asset
          <img src={sketchDataUrl} alt="Sketch preview" className="max-h-40 rounded-lg border border-line" />
        )}
        {audioDataUrl && <audio controls src={audioDataUrl} className="w-full" />}

        <button
          onClick={handleSave}
          className="self-start rounded-full bg-surface px-4 py-1.5 text-sm text-onaccent dark:bg-surface"
        >
          Save note
        </button>
      </div>

      <div className="flex flex-col gap-2">
        {notes.map((note) => (
          <div
            key={note.id}
            className="flex flex-col gap-2 rounded-xl border border-line bg-surface p-4 text-sm"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="font-medium">{note.title}</p>
              <button onClick={() => deleteNote(note.id)} className="text-xs text-ink3 hover:text-danger">
                Delete
              </button>
            </div>
            {note.body && <p className="whitespace-pre-wrap text-ink2">{note.body}</p>}
            {note.sketchDataUrl && (
              // eslint-disable-next-line @next/next/no-img-element -- local canvas data: URL, not an optimizable remote asset
              <img src={note.sketchDataUrl} alt="Sketch" className="max-h-40 rounded-lg border border-line" />
            )}
            {note.audioDataUrl && <audio controls src={note.audioDataUrl} className="w-full" />}
            {note.tags.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {note.tags.map((tag) => (
                  <span key={tag} className="rounded-full bg-surface2 px-2 py-0.5 text-xs">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
