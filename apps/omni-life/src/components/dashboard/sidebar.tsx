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
    <aside className="w-64 bg-gray-950 border-r border-gray-800 p-6 hidden md:block">
      <div className="mb-8 px-4">
        <h2 className="text-xl font-bold text-blue-500">Omni-Life</h2>
        <p className="text-[10px] text-gray-500 uppercase tracking-widest">OS Phase 4</p>
      </div>
      <nav className="space-y-1">
        {sections.map((section) => (
          <Link
            key={section.id}
            href={section.href}
            className={`flex items-center px-4 py-3 rounded-xl transition-all duration-200 ${
              activeSection === section.id
                ? 'bg-blue-600/10 text-blue-400 border border-blue-500/20'
                : 'text-gray-400 hover:bg-gray-900 hover:text-gray-200'
            }`}
          >
            {section.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-8 px-4">
        <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-800">
          <p className="text-xs text-gray-500 mb-1">Status</p>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
            <span className="text-sm font-medium text-gray-300">System Online</span>
          </div>
        </div>
      </div>
    </aside>
  );
}
