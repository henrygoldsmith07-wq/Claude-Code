import { useCallback, useEffect, useRef, useState } from 'react';

// Audio engine: MediaRecorder + Web Audio API.
//
// Graph:  mic ──► GainNode ──► DynamicsCompressor (AGC) ──► MediaStreamDestination ──► MediaRecorder
//                                        │
//                                        └─► AnalyserNode (waveform / dB meter / VAD)
//
// Routing the recorder through the compressor means the normalized signal is
// what actually gets recorded, not just what the meter shows.

const SILENCE_MS = 3500; // VAD: auto-stop after 3.5 s of silence
const SILENCE_RMS = 0.012; // empirical noise floor for "silence"
const SPEECH_RMS = 0.03; // must cross this once before VAD arms itself

function pickMimeType() {
  if (typeof MediaRecorder === 'undefined') return '';
  const candidates = [
    'audio/webm;codecs=opus', // Chrome / Firefox
    'audio/webm',
    'audio/mp4', // Safari
    'audio/ogg;codecs=opus',
  ];
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

export default function useRecorder({ onComplete }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [peakDb, setPeakDb] = useState(-Infinity);
  const [error, setError] = useState(null);

  const mediaRef = useRef(null); // { recorder, stream, ctx, analyser, raf, ... }
  const analyserRef = useRef(null); // exposed for the waveform canvas
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const cleanup = useCallback(() => {
    const m = mediaRef.current;
    if (!m) return;
    cancelAnimationFrame(m.raf);
    clearInterval(m.timer);
    m.stream?.getTracks().forEach((t) => t.stop());
    m.ctx?.close().catch(() => {});
    mediaRef.current = null;
    analyserRef.current = null;
  }, []);

  useEffect(() => cleanup, [cleanup]);

  const stop = useCallback(() => {
    const m = mediaRef.current;
    if (m?.recorder && m.recorder.state !== 'inactive') m.recorder.stop();
  }, []);

  const start = useCallback(async () => {
    if (mediaRef.current) return;
    setError(null);
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true, // browser-level AGC where supported
          channelCount: 1,
        },
      });
    } catch (e) {
      setError(
        e.name === 'NotAllowedError'
          ? 'Microphone access denied — allow the microphone in your browser.'
          : `Microphone unavailable: ${e.message}`
      );
      return;
    }

    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const source = ctx.createMediaStreamSource(stream);
    const gain = ctx.createGain();
    gain.gain.value = 1.15;

    // Soft-knee compressor as software AGC: tames peaks, lifts quiet speech.
    const compressor = ctx.createDynamicsCompressor();
    compressor.threshold.value = -24;
    compressor.knee.value = 30;
    compressor.ratio.value = 6;
    compressor.attack.value = 0.003;
    compressor.release.value = 0.25;

    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = 0.75;

    const dest = ctx.createMediaStreamDestination();
    source.connect(gain);
    gain.connect(compressor);
    compressor.connect(analyser);
    compressor.connect(dest);

    const mimeType = pickMimeType();
    let recorder;
    try {
      recorder = new MediaRecorder(dest.stream, mimeType ? { mimeType } : undefined);
    } catch {
      // Some Safari versions reject the processed stream — fall back to raw mic.
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    }

    const chunks = [];
    const startedAt = performance.now();
    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onstop = () => {
      const durationMs = performance.now() - startedAt;
      const blob = new Blob(chunks, { type: recorder.mimeType || mimeType || 'audio/webm' });
      cleanup();
      setRecording(false);
      setPeakDb(-Infinity);
      setElapsed(0);
      if (blob.size > 1200 && durationMs > 400) {
        onCompleteRef.current?.(blob, durationMs);
      }
    };

    // VAD + dB meter loop
    const timeData = new Float32Array(analyser.fftSize);
    let speechArmed = false;
    let silenceSince = null;
    const tick = () => {
      const m = mediaRef.current;
      if (!m) return;
      analyser.getFloatTimeDomainData(timeData);
      let sumSq = 0;
      let peak = 0;
      for (let i = 0; i < timeData.length; i++) {
        const v = timeData[i];
        sumSq += v * v;
        const a = Math.abs(v);
        if (a > peak) peak = a;
      }
      const rms = Math.sqrt(sumSq / timeData.length);
      setPeakDb(peak > 0 ? Math.max(-60, 20 * Math.log10(peak)) : -60);

      if (rms > SPEECH_RMS) {
        speechArmed = true;
        silenceSince = null;
      } else if (speechArmed && rms < SILENCE_RMS) {
        silenceSince = silenceSince ?? performance.now();
        if (performance.now() - silenceSince > SILENCE_MS) {
          stop(); // VAD trip: 3.5 s of silence after speech → submit
          return;
        }
      } else {
        silenceSince = null;
      }
      m.raf = requestAnimationFrame(tick);
    };

    const timer = setInterval(
      () => setElapsed(Math.round((performance.now() - startedAt) / 1000)),
      500
    );

    mediaRef.current = { recorder, stream, ctx, analyser, raf: 0, timer };
    analyserRef.current = analyser;
    recorder.start(250);
    setRecording(true);
    mediaRef.current.raf = requestAnimationFrame(tick);

    if (navigator.vibrate) navigator.vibrate(30); // haptic: recording started
  }, [cleanup, stop]);

  const cancel = useCallback(() => {
    const m = mediaRef.current;
    if (m?.recorder) {
      m.recorder.ondataavailable = null;
      m.recorder.onstop = () => {
        cleanup();
        setRecording(false);
        setPeakDb(-Infinity);
        setElapsed(0);
      };
      if (m.recorder.state !== 'inactive') m.recorder.stop();
      else cleanup();
    }
  }, [cleanup]);

  return { recording, elapsed, peakDb, error, start, stop, cancel, analyserRef };
}
