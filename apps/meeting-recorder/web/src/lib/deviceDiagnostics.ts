/** Device / microphone diagnostics (web-safe, no Node). */
export interface DeviceInfo { deviceId: string; label: string; kind: MediaDeviceKind; }

export async function enumerateDevices(): Promise<DeviceInfo[]> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.enumerateDevices) return [];
  const list = await navigator.mediaDevices.enumerateDevices();
  return list.map((d) => ({ deviceId: d.deviceId, label: d.label || `${d.kind} ${d.deviceId.slice(0,6)}`, kind: d.kind }));
}

export async function checkMicrophone(deviceId?: string): Promise<{ ok: boolean; reason?: string; label?: string }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return { ok: false, reason: "no mediaDevices" };
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: deviceId ? { deviceId: { exact: deviceId } } : true });
    const track = stream.getAudioTracks()[0];
    const label = track?.label ?? undefined;
    stream.getTracks().forEach((t) => t.stop());
    return { ok: true, label };
  } catch (e) { return { ok: false, reason: e instanceof Error ? e.message : String(e) }; }
}

export function audioConstraints(enableNoiseSuppression = true, enableEchoCancellation = true): MediaTrackConstraints {
  return {
    noiseSuppression: enableNoiseSuppression,
    echoCancellation: enableEchoCancellation,
    autoGainControl: true,
  } as unknown as MediaTrackConstraints;
}

export function platformNote(platform: string): string {
  if (platform === "darwin") return "macOS: for system audio install BlackHole and route output through it.";
  if (platform === "linux") return "Linux: use PulseAudio loopback or PipeWire for system audio.";
  return "Windows: system audio via Chromium loopback — no extra setup needed.";
}

export async function measureLevel(stream: MediaStream, ms = 900): Promise<number> {
  if (typeof AudioContext === "undefined" && typeof (globalThis as unknown as { webkitAudioContext?: unknown }).webkitAudioContext === "undefined") return 0;
  const Ctx = (typeof AudioContext !== "undefined" ? AudioContext : (globalThis as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)!;
  const ctx = new Ctx();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  const src = ctx.createMediaStreamSource(stream);
  src.connect(analyser);
  const data = new Uint8Array(analyser.fftSize);
  let max = 0;
  const start = Date.now();
  while (Date.now() - start < ms) {
    analyser.getByteTimeDomainData(data);
    for (const v of data) { const d = Math.abs(v - 128) / 128; if (d > max) max = d; }
    await new Promise((r) => setTimeout(r, 60));
  }
  ctx.close().catch(()=>{});
  return max; // 0..1
}
