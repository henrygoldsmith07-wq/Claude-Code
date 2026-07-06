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
  { id: "ink", name: "Ink blue (default)", cost: 0, accent: "#3b4a6b" },
  { id: "sage", name: "Sage", cost: 20, accent: "#6e9a6a" },
  { id: "clay", name: "Clay", cost: 20, accent: "#c56b57" },
  { id: "amber", name: "Amber", cost: 30, accent: "#d9a94e" },
  { id: "plum", name: "Plum", cost: 30, accent: "#7c5a86" },
];
