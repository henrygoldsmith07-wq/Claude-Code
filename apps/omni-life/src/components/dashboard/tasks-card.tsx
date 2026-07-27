'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Task } from '@/types';

interface TasksCardProps {
  tasks: Task[];
}

export default function TasksCard({ tasks }: TasksCardProps) {
  const sortedTasks = [...tasks].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return (
    <Card className="bg-surface border-line text-onaccent">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Pending Tasks</CardTitle>
        <span className="text-xs bg-surface px-2 py-1 rounded text-ink3">{tasks.length}</span>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedTasks.length > 0 ? (
            sortedTasks.map((task) => (
              <div key={task.id} className="group flex items-center justify-between bg-surface/50 hover:bg-surface p-3 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <button className="w-5 h-5 rounded border border-line hover:border-speak transition-colors"></button>
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] bg-speak/20 text-speak px-1.5 rounded uppercase font-bold">
                        {task.source || 'Task'}
                      </span>
                      {task.priority && task.priority > 2 && (
                        <span className="text-[10px] bg-danger/20 text-danger px-1.5 rounded uppercase font-bold">
                          High Priority
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 text-xs text-speak hover:underline transition-opacity">
                  Details
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-ink3 italic text-center py-4">All caught up!</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
