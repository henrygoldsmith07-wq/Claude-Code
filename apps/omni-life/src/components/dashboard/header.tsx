'use client';

import React from 'react';
import Link from 'next/link';
import Button from '@/components/ui/button';

interface HeaderProps {
  user?: any;
  onLogout?: () => void;
}

export default function Header({ user, onLogout }: HeaderProps) {
  return (
    <header className="bg-surface shadow-sm border-b border-line">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="text-2xl font-bold text-speak">
            Omni-Life
          </Link>
        </div>
        
        <nav className="hidden md:flex space-x-8">
          <Link href="/" className="text-ink2 hover:text-speak transition-colors">
            Dashboard
          </Link>
          <Link href="/settings" className="text-ink2 hover:text-speak transition-colors">
            Settings
          </Link>
        </nav>

        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <span className="text-sm text-ink2">{user.email}</span>
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
