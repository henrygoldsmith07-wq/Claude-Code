'use client';

import React from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';

interface HeaderProps {
  user?: any;
  onLogout?: () => void;
  onMenuClick?: () => void;
}

export default function Header({ user, onLogout, onMenuClick }: HeaderProps) {
  return (
    <header className="border-b border-gray-800 bg-gray-950/80 backdrop-blur">
      <div className="flex items-center justify-between px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          {onMenuClick && (
            <button
              type="button"
              onClick={onMenuClick}
              className="rounded-lg border border-gray-800 px-2.5 py-1.5 text-sm text-gray-400 hover:text-white md:hidden"
              aria-label="Open menu"
            >
              ☰
            </button>
          )}
          <Link href="/" className="text-lg font-bold tracking-tight text-blue-400 sm:text-xl">
            Omni-Life
          </Link>
        </div>

        <nav className="hidden items-center gap-6 text-sm text-gray-400 md:flex" aria-label="Main">
          <Link href="/" className="hover:text-white transition-colors">
            Dashboard
          </Link>
          <Link href="/settings" className="hover:text-white transition-colors">
            Settings
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          {user ? (
            <>
              <span className="hidden max-w-[160px] truncate text-sm text-gray-400 sm:inline">
                {user.email}
              </span>
              <Button variant="secondary" size="sm" onClick={onLogout}>
                Logout
              </Button>
            </>
          ) : (
            <Link href="/login">
              <Button size="sm">Login</Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
