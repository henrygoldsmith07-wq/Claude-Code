// Lightweight geopolitical relationship graph (static, no external deps).
// Used by the country page to show related earlier events + ties.
export type RelationKind = "ally" | "trade" | "tension" | "membership";
export interface CountryRelation { code: string; label: string; kind: RelationKind; note: string; }
const RELATIONS: Record<string, CountryRelation[]> = {
  US: [
    { code: "GB", label: "United Kingdom", kind: "ally", note: "NATO / Five Eyes / AUKUS-adjacent" },
    { code: "CA", label: "Canada", kind: "ally", note: "USMCA / NATO" },
    { code: "DE", label: "Germany", kind: "trade", note: "EU / NATO coordination" },
    { code: "CN", label: "China", kind: "tension", note: "Strategic competition" },
    { code: "UA", label: "Ukraine", kind: "ally", note: "Security assistance" },
  ],
  GB: [
    { code: "US", label: "United States", kind: "ally", note: "Special relationship / NATO" },
    { code: "FR", label: "France", kind: "ally", note: "NATO / EU proximity" },
    { code: "DE", label: "Germany", kind: "trade", note: "Major trading partner" },
  ],
  CN: [
    { code: "US", label: "United States", kind: "tension", note: "Strategic competition" },
    { code: "RU", label: "Russia", kind: "ally", note: "Strategic alignment" },
    { code: "TW", label: "Taiwan", kind: "tension", note: "Cross-strait status" },
  ],
  RU: [
    { code: "UA", label: "Ukraine", kind: "tension", note: "Active conflict" },
    { code: "BY", label: "Belarus", kind: "ally", note: "Close alignment" },
    { code: "CN", label: "China", kind: "ally", note: "Strategic alignment" },
  ],
  FR: [
    { code: "DE", label: "Germany", kind: "ally", note: "Franco-German axis / EU" },
    { code: "GB", label: "United Kingdom", kind: "trade", note: "Post-Brexit ties" },
  ],
  DE: [
    { code: "FR", label: "France", kind: "ally", note: "Franco-German axis" },
    { code: "PL", label: "Poland", kind: "ally", note: "EU / NATO" },
  ],
};
export function relationsFor(code: string): CountryRelation[] {
  return RELATIONS[code.toUpperCase()] ?? [];
}
