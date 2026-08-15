"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, CalendarCheck, MessageCircle, Network, Sparkles } from "lucide-react";

// ---------------------------------------------------------------------------
// Primary navigation: five destinations, no more.
//
// On mobile it is a bottom bar with targets comfortably above the 44px minimum;
// on desktop it becomes a sidebar. Both render from the same list so they never
// drift apart, and the current page is marked with aria-current rather than
// colour alone.
// ---------------------------------------------------------------------------

const ITEMS = [
  { href: "/", label: "Today", icon: CalendarCheck },
  { href: "/practise", label: "Practise", icon: Sparkles },
  { href: "/skills", label: "Skills", icon: Network },
  { href: "/progress", label: "Progress", icon: BarChart3 },
  { href: "/coach", label: "Coach", icon: MessageCircle },
];

export function Nav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));

  return (
    <>
      {/* Desktop sidebar */}
      <nav
        aria-label="Primary"
        className="fixed inset-y-0 left-0 z-20 hidden w-56 flex-col border-r px-3 py-6 md:flex"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <Link href="/" className="mb-6 flex items-center gap-2 px-3 text-lg font-semibold tracking-tight">
          <img src="/logo.svg" alt="" width={24} height={24} className="rounded-md" aria-hidden="true" />
          Rapport
        </Link>
        <ul className="flex flex-1 flex-col gap-1">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-sm font-medium transition-colors"
                  style={{
                    background: active ? "var(--accent-soft)" : "transparent",
                    color: active ? "var(--accent)" : "var(--text-muted)",
                  }}
                >
                  <Icon size={18} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
        <Link
          href="/settings"
          aria-current={pathname.startsWith("/settings") ? "page" : undefined}
          className="rounded-[10px] px-3 py-2.5 text-sm"
          style={{ color: pathname.startsWith("/settings") ? "var(--accent)" : "var(--text-faint)" }}
        >
          Settings &amp; privacy
        </Link>
      </nav>

      {/* Mobile bottom bar */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-20 border-t md:hidden"
        style={{ background: "var(--surface)", borderColor: "var(--border)", paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <ul className="flex">
          {ITEMS.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href);
            return (
              <li key={item.href} className="flex-1">
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className="flex min-h-[56px] flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium"
                  style={{ color: active ? "var(--accent)" : "var(--text-faint)" }}
                >
                  <Icon size={20} aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
