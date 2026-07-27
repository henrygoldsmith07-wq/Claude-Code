'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { KnowledgeItem } from '@/types';

interface ProductivityScoreProps {
  reflections: KnowledgeItem[];
}

export default function ProductivityScore({ reflections }: ProductivityScoreProps) {
  // Mock data if no real reflections exist
  const latestReflection = reflections[0];
  let score = 85;
  let productivity = 90;
  let rest = 75;

  if (latestReflection && latestReflection.metadata) {
    score = latestReflection.metadata.score || score;
    productivity = latestReflection.metadata.productivity || productivity;
    rest = latestReflection.metadata.rest || rest;
  }

  return (
    <Card className="bg-surface border-line text-ink">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Daily Score</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex flex-col items-center justify-center py-2">
          <div className="relative w-32 h-32">
            <svg className="w-full h-full" viewBox="0 0 36 36">
              <path
                className="text-ink stroke-current"
                strokeWidth="3"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className="text-speak stroke-current"
                strokeWidth="3"
                strokeDasharray={`${score}, 100`}
                strokeLinecap="round"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-bold">{score}</span>
              <span className="text-[10px] text-ink3 uppercase">Productivity</span>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Focus & Output</span>
              <span>{productivity}%</span>
            </div>
            <div className="w-full bg-surface rounded-full h-1.5">
              <div className="bg-success h-1.5 rounded-full" style={{ width: `${productivity}%` }}></div>
            </div>
          </div>
          <div>
            <div className="flex justify-between text-xs mb-1">
              <span>Rest & Recovery</span>
              <span>{rest}%</span>
            </div>
            <div className="w-full bg-surface rounded-full h-1.5">
              <div className="bg-speak h-1.5 rounded-full" style={{ width: `${rest}%` }}></div>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t border-line">
          <p className="text-xs text-ink3 mb-2 text-center">Trend (Last 7 Days)</p>
          <div className="flex justify-between items-end h-12 gap-1 px-2">
            {[65, 72, 85, 78, 92, 88, 85].map((s, i) => (
              <div 
                key={i} 
                className="bg-speak/30 w-full rounded-t-sm"
                style={{ height: `${s}%` }}
              ></div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
