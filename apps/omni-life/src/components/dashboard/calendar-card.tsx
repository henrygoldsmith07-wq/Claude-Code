'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { CalendarEvent } from '@/types';

interface CalendarCardProps {
  events: CalendarEvent[];
}

export default function CalendarCard({ events }: CalendarCardProps) {
  const upcomingEvents = events.slice(0, 5);
  const nextEvent = upcomingEvents[0];

  return (
    <Card className="bg-surface border-line text-onaccent">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Today's Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {nextEvent && (
          <div className="bg-speak/20 border border-speak/30 p-3 rounded-lg">
            <p className="text-xs text-speak font-semibold uppercase tracking-wider mb-1">Up Next</p>
            <p className="font-bold">{nextEvent.title}</p>
            <p className="text-sm text-ink3">
              {new Date(nextEvent.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - 
              {new Date(nextEvent.end_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}

        <div className="space-y-3">
          {upcomingEvents.length > 0 ? (
            upcomingEvents.map((event) => (
              <div key={event.id} className="flex gap-3 items-start border-l-2 border-line pl-3 py-1">
                <div className="min-w-[60px] text-xs text-ink3 pt-0.5">
                  {new Date(event.start_time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div>
                  <p className="text-sm font-medium">{event.title}</p>
                  {event.description && <p className="text-xs text-ink3 truncate">{event.description}</p>}
                </div>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink3 italic">No events scheduled for today</p>
          )}
        </div>

        <div className="pt-2 border-t border-line">
          <p className="text-xs text-ink3">Next Free Block: 14:00 - 15:30</p>
        </div>
      </CardContent>
    </Card>
  );
}
