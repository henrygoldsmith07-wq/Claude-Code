/** Electron auto-update + cross-platform notes + mic/device testing helpers (web-safe). */
export function updateCheckUrl(currentVersion: string): string { return `/api/updates?version=${encodeURIComponent(currentVersion)}`; }
export function platformAudioNote(platform: string): string {
  if (platform === "darwin") return "macOS: install BlackHole for system audio loopback — otherwise mic only.";
  return "Windows: system audio via Chromium loopback — no extra setup.";
}
export async function testMicrophone(): Promise<{ ok: boolean; reason?: string }> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices) return { ok: false, reason: "no mediaDevices" };
  try { const s = await navigator.mediaDevices.getUserMedia({ audio: true }); s.getTracks().forEach(t=>t.stop()); return { ok: true }; }
  catch (e) { return { ok: false, reason: e instanceof Error ? e.message : String(e) }; }
}
