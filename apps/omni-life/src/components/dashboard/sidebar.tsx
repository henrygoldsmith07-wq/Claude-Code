'use client';

import React from 'react';
import Link from 'next/link';

interface SidebarProps {
  activeSection?: string;
  open?: boolean;
  onClose?: () => void;
}

const sections = [
  { id: 'overview', label: 'Overview', href: '/', icon: '◈' },
  { id: 'health', label: 'Health', href: '/#health', icon: '♥' },
  { id: 'finance', label: 'Finances', href: '/#finance', icon: '£' },
  { id: 'calendar', label: 'Calendar', href: '/#calendar', icon: '◷' },
  { id: 'tasks', label: 'Tasks', href: '/#tasks', icon: '✓' },
  { id: 'media', label: 'Media', href: '/#media', icon: '♪' },
  { id: 'settings', label: 'Settings', href: '/settings', icon: '⚙' },
];

export default function Sidebar({ activeSection, open = false, onClose }: SidebarProps) {
  return (
    <>
      {/* Mobile backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 md:hidden"
          onClick={onClose}
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-800 bg-gray-950 p-6 transition-transform duration-200 md:static md:translate-x-0 ${
          open ? 'translate-x-0' : '-translate-x-full'
        }`}
        aria-label="Sidebar"
      >
        <div className="mb-8 flex items-center justify-between px-4">
          <div>
            <h2 className="text-xl font-bold text-blue-500">Omni-Life</h2>
            <p className="text-[10px] uppercase tracking-widest text-gray-500">OS Phase 4</p>
          </div>
          {onClose && (
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-800 px-2 py-1 text-sm text-gray-400 md:hidden"
              aria-label="Close menu"
            >
              ✕
            </button>
          )}
        </div>

        <nav className="flex-1 space-y-1">
          {sections.map((section) => (
            <Link
              key={section.id}
              href={section.href}
              onClick={onClose}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 transition-all duration-200 ${
                activeSection === section.id
                  ? 'border border-blue-500/20 bg-blue-600/10 text-blue-400'
                  : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
              }`}
            >
              <span className="w-4 text-center text-xs opacity-70" aria-hidden>
                {section.icon}
              </span>
              {section.label}
            </Link>
          ))}
        </nav>

        <div className="mt-auto px-4 pt-8">
          <div className="rounded-2xl border border-gray-800 bg-gray-900/50 p-4">
            <p className="mb-1 text-xs text-gray-500">Status</p>
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 animate-pulse rounded-full bg-green-500" />
              <span className="text-sm font-medium text-gray-300">System Online</span>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
