"use client";

import { useEffect } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/navigation";
import { usePathname } from "next/navigation";
import { useStore } from "@/state/store";

// ---------------------------------------------------------------------------
// Applies the user's theme and reduced-motion preferences to the document, and
// routes a first-time user into onboarding.
//
// The redirect lives here rather than in middleware because the answer depends
// on IndexedDB, which only exists on the client. A server that decided this
// would need to know whether someone had onboarded — which would mean sending
// it that fact, for no benefit.
// ---------------------------------------------------------------------------

export function ThemeShell({ children }: { children: ReactNode }) {
  const { preference, ready, needsOnboarding } = useStore();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    if (preference.theme === "system") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", preference.theme);
    root.setAttribute("data-reduced-motion", String(preference.reducedMotion));
  }, [preference.theme, preference.reducedMotion]);

  useEffect(() => {
    if (!ready) return;
    if (needsOnboarding && pathname !== "/onboarding") router.replace("/onboarding");
  }, [ready, needsOnboarding, pathname, router]);

  return <>{children}</>;
}
