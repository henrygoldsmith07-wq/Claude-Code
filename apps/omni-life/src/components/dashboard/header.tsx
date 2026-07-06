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
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link href="/" className="text-2xl font-bold text-blue-600">
            Omni-Life
          </Link>
        </div>
        
        <nav className="hidden md:flex space-x-8">
          <Link href="/" className="text-gray-700 hover:text-blue-600 transition-colors">
            Dashboard
          </Link>
          <Link href="/settings" className="text-gray-700 hover:text-blue-600 transition-colors">
            Settings
          </Link>
        </nav>

        <div className="flex items-center space-x-4">
          {user ? (
            <>
              <span className="text-sm text-gray-700">{user.email}</span>
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
