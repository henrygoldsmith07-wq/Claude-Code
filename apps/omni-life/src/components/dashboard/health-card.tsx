'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { HealthMetric } from '@/types';

interface HealthCardProps {
  metrics: HealthMetric[];
}

export default function HealthCard({ metrics }: HealthCardProps) {
  const steps = metrics.find(m => m.metric_type === 'steps')?.value || 0;
  const calories = metrics.find(m => m.metric_type === 'calories')?.value || 0;
  const sleep = metrics.find(m => m.metric_type === 'sleep')?.value || 0;
  const stepGoal = 10000;
  const stepProgress = Math.min((steps / stepGoal) * 100, 100);

  return (
    <Card className="bg-gray-900 border-gray-800 text-white">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Health & Fitness</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <div className="flex justify-between mb-2 text-sm">
            <span>Steps</span>
            <span>{steps.toLocaleString()} / {stepGoal.toLocaleString()}</span>
          </div>
          <div className="w-full bg-gray-800 rounded-full h-2.5">
            <div 
              className="bg-blue-500 h-2.5 rounded-full transition-all duration-500" 
              style={{ width: `${stepProgress}%` }}
            ></div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="bg-gray-800 p-3 rounded-lg">
            <p className="text-xs text-gray-400">Calories</p>
            <p className="text-xl font-bold">{calories} kcal</p>
          </div>
          <div className="bg-gray-800 p-3 rounded-lg">
            <p className="text-xs text-gray-400">Sleep</p>
            <p className="text-xl font-bold">{sleep} hrs</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-gray-400 mb-2">Weekly Activity</p>
          <div className="h-24 flex items-end justify-between gap-1">
            {[40, 70, 45, 90, 65, 80, 50].map((h, i) => (
              <div 
                key={i} 
                className="bg-blue-500/40 w-full rounded-t-sm hover:bg-blue-500 transition-colors"
                style={{ height: `${h}%` }}
              ></div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
