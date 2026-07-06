"use client";

import { coinsForXp, THEME_OPTIONS } from "@/lib/shop";

interface Props {
  xp: number;
  accent: string;
  unlockedThemes: string[];
  onChange: (accent: string, unlockedThemes: string[]) => void;
}

export default function ShopPanel({ xp, accent, unlockedThemes, onChange }: Props) {
  const coins = coinsForXp(xp);
  const spent = THEME_OPTIONS.filter((t) => unlockedThemes.includes(t.id)).reduce(
    (sum, t) => sum + t.cost,
    0,
  );
  const available = coins - spent;
  const selectedThemeId = THEME_OPTIONS.find((t) => t.accent === accent)?.id;

  function selectTheme(id: string) {
    const theme = THEME_OPTIONS.find((t) => t.id === id);
    if (theme) onChange(theme.accent, unlockedThemes);
  }

  function unlockTheme(id: string, cost: number) {
    if (available < cost) return;
    const theme = THEME_OPTIONS.find((t) => t.id === id);
    if (theme) onChange(theme.accent, [...unlockedThemes, id]);
  }

  return (
    <div className="flex w-full flex-col gap-3 rounded-xl border border-zinc-300 bg-white p-4 dark:border-zinc-700 dark:bg-zinc-900">
      <p className="text-sm font-medium">🪙 {available} coins available</p>
      <p className="text-xs text-zinc-500 dark:text-zinc-400">
        Coins are earned automatically as you study (1 coin per 10 XP). Spend them to unlock accent
        themes.
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {THEME_OPTIONS.map((theme) => {
          const isUnlocked = unlockedThemes.includes(theme.id);
          const isSelected = theme.id === selectedThemeId;
          return (
            <button
              key={theme.id}
              onClick={() => (isUnlocked ? selectTheme(theme.id) : unlockTheme(theme.id, theme.cost))}
              disabled={!isUnlocked && available < theme.cost}
              aria-pressed={isSelected}
              aria-label={
                isUnlocked ? `Use ${theme.name} theme` : `Unlock ${theme.name} theme for ${theme.cost} coins`
              }
              className={
                isSelected
                  ? "flex flex-col items-center gap-1 rounded-lg border-2 p-3 text-xs"
                  : "flex flex-col items-center gap-1 rounded-lg border border-zinc-300 p-3 text-xs hover:bg-zinc-100 disabled:opacity-40 dark:border-zinc-700 dark:hover:bg-zinc-800"
              }
              style={isSelected ? { borderColor: theme.accent } : undefined}
            >
              <span className="h-6 w-6 rounded-full" style={{ backgroundColor: theme.accent }} />
              {theme.name}
              {!isUnlocked && <span>{theme.cost} coins</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}
