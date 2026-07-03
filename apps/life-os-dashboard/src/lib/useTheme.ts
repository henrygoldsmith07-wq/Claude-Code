"use client";

import { useEffect, useState } from "react";

export type Theme = "light" | "dark" | "system";

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const isDark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", isDark);
}

export function useTheme() {
  const [theme, setThemeState] = useState<Theme>("system");

  // Reads localStorage on mount (client-only, so state starts at the
  // "system" default during SSR/hydration, then syncs). Same SSR-safe
  // tradeoff as useLocalStorage.
  useEffect(() => {
    const stored = window.localStorage.getItem("theme") as Theme | null;
    const initial = stored ?? "system";
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setThemeState(initial);
    applyTheme(initial);

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const listener = () => {
      if ((window.localStorage.getItem("theme") as Theme | null) === "system") {
        applyTheme("system");
      }
    };
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, []);

  function setTheme(next: Theme) {
    setThemeState(next);
    window.localStorage.setItem("theme", next);
    applyTheme(next);
  }

  return { theme, setTheme };
}
