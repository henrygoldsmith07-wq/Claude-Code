'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { AutomationLog } from '@/types';

interface AutomationCardProps {
  logs: AutomationLog[];
}

export default function AutomationCard({ logs }: AutomationCardProps) {
  const getLatestLog = (type: string) => logs.find(l => l.loop_type === type);

  const loops = [
    { id: 'morning_alignment', name: 'Morning Alignment', schedule: '07:00' },
    { id: 'continuous_optimization', name: 'Hourly Optimization', schedule: 'Every Hour' },
    { id: 'evening_reflection', name: 'Evening Reflection', schedule: '22:00' },
  ];

  return (
    <Card className="bg-surface border-line text-ink">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Automation Status</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {loops.map((loop) => {
            const latest = getLatestLog(loop.id);
            const status = latest?.status || 'idle';
            
            return (
              <div key={loop.id} className="bg-surface/30 p-3 rounded-lg border border-line">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <p className="text-sm font-medium">{loop.name}</p>
                    <p className="text-[10px] text-ink3">{loop.schedule}</p>
                  </div>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                    status === 'success' || status === 'completed' ? 'bg-success/20 text-success' : 
                    status === 'failed' ? 'bg-danger/20 text-danger' : 'bg-surface2 text-ink3'
                  }`}>
                    {status}
                  </span>
                </div>
                <div className="flex justify-between text-xs text-ink3">
                  <span>Last run:</span>
                  <span>{latest?.completed_at ? new Date(latest.completed_at).toLocaleTimeString() : 'Never'}</span>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
