/** Performance benchmark harness (web-safe, deterministic). */
export interface PerfSample { op: string; ms: number; bytes?: number }

export function benchSync<T>(op: string, fn: ()=>T): { result: T; sample: PerfSample } {
  const t0 = Date.now();
  const result = fn();
  return { result, sample: { op, ms: Date.now()-t0 } };
}

export async function benchAsync<T>(op: string, fn: ()=>Promise<T>): Promise<{ result: T; sample: PerfSample }> {
  const t0 = Date.now();
  const result = await fn();
  return { result, sample: { op, ms: Date.now()-t0 } };
}

export function summarizePerf(samples: PerfSample[]): { op: string; p50: number; p95: number; count: number }[] {
  const byOp = new Map<string, number[]>();
  for (const s of samples) { const arr = byOp.get(s.op) ?? []; arr.push(s.ms); byOp.set(s.op, arr); }
  return Array.from(byOp.entries()).map(([op, arr])=>{
    arr.sort((a,b)=>a-b);
    const p50 = arr[Math.floor(arr.length*0.5)] ?? 0;
    const p95 = arr[Math.min(arr.length-1, Math.floor(arr.length*0.95))] ?? 0;
    return { op, p50, p95, count: arr.length };
  });
}
