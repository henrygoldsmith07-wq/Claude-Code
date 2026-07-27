'use client';

import React from 'react';
import Link from 'next/link';

interface SidebarProps {
  activeSection?: string;
}

export default function Sidebar({ activeSection }: SidebarProps) {
  const sections = [
    { id: 'overview', label: 'Overview', href: '/' },
    { id: 'health', label: 'Health', href: '/#health' },
    { id: 'finance', label: 'Finances', href: '/#finance' },
    { id: 'calendar', label: 'Calendar', href: '/#calendar' },
    { id: 'tasks', label: 'Tasks', href: '/#tasks' },
    { id: 'media', label: 'Media', href: '/#media' },
    { id: 'settings', label: 'Settings', href: '/settings' },
  ];

  return (
    <aside className="w-64 bg-bg border-r border-line p-6 hidden md:block">
      <div className="mb-8 px-4">
        <h2 className="text-xl font-bold text-speak">Omni-Life</h2>
        <p className="text-[10px] text-ink3 uppercase tracking-widest">OS Phase 4</p>
      </div>
      <nav className="space-y-1">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={section.href}
            className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
              activeSection === section.id
                ? 'bg-speak/10 text-speak border border-speak/20'
                : 'text-ink3 hover:bg-surface hover:text-ink'
            }`}
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-8 px-4">
        <div className="bg-surface/50 p-4 rounded-2xl border border-line">
          <p className="text-xs text-ink3 mb-1">Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-success rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-ink3">System Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
