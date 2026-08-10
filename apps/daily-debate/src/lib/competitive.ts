// Competitive play: Elo gated behind judge reliability.
// Until judge invariance is proven, Elo is not shown and not used for matchmaking.

export interface EloGate { reliable: boolean; reason?: string; }
export function eloGate({ invarianceOk, humanAgreement }: { invarianceOk: boolean; humanAgreement: number }): EloGate {
  if (!invarianceOk) return { reliable: false, reason: "Judge invariance not yet proven — ranked play paused." };
  if (humanAgreement < 0.7) return { reliable: false, reason: `Human agreement ${(humanAgreement*100).toFixed(0)}% below 70% threshold.` };
  return { reliable: true };
}

export function provisionalRating(games=0): number { return 1200; }
export function kFactor(games: number): number { return games < 10 ? 40 : games < 30 ? 24 : 16; }
export function expectedScore(rA: number, rB: number): number { return 1 / (1 + Math.pow(10, (rB - rA)/400)); }
export function eloDelta(rA: number, rB: number, outcome: 0|0.5|1, gamesA: number): number { return Math.round(kFactor(gamesA) * (outcome - expectedScore(rA, rB))); }

// Matchmaking: FIFO now; with Elo gate it becomes skill-bucketed. This helper picks opponent.
export function pickOpponent(queue: Array<{ userId: string; rating: number }>, seekerRating: number, gate: EloGate): string | null {
  if (!gate.reliable) return queue[0]?.userId ?? null; // FIFO
  // Bucket: prefer within 150 Elo
  const sorted = [...queue].sort((a,b)=> Math.abs(a.rating - seekerRating) - Math.abs(b.rating - seekerRating));
  return sorted[0]?.userId ?? null;
}
