/* global recorder */

const $ = (id) => document.getElementById(id);
const els = {
  appUrl: $("appUrl"),
  apiKey: $("apiKey"),
  saveSettings: $("saveSettings"),
  settingsCard: $("settingsCard"),
  title: $("title"),
  sources: $("sources"),
  mic: $("mic"),
  sysAudio: $("sysAudio"),
  timer: $("timer"),
  record: $("record"),
  stop: $("stop"),
  status: $("status"),
};

let state = {
  recorder: null,
  chunks: [],
  stream: null,
  audioCtx: null,
  startedAt: 0,
  timerId: null,
  mimeType: "video/webm",
};

function setStatus(msg, kind = "") {
  els.status.textContent = msg;
  els.status.className = kind;
}

function mmss(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

async function init() {
  const settings = await recorder.getSettings();
  els.appUrl.value = settings.appUrl || "http://localhost:3000";
  els.apiKey.value = settings.apiKey || "";
  if (!settings.apiKey) els.settingsCard.open = true;

  const sources = await recorder.listSources();
  els.sources.innerHTML = "";
  for (const s of sources) {
    const opt = document.createElement("option");
    opt.value = s.id;
    opt.textContent = s.name;
    els.sources.appendChild(opt);
  }
  if (sources.length === 0) setStatus("No screens found to capture.", "err");
}

els.saveSettings.addEventListener("click", async () => {
  await recorder.saveSettings({
    appUrl: els.appUrl.value.trim().replace(/\/$/, ""),
    apiKey: els.apiKey.value.trim(),
  });
  setStatus("Settings saved.", "ok");
});

/** Build a combined screen-video + (system + mic) audio stream. */
async function buildStream() {
  const sourceId = els.sources.value;
  if (!sourceId) throw new Error("Pick a screen or window to record.");

  // Screen video (+ system audio on Windows) via Chromium's desktop capturer.
  const screen = await navigator.mediaDevices.getUserMedia({
    audio: els.sysAudio.checked
      ? { mandatory: { chromeMediaSource: "desktop" } }
      : false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
        maxWidth: 1920,
        maxHeight: 1080,
        maxFrameRate: 30,
      },
    },
  });

  const videoTrack = screen.getVideoTracks()[0];
  const audioSources = [];
  const sysTrack = screen.getAudioTracks()[0];
  if (sysTrack) audioSources.push(new MediaStream([sysTrack]));

  if (els.mic.checked) {
    try {
      const mic = await navigator.mediaDevices.getUserMedia({ audio: true });
      audioSources.push(mic);
    } catch {
      setStatus("Microphone unavailable — recording system audio only.", "");
    }
  }

  // Mix all audio inputs down to a single track with the Web Audio API.
  let mixedTrack = null;
  if (audioSources.length > 0) {
    const ctx = new AudioContext();
    const dest = ctx.createMediaStreamDestination();
    for (const src of audioSources) {
      ctx.createMediaStreamSource(src).connect(dest);
    }
    state.audioCtx = ctx;
    mixedTrack = dest.stream.getAudioTracks()[0];
  }

  const tracks = [videoTrack];
  if (mixedTrack) tracks.push(mixedTrack);
  return new MediaStream(tracks);
}

function pickMimeType() {
  const candidates = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
  ];
  for (const c of candidates) {
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(c)) return c;
  }
  return "video/webm";
}

els.record.addEventListener("click", async () => {
  try {
    setStatus("Starting…");
    state.stream = await buildStream();
    state.mimeType = pickMimeType();
    state.chunks = [];
    state.recorder = new MediaRecorder(state.stream, { mimeType: state.mimeType });
    state.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) state.chunks.push(e.data);
    };
    state.recorder.onstop = onRecordingStopped;
    state.recorder.start(1000);

    state.startedAt = Date.now();
    state.timerId = setInterval(() => {
      els.timer.textContent = mmss((Date.now() - state.startedAt) / 1000);
    }, 500);

    els.record.disabled = true;
    els.stop.disabled = false;
    setStatus("Recording…");
  } catch (err) {
    setStatus(err.message || "Could not start recording.", "err");
    cleanup();
  }
});

els.stop.addEventListener("click", () => {
  if (state.recorder && state.recorder.state !== "inactive") {
    els.stop.disabled = true;
    setStatus("Finishing recording…");
    state.recorder.stop();
  }
});

function cleanup() {
  if (state.timerId) clearInterval(state.timerId);
  state.timerId = null;
  if (state.stream) state.stream.getTracks().forEach((t) => t.stop());
  if (state.audioCtx) state.audioCtx.close().catch(() => {});
  state.stream = null;
  state.audioCtx = null;
  els.record.disabled = false;
  els.stop.disabled = true;
}

async function onRecordingStopped() {
  const durationSec = Math.round((Date.now() - state.startedAt) / 1000);
  const blob = new Blob(state.chunks, { type: state.mimeType });
  cleanup();

  const appUrl = (els.appUrl.value || "http://localhost:3000").trim().replace(/\/$/, "");
  const apiKey = els.apiKey.value.trim();
  const headers = { "Content-Type": "application/json" };
  if (apiKey) headers["x-api-key"] = apiKey;

  try {
    setStatus("Creating meeting…");
    const createRes = await fetch(`${appUrl}/api/meetings`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        title: els.title.value.trim() || undefined,
        mimeType: state.mimeType,
        durationSec,
      }),
    });
    if (!createRes.ok) throw new Error(`Create failed (${createRes.status})`);
    const { meeting, upload } = await createRes.json();

    setStatus(`Uploading ${(blob.size / 1024 / 1024).toFixed(1)}MB…`);
    const putRes = await fetch(upload.url, {
      method: upload.method,
      headers: upload.headers,
      body: blob,
    });
    if (!putRes.ok) {
      throw new Error(
        `Upload failed (${putRes.status}). Check the R2 bucket CORS policy — see the README.`
      );
    }

    await fetch(`${appUrl}/api/meetings/${meeting.id}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({ status: "uploaded", durationSec }),
    });

    // Kick off transcription; the dashboard polls for completion.
    fetch(`${appUrl}/api/meetings/${meeting.id}/transcribe`, {
      method: "POST",
      headers,
    }).catch(() => {});

    const link = `${appUrl}/meeting/${meeting.id}`;
    setStatus("Uploaded. Transcribing on the server…", "ok");
    els.status.innerHTML = `Uploaded. Transcribing… <a href="${link}" target="_blank">Open in dashboard →</a>`;
  } catch (err) {
    setStatus(err.message || "Upload failed.", "err");
  }
}

init().catch((err) => setStatus(err.message || "Init failed.", "err"));
