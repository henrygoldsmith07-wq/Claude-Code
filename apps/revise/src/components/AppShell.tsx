"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useStore } from "@/state/store";
import { cx } from "./ui";
import {
  CardsIcon,
  GenerateIcon,
  ICON_SIZE,
  ModesIcon,
  LibraryIcon,
  PapersIcon,
  EvidenceIcon,
  PlanIcon,
  PracticeIcon,
  ProgressIcon,
  ReviewIcon,
  SearchIcon,
  OfflineIcon,
  SettingsIcon,
  TodayIcon,
  TutorIcon,
  BenchmarkIcon,
  CaseStudyIcon,
} from "./icons";
import type { LucideIcon } from "./icons";
import { SearchOverlay } from "./SearchOverlay";
import { useShortcuts } from "./shortcuts";
import { Onboarding } from "./Onboarding";

// Navigation is verb-first: every destination is something the student does,
// not a noun they browse. "Today" is always first because the product's whole
// claim is that it knows what you should do next.
const NAV: { href: string; label: string; Icon: LucideIcon; primary?: boolean }[] = [
  { href: "/", label: "Today", Icon: TodayIcon, primary: true },
  { href: "/review", label: "Review", Icon: ReviewIcon, primary: true },
  { href: "/study", label: "Study", Icon: ModesIcon, primary: true },
  { href: "/practice", label: "Practice", Icon: PracticeIcon },
  { href: "/planner", label: "Plan", Icon: PlanIcon, primary: true },
  { href: "/progress", label: "Progress", Icon: ProgressIcon, primary: true },
  { href: "/generate", label: "From notes", Icon: GenerateIcon },
  { href: "/cards", label: "Cards", Icon: CardsIcon },
  { href: "/papers", label: "Past papers", Icon: PapersIcon },
  { href: "/library", label: "Library", Icon: LibraryIcon },
  { href: "/question-evidence", label: "Question evidence", Icon: EvidenceIcon },
  { href: "/tutor", label: "Tutor", Icon: TutorIcon },
  { href: "/benchmarks", label: "Benchmarks", Icon: BenchmarkIcon },
  { href: "/case-study", label: "Case study", Icon: CaseStudyIcon },
  { href: "/settings", label: "Settings", Icon: SettingsIcon },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { settings, dueCards, streak, syncStatus, updateSettings, needsOnboarding, completeOnboarding } = useStore();
  const [searchOpen, setSearchOpen] = useState(false);

  // Theme and accessibility preferences live on <html> so Le Studio's tokens
  // flip everything at once, including anything rendered into a portal.
  useEffect(() => {
    const root = document.documentElement;
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      const dark = settings.theme === "dark" || (settings.theme === "system" && prefersDark.matches);
      root.classList.toggle("dark", dark);
      root.dataset.theme = dark ? "dark" : "light";
    };
    apply();
    prefersDark.addEventListener("change", apply);
    return () => prefersDark.removeEventListener("change", apply);
  }, [settings.theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle("large-text", settings.accessibility.largeText);
    root.classList.toggle("dyslexia", settings.accessibility.dyslexiaFont);
    root.classList.toggle("high-contrast", settings.accessibility.highContrast);
    root.classList.toggle("reduce-motion", settings.accessibility.reduceMotion);
  }, [settings.accessibility]);

  const toggleTheme = () => {
    const dark = document.documentElement.dataset.theme === "dark";
    const next = dark ? "light" : "dark";
    void updateSettings({ theme: next });
    try {
      localStorage.setItem("revise.theme", next);
    } catch {
      /* private browsing keeps the in-app preference only */
    }
  };

  // Navigation shortcuts are global, so they are registered by the shell
  // rather than by each page — and they show up in the `?` sheet everywhere.
  useShortcuts(
    [
      { key: "k", meta: true, group: "Global", label: "Search", allowInInput: true, run: () => setSearchOpen(true) },
      { key: "g", group: "Go to", label: "Today", run: () => router.push("/") },
      { key: "r", group: "Go to", label: "Review", run: () => router.push("/review") },
      { key: "p", group: "Go to", label: "Practice", run: () => router.push("/practice") },
      { key: "m", group: "Go to", label: "Study modes", run: () => router.push("/study") },
      { key: "e", group: "Go to", label: "Cards from notes", run: () => router.push("/generate") },
      { key: "l", group: "Go to", label: "Cards", run: () => router.push("/cards") },
      { key: "t", group: "Go to", label: "Plan", run: () => router.push("/planner") },
      { key: "d", group: "Global", label: "Toggle dark mode", run: toggleTheme },
    ],
    [router, settings.theme],
  );

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  if (needsOnboarding) {
    return <Onboarding onDone={() => void completeOnboarding()} />;
  }

  return (
    <div className="min-h-dvh bg-bg">
      <a href="#main" className="skip-link">
        Skip to content
      </a>

      {/* Desktop rail — landmark + label so screen readers name it, not just "navigation" */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-56 flex-col border-r border-line bg-surface z-20" aria-label="Primary">
        <div className="px-4 py-5">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="" width={22} height={22} className="rounded-md" aria-hidden="true" />
            <p className="text-sm font-semibold tracking-tight">Revise</p>
          </div>
          <p className="text-[11px] text-ink3 mt-0.5">{settings.displayName}</p>
        </div>
        <nav className="flex-1 px-2 space-y-0.5" aria-label="Main">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cx(
                "flex items-center gap-2.5 px-2.5 py-2 rounded-[10px] text-sm transition-colors",
                isActive(item.href) ? "bg-surface2 text-ink font-semibold" : "text-ink2 hover:bg-surface2",
              )}
            >
              {/* No colour of its own: the icon inherits the link's ink so the
                  active item's icon sharpens with its label. */}
              <item.Icon size={ICON_SIZE.md} aria-hidden className="shrink-0" />
              <span className="flex-1">{item.label}</span>
              {item.href === "/review" && dueCards.length > 0 ? (
                <span className="text-[11px] font-semibold tabular-nums text-review">{dueCards.length}</span>
              ) : null}
            </Link>
          ))}
        </nav>
        <div className="p-3 space-y-2">
          <button
            onClick={() => setSearchOpen(true)}
            className="w-full field text-left text-xs text-ink3 flex items-center gap-2"
          >
            <SearchIcon size={ICON_SIZE.sm} aria-hidden />
            <span className="flex-1">Search</span>
            <kbd className="text-[10px]">⌘K</kbd>
          </button>
          <StatusStrip />
        </div>
      </aside>

      {/* Mobile top bar — banner landmark for SR rotor */}
      <header className="lg:hidden sticky top-0 z-20 bg-surface border-b border-line" role="banner">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-2">
            <img src="/logo.svg" alt="" width={22} height={22} className="rounded-md" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold tracking-tight">Revise</p>
              <p className="text-[11px] text-ink3">
                {streak.current > 0 ? `${streak.current}-day streak` : "Start your streak today"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <button onClick={() => setSearchOpen(true)} className="btn btn-ghost" aria-label="Search">
              <SearchIcon size={ICON_SIZE.lg} aria-hidden />
            </button>
            <Link href="/settings" className="btn btn-ghost" aria-label="Settings">
              <SettingsIcon size={ICON_SIZE.lg} aria-hidden />
            </Link>
          </div>
        </div>
        {!syncStatus.online ? (
          <p
            className="px-4 py-1.5 text-[11px] bg-reviewsoft text-review font-medium flex items-center gap-1.5"
            role="status"
            aria-live="polite"
          >
            <OfflineIcon size={ICON_SIZE.sm} aria-hidden className="shrink-0" />
            Offline — everything still works and will sync when you reconnect.
          </p>
        ) : null}
      </header>

      <main id="main" className="lg:pl-56 pb-24 lg:pb-10">
        <div className="mx-auto w-full max-w-5xl px-4 sm:px-6 py-5 sm:py-7 app-enter">{children}</div>
      </main>

      {/* Mobile bottom bar — duplicate Main landmark for thumb reach; same aria-label as desktop rail */}
      <nav
        className="lg:hidden fixed bottom-0 inset-x-0 z-20 bg-surface border-t border-line elev-nav pb-safe"
        aria-label="Main"
      >
        <div className="grid grid-cols-5">
          {NAV.filter((item) => item.primary).map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={isActive(item.href) ? "page" : undefined}
              className={cx(
                "flex flex-col items-center gap-0.5 py-2 text-[10px] font-medium transition-colors relative",
                isActive(item.href) ? "text-ink" : "text-ink3",
              )}
            >
              <item.Icon size={ICON_SIZE.lg} aria-hidden />
              {item.label}
              {item.href === "/review" && dueCards.length > 0 ? (
                <span className="absolute top-1 right-[22%] w-1.5 h-1.5 rounded-full bg-review" />
              ) : null}
            </Link>
          ))}
        </div>
      </nav>

      {searchOpen ? <SearchOverlay onClose={() => setSearchOpen(false)} /> : null}
    </div>
  );
}

function StatusStrip() {
  const { syncStatus, syncNow, streak } = useStore();
  return (
    <div className="text-[11px] text-ink3 space-y-1">
      <div className="flex items-center justify-between">
        <span>{streak.current > 0 ? `${streak.current}-day streak` : "No streak yet"}</span>
        <span className="tabular-nums">{streak.xp} XP</span>
      </div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className={cx("w-1.5 h-1.5 rounded-full", syncStatus.online ? "bg-success" : "bg-review")}
          />
          {syncStatus.enabled ? (syncStatus.online ? "Synced" : "Offline") : "Local only"}
        </span>
        {syncStatus.enabled ? (
          <button onClick={() => void syncNow()} className="underline hover:text-ink">
            {syncStatus.syncing ? "Syncing…" : syncStatus.pending ? `${syncStatus.pending} queued` : "Sync"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
