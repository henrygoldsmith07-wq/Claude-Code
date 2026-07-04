"use client";

// Procedurally synthesized ambient sound via the Web Audio API — there are no
// licensed music/audio assets bundled here, so this approximates white/brown
// noise and a filtered "rain-like" texture rather than real lo-fi music.
export type AmbientSound = "off" | "white" | "brown" | "rain";

let ctx: AudioContext | null = null;
let source: AudioBufferSourceNode | null = null;
let gain: GainNode | null = null;

function getContext(): AudioContext {
  if (!ctx) ctx = new AudioContext();
  return ctx;
}

function makeNoiseBuffer(context: AudioContext, brown: boolean): AudioBuffer {
  const length = context.sampleRate * 2;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const data = buffer.getChannelData(0);
  let lastOut = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (!brown) {
      data[i] = white;
    } else {
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = lastOut * 3.5;
    }
  }
  return buffer;
}

export function playAmbientSound(kind: AmbientSound) {
  stopAmbientSound();
  if (kind === "off") return;

  const context = getContext();
  const buffer = makeNoiseBuffer(context, kind !== "white");
  source = context.createBufferSource();
  source.buffer = buffer;
  source.loop = true;

  const filter = context.createBiquadFilter();
  filter.type = kind === "rain" ? "highpass" : "lowpass";
  filter.frequency.value = kind === "rain" ? 1200 : kind === "brown" ? 400 : 8000;

  gain = context.createGain();
  gain.gain.value = 0.15;

  source.connect(filter);
  filter.connect(gain);
  gain.connect(context.destination);
  source.start();
}

export function stopAmbientSound() {
  source?.stop();
  source = null;
}

export function setAmbientVolume(volume: number) {
  if (gain) gain.gain.value = volume;
}
