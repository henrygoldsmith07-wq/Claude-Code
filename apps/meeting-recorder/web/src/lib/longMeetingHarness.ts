/** Long-meeting stress harness: synthetic recording + integrity checks. */
import { integrityCheck, chunkPlan } from "./recordingStore";

export function syntheticRecordingMeta(durationSec: number, mimeType = "video/webm"): { durationSec: number; mimeType: string; approxBytes: number } {
  const approxBytes = Math.ceil(durationSec * 55_000); // ~55KB/s synthetic
  return { durationSec, mimeType, approxBytes };
}

export function stressReport(durationSec: number): { durationSec: number; approxBytes: number; chunks: number; ok: boolean } {
  const { approxBytes } = syntheticRecordingMeta(durationSec);
  const { totalParts } = chunkPlan(approxBytes);
  return { durationSec, approxBytes, chunks: totalParts, ok: totalParts>0 };
}

export function longMeetingChecks(bytes: Uint8Array, mimeType: string): string[] {
  const issues: string[] = [];
  const c = integrityCheck(bytes, mimeType);
  if (!c.ok) issues.push(c.reason ?? "integrity failed");
  if (bytes.byteLength > 0 && bytes.byteLength < 1024) issues.push("too small for long meeting");
  return issues;
}
