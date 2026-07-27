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
  const [user, setUser] = useState<any>(null);
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
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }
        setUser(user);

        // Fetch user profile for WhatsApp
        const { data: profile } = await supabase
          .from('users')
          .select('whatsapp_number')
          .eq('id', user.id)
          .single();
        
        if (profile?.whatsapp_number) setWhatsappNumber(profile.whatsapp_number);

        // Fetch credentials status
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
    try {
      const supabase = createClient();
      await supabase
        .from('users')
        .update({ whatsapp_number: whatsappNumber })
        .eq('id', user.id);
      
      alert('Settings saved!');
    } catch (error) {
      console.error('Error saving settings:', error);
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
    return <div className="flex items-center justify-center min-h-screen bg-bg text-ink">Loading...</div>;
  }

  return (
    <div className="flex h-screen bg-bg text-ink">
      <Sidebar activeSection="settings" />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header user={user} onLogout={handleLogout} />
        <main className="flex-1 overflow-y-auto p-6 space-y-6">
          <h1 className="text-2xl font-bold">System Settings</h1>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Profile Settings */}
            <Card className="bg-surface border-line">
              <CardHeader>
                <CardTitle className="text-ink">Profile & Communication</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm text-ink3">WhatsApp Number</label>
                  <Input 
                    value={whatsappNumber} 
                    onChange={(e) => setWhatsappNumber(e.target.value)}
                    placeholder="+447000000000"
                    className="bg-surface border-line text-ink"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm text-ink3">Base Location (Weather/Timezone)</label>
                  <Input 
                    value={location} 
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="City, Country"
                    className="bg-surface border-line text-ink"
                  />
                </div>
                <Button 
                  onClick={handleSaveProfile} 
                  disabled={saving}
                  className="w-full bg-speak hover:bg-speak"
                >
                  {saving ? 'Saving...' : 'Save Profile Settings'}
                </Button>
              </CardContent>
            </Card>

            {/* Service Connections */}
            <Card className="bg-surface border-line">
              <CardHeader>
                <CardTitle className="text-ink">External Services</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: 'google', name: 'Google (Calendar, Tasks, Fit)', icon: 'G' },
                  { id: 'spotify', name: 'Spotify', icon: 'S' },
                  { id: 'stripe', name: 'Stripe', icon: 'T' },
                  { id: 'upwork', name: 'Upwork', icon: 'U' },
                ].map((service) => (
                  <div key={service.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-surface2 rounded flex items-center justify-center font-bold">
                        {service.icon}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{service.name}</p>
                        <p className={`text-[10px] ${connections[service.id as keyof typeof connections] ? 'text-success' : 'text-ink3'}`}>
                          {connections[service.id as keyof typeof connections] ? 'Connected' : 'Disconnected'}
                        </p>
                      </div>
                    </div>
                    <Button 
                      onClick={() => handleConnect(service.id)}
                      className={connections[service.id as keyof typeof connections] ? 'bg-surface2 text-ink' : 'bg-speak text-ink'}
                    >
                      {connections[service.id as keyof typeof connections] ? 'Reconnect' : 'Connect'}
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Automation Toggles */}
            <Card className="bg-surface border-line">
              <CardHeader>
                <CardTitle className="text-ink">Automation Loops</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { id: 'morning', name: 'Morning Alignment', desc: 'Daily briefing at 7:00 AM' },
                  { id: 'hourly', name: 'Continuous Optimization', desc: 'Conflict check every hour' },
                  { id: 'evening', name: 'Evening Reflection', desc: 'Daily summary at 10:00 PM' },
                ].map((loop) => (
                  <div key={loop.id} className="flex items-center justify-between p-3 bg-surface rounded-lg">
                    <div>
                      <p className="text-sm font-medium">{loop.name}</p>
                      <p className="text-[10px] text-ink3">{loop.desc}</p>
                    </div>
                    <div className="relative inline-flex h-6 w-11 items-center rounded-full bg-speak">
                      <span className="inline-block h-4 w-4 translate-x-6 transform rounded-full bg-surface transition" />
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
