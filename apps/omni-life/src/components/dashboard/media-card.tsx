'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { MediaListeningHistory } from '@/types';

interface MediaCardProps {
  history: MediaListeningHistory[];
}

export default function MediaCard({ history }: MediaCardProps) {
  const spotifyTracks = history.filter(h => h.source === 'spotify');
  const pocketCasts = history.filter(h => h.source === 'pocket-casts');
  
  const currentlyPlaying = spotifyTracks[0];

  return (
    <Card className="bg-surface border-line text-onaccent">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Media & Listening</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {currentlyPlaying && (
          <div>
            <p className="text-xs text-ink3 mb-2 uppercase font-bold tracking-tighter">Recently Played on Spotify</p>
            <div className="flex items-center gap-3 bg-success/10 p-3 rounded-lg border border-success/20">
              <div className="w-12 h-12 bg-surface rounded flex items-center justify-center text-success">
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.491 17.293c-.215.352-.674.464-1.026.249-2.857-1.745-6.453-2.14-10.688-1.171-.403.093-.807-.16-.9-.563-.093-.403.16-.807.563-.9 4.636-1.06 8.604-.613 11.802 1.34.352.215.464.674.249 1.026zm1.465-3.264c-.271.44-.846.582-1.286.311-3.27-2.01-8.254-2.592-12.12-1.417-.496.151-1.022-.128-1.173-.624-.151-.496.128-1.022.624-1.173 4.417-1.34 9.904-.688 13.644 1.612.44.271.582.846.311 1.286zm.135-3.39c-3.924-2.33-10.392-2.546-14.167-1.4c-.602.183-1.238-.166-1.421-.768-.183-.602.166-1.238.768-1.421 4.335-1.317 11.486-1.066 16.002 1.613.541.321.718 1.018.397 1.559-.32.541-1.017.718-1.558.398z"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-bold truncate max-w-[180px]">{currentlyPlaying.title}</p>
                <p className="text-xs text-ink3">{currentlyPlaying.artist_podcast}</p>
              </div>
            </div>
          </div>
        )}

        <div>
          <p className="text-xs text-ink3 mb-3 uppercase font-bold tracking-tighter">Recent Podcasts</p>
          <div className="space-y-2">
            {pocketCasts.length > 0 ? (
              pocketCasts.slice(0, 3).map((pod) => (
                <div key={pod.id} className="text-xs flex justify-between items-center bg-surface/50 p-2 rounded">
                  <div className="truncate max-w-[200px]">
                    <span className="font-medium">{pod.title}</span>
                    <span className="text-ink3 mx-1">•</span>
                    <span className="text-ink3">{pod.artist_podcast}</span>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-xs text-ink3 italic">No recent podcasts found</p>
            )}
          </div>
        </div>

        <div className="pt-2 border-t border-line flex justify-between text-xs text-ink3">
          <span>Listening Time Today</span>
          <span className="font-bold text-onaccent">2h 15m</span>
        </div>
      </CardContent>
    </Card>
  );
}
