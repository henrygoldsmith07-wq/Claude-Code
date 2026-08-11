// Source-country diversity & local-news sourcing metrics.

import type { SourceAttribution, SourceMix } from "./storyModel";

export interface DiversityReport {
  entropy: number; // Shannon, 0..~2.6
  nonEnglishShare: number; // 0..1
  topCountries: { code: string; share: number }[];
  undercovered: string[];
  note: string;
}

const NON_ENGLISH = new Set(["FR","DE","ES","IT","JP","CN","RU","TR","KR","AR","PT","PL","NL","IN","BR","MX","EG","NG","ZA","KE","TH","VN","ID"]);

function shannon(counts: number[]): number {
  const tot = counts.reduce((a,b)=>a+b,0);
  if (tot<=1) return 0;
  let acc=0; for (const c of counts) if (c>0) { const p=c/tot; acc -= p*Math.log2(p); }
  return Math.round(acc*100)/100;
}

export function diversityReport(mix: SourceMix): DiversityReport {
  const map = new Map<string, number>();
  for (const s of mix.byCountry) map.set(s.code, s.count);
  const total = mix.total || 1;
  const nonEn = [...map.entries()].filter(([k])=> NON_ENGLISH.has(k)).reduce((n,[,c])=>n+c,0);
  const nonEnglishShare = Math.round((nonEn/total)*100)/100;
  const topCountries = [...map.entries()].sort((a,b)=>b[1]-a[1]).slice(0,6).map(([code,count])=> ({ code, share: Math.round(count/total*100)/100 }));
  const undercovered = [...map.entries()].filter(([,c])=> c===1).map(([k])=>k).slice(0,6);
  const entropy = shannon([...map.values()]);
  const note = nonEnglishShare < 0.15 ? "Low non-English share — Anglophone bias risk. Add non-English sources where available." : nonEnglishShare < 0.35 ? "Moderate multilingual coverage." : "Good multilingual spread.";
  return { entropy, nonEnglishShare, topCountries, undercovered, note };
}

export const LOCAL_SOURCING_TIPS: Record<string,string> = {
  GB: "Tip: include BBC regional + PA Media for local UK beats.",
  US: "Tip: include local Gannett/AP state wires for US coverage.",
  FR: "Tip: include AFP + francophone regional outlets for France.",
  DE: "Tip: include dpa + regional papers (SZ/FAZ) for Germany.",
};

export function localSourcingNote(code: string): string | null {
  return LOCAL_SOURCING_TIPS[code.toUpperCase()] ?? null;
}
