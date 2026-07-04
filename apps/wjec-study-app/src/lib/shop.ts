export function coinsForXp(xp: number): number {
  return Math.floor(xp / 10);
}

export interface ThemeOption {
  id: string;
  name: string;
  cost: number;
  accent: string;
}

export const THEME_OPTIONS: ThemeOption[] = [
  { id: "violet", name: "Violet (default)", cost: 0, accent: "#8b5cf6" },
  { id: "emerald", name: "Emerald", cost: 20, accent: "#10b981" },
  { id: "amber", name: "Amber", cost: 20, accent: "#f59e0b" },
  { id: "rose", name: "Rose", cost: 30, accent: "#f43f5e" },
  { id: "sky", name: "Sky", cost: 30, accent: "#0ea5e9" },
];
