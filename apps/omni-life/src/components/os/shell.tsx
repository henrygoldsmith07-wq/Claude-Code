import React from 'react';
import Link from 'next/link';

export interface Crumb {
  name: string;
  href?: string;
}

/** Shared chrome for OS mini-app pages, matching the /os tree styling. */
export default function OsShell({
  crumbs,
  icon,
  title,
  tagline,
  children,
}: {
  crumbs: Crumb[];
  icon: string;
  title: string;
  tagline: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-black text-white">
      <main className="max-w-6xl mx-auto p-6 space-y-8">
        <nav className="flex items-center flex-wrap gap-1 text-sm text-gray-500">
          <Link href="/" className="hover:text-gray-300">Omni-Life</Link>
          {crumbs.map((crumb, i) => (
            <React.Fragment key={i}>
              <span className="text-gray-700">/</span>
              {crumb.href ? (
                <Link href={crumb.href} className="hover:text-gray-300">{crumb.name}</Link>
              ) : (
                <span className="text-gray-300">{crumb.name}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
        <header className="flex items-center gap-4">
          <span className="text-5xl">{icon}</span>
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{title}</h1>
            <p className="text-gray-500 mt-1">{tagline}</p>
          </div>
        </header>
        {children}
      </main>
    </div>
  );
}

/* Shared dark-theme atoms for the mini-app forms and panels */
export const panelCls = 'bg-gray-950 border border-gray-800 rounded-2xl p-5';
export const inputCls =
  'bg-gray-900 border border-gray-800 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-blue-500/50';
export const btnCls =
  'bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-lg px-4 py-2 text-sm font-medium hover:bg-blue-600/20 transition-colors';
export const dangerBtnCls =
  'text-gray-600 hover:text-red-400 text-xs transition-colors';
