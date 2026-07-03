"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTheme } from "@/lib/useTheme";

interface NavItem {
  href: string;
  label: string;
  icon: string;
}
interface NavGroup {
  label: string;
  items: NavItem[];
}

const NAV_GROUPS: NavGroup[] = [
  { label: "", items: [{ href: "/", label: "Overview", icon: "⌂" }] },
  {
    label: "Life",
    items: [
      { href: "/finance", label: "Finance", icon: "₱" },
      { href: "/habits", label: "Habits", icon: "✓" },
      { href: "/routines", label: "Routines", icon: "↻" },
      { href: "/goals", label: "Goals", icon: "⚑" },
      { href: "/relationships", label: "Relationships", icon: "♥" },
    ],
  },
  {
    label: "Body",
    items: [
      { href: "/health", label: "Health & Nutrition", icon: "⚕" },
      { href: "/sleep", label: "Sleep", icon: "☾" },
      { href: "/hormesis", label: "Hormesis", icon: "❄" },
      { href: "/meditation", label: "Meditation", icon: "۞" },
    ],
  },
  {
    label: "Mind",
    items: [
      { href: "/mental-health", label: "Mental Health", icon: "◉" },
      { href: "/self-improvement", label: "Self-Improvement", icon: "☆" },
      { href: "/study", label: "Study", icon: "✎" },
    ],
  },
  {
    label: "AI",
    items: [
      { href: "/coach", label: "AI Coach", icon: "✦" },
      { href: "/insights", label: "Insights", icon: "≡" },
    ],
  },
];

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { theme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeLabel =
    NAV_GROUPS.flatMap((g) => g.items).find((item) => item.href === pathname)?.label ?? "Life OS";

  return (
    <div className="flex min-h-screen w-full">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 shrink-0 overflow-y-auto border-r border-zinc-200 bg-zinc-50 p-4 transition-transform dark:border-zinc-800 dark:bg-zinc-950 md:static md:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="mb-6 flex items-center gap-2 px-2">
          <span className="text-xl">◈</span>
          <span className="text-lg font-semibold tracking-tight">Life OS</span>
        </div>
        <nav className="flex flex-col gap-4">
          {NAV_GROUPS.map((group) => (
            <div key={group.label || "root"} className="flex flex-col gap-0.5">
              {group.label && (
                <div className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
                  {group.label}
                </div>
              )}
              {group.items.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                      active
                        ? "bg-teal-600 text-white"
                        : "text-zinc-700 hover:bg-zinc-200 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <span className="w-4 text-center">{item.icon}</span>
                    {item.label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>
      </aside>

      {mobileOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <div className="flex min-h-screen w-full flex-col md:pl-0">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-zinc-200 bg-white/80 px-4 py-3 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
          <div className="flex items-center gap-3">
            <button
              className="rounded-md border border-zinc-300 px-2 py-1 text-sm md:hidden dark:border-zinc-700"
              onClick={() => setMobileOpen(true)}
              aria-label="Open menu"
            >
              ☰
            </button>
            <h1 className="text-base font-semibold">{activeLabel}</h1>
          </div>
          <select
            value={theme}
            onChange={(e) => setTheme(e.target.value as "light" | "dark" | "system")}
            className="rounded-md border border-zinc-300 bg-transparent px-2 py-1 text-sm dark:border-zinc-700"
          >
            <option value="system">System</option>
            <option value="light">Light</option>
            <option value="dark">Dark</option>
          </select>
        </header>
        <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
