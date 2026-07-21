'use client';

import React, { useState, useEffect } from 'react';
import Sidebar from '@/components/dashboard/sidebar';
import Header from '@/components/dashboard/header';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function SettingsPage() {
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [location, setLocation] = useState('Cardiff, UK');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [connections, setConnections] = useState({
    google: false,
    spotify: false,
    stripe: false,
    upwork: false,
  });
  const router = useRouter();

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setUser(user);

        const { data: profile } = await supabase
          .from('users')
          .select('whatsapp_number')
          .eq('id', user.id)
          .single();

        if (profile?.whatsapp_number) setWhatsappNumber(profile.whatsapp_number);

        const { data: credentials } = await supabase
          .from('user_credentials')
          .select('service_name')
          .eq('user_id', user.id);

        if (credentials) {
          const connected = {
            google: credentials.some((c: { service_name: string }) => c.service_name === 'google'),
            spotify: credentials.some((c: { service_name: string }) => c.service_name === 'spotify'),
            stripe: credentials.some((c: { service_name: string }) => c.service_name === 'stripe'),
            upwork: credentials.some((c: { service_name: string }) => c.service_name === 'upwork'),
          };
          setConnections(connected);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [router]);

  const handleSaveProfile = async () => {
    setSaving(true);
    setSaveMsg(null);
    try {
      const supabase = createClient();
      await supabase
        .from('users')
        .update({ whatsapp_number: whatsappNumber })
        .eq('id', user.id);

      setSaveMsg('Saved');
      setTimeout(() => setSaveMsg(null), 2000);
    } catch (error) {
      console.error('Error saving settings:', error);
      setSaveMsg('Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleConnect = (service: string) => {
    window.location.href = `/api/auth/${service}`;
  };

  const handleLogout = async () => {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-white">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-black text-white">
      <Sidebar
        activeSection="settings"
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <Header
          user={user}
          onLogout={handleLogout}
          onMenuClick={() => setMenuOpen(true)}
        />
        <main className="flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
          <h1 className="text-2xl font-bold">System Settings</h1>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
            <Card className="border-gray-800 bg-gray-900">
              <CardHeader>
                <CardTitle className="text-white">Profile & Communication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label htmlFor="whatsapp" className="text-sm text-gray-400">
                    WhatsApp Number
                  </label>
                  <Input
                    id="whatsapp"
                    value={whatsappNumber}
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+447000000000"
                    className="border-gray-700 bg-gray-800 text-white"
                  />
                </div>
                <div className="space-y-2">
                  <label htmlFor="location" className="text-sm text-gray-400">
                    Base Location (Weather/Timezone)
                  </label>
                  <Input
                    id="location"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, Country"
                    className="border-gray-700 bg-gray-800 text-white"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <Button
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="flex-1 bg-blue-600 hover:bg-blue-500"
                  >
                    {saving ? 'Saving…' : 'Save Profile Settings'}
                  </Button>
                  {saveMsg && (
                    <span className="text-sm text-green-400" role="status">
                      {saveMsg}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-gray-800 bg-gray-900">
              <CardHeader>
                <CardTitle className="text-white">External Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: 'google', name: 'Google (Calendar, Tasks, Fit)', icon: 'G' },
                  { id: 'spotify', name: 'Spotify', icon: 'S' },
                  { id: 'stripe', name: 'Stripe', icon: 'T' },
                  { id: 'upwork', name: 'Upwork', icon: 'U' },
                ].map((service) => {
                  const connected = connections[service.id as keyof typeof connections];
                  return (
                    <div
                      key={service.id}
                      className="flex items-center justify-between rounded-lg bg-gray-800 p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded bg-gray-700 font-bold">
                          {service.icon}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{service.name}</p>
                          <p className={`text-[10px] ${connected ? 'text-green-400' : 'text-gray-500'}`}>
                            {connected ? 'Connected' : 'Disconnected'}
                          </p>
                        </div>
                      </div>
                      <Button
                        onClick={() => handleConnect(service.id)}
                        variant={connected ? 'secondary' : 'primary'}
                        size="sm"
                      >
                        {connected ? 'Reconnect' : 'Connect'}
                      </Button>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card className="border-gray-800 bg-gray-900">
              <CardHeader>
                <CardTitle className="text-white">Automation Loops</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: 'morning', name: 'Morning Alignment', desc: 'Daily briefing at 7:00 AM' },
                  { id: 'hourly', name: 'Continuous Optimization', desc: 'Conflict check every hour' },
                  { id: 'evening', name: 'Evening Reflection', desc: 'Daily summary at 10:00 PM' },
                ].map((loop) => (
                  <div
                    key={loop.id}
                    className="flex items-center justify-between rounded-lg bg-gray-800 p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">{loop.name}</p>
                      <p className="text-[10px] text-gray-500">{loop.desc}</p>
                    </div>
                    <div
                      className="relative inline-flex h-6 w-11 items-center rounded-full bg-blue-600"
                      role="switch"
                      aria-checked="true"
                      aria-label={loop.name}
                    >
                      <span className="inline-block h-4 w-4 translate-x-6 transform rounded-full bg-white transition" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
