'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Sidebar from '@/components/dashboard/sidebar';
import Header from '@/components/dashboard/header';
import Overview from '@/components/dashboard/overview';
import { createClient } from '@/lib/supabase/client';

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [now, setNow] = useState<Date | null>(null);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          router.push('/login');
        } else {
          setUser(user);
        }
      } catch (error) {
        console.error('Auth check error:', error);
        router.push('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  useEffect(() => {
    setNow(new Date());
    const t = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(t);
  }, []);

  const handleLogout = async () => {
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
          <p className="text-sm text-gray-500">Loading command center…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="flex h-screen bg-black text-white">
      <Sidebar
        activeSection="overview"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          user={user}
          onLogout={handleLogout}
          onMenuClick={() => setMenuOpen(true)}
        />
        <main className="flex-1 overflow-y-auto p-4 sm:p-6">
          <div className="mx-auto max-w-7xl space-y-6">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Command Center</h1>
                <p className="mt-1 text-gray-500">Real-time status of your autonomous life.</p>
              </div>
              <div className="hidden text-right sm:block">
                <p className="text-sm font-medium text-gray-400">
                  {now
                    ? now.toLocaleDateString('en-GB', {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })
                    : '—'}
                </p>
                <p className="text-xs uppercase tracking-widest text-gray-600">System Version 4.0.0</p>
              </div>
            </div>

            <Overview />
          </div>
        </main>
      </div>
    </div>
  );
}
