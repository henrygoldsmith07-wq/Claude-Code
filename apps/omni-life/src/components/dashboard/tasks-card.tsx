'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Task } from '@/types';

interface TasksCardProps {
  tasks: Task[] | null | undefined;
}

export default function TasksCard({ tasks }: TasksCardProps) {
  const list = Array.isArray(tasks) ? tasks : [];
  const sortedTasks = [...list].sort((a, b) => (b.priority || 0) - (a.priority || 0));

  return (
    <Card className="border-gray-800 bg-gray-900 text-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Pending Tasks</CardTitle>
        <span className="rounded bg-gray-800 px-2 py-1 text-xs text-gray-400">{list.length}</span>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedTasks.length > 0 ? (
            sortedTasks.map((task) => (
              <div
                key={task.id}
                className="group flex items-center justify-between rounded-lg bg-gray-800/50 p-3 transition-colors hover:bg-gray-800"
              >
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    className="h-5 w-5 rounded border border-gray-600 transition-colors hover:border-blue-500"
                    aria-label={`Mark complete: ${task.title}`}
                  />
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="mt-1 flex gap-2">
                      <span className="rounded bg-blue-500/20 px-1.5 text-[10px] font-bold uppercase text-blue-400">
                        {task.source || 'Task'}
                      </span>
                      {task.priority && task.priority > 2 && (
                        <span className="rounded bg-red-500/20 px-1.5 text-[10px] font-bold uppercase text-red-400">
                          High Priority
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="text-xs text-blue-400 opacity-0 transition-opacity hover:underline group-hover:opacity-100"
                >
                  Details
                </button>
              </div>
            ))
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-gray-400">All caught up</p>
              <p className="mt-1 text-xs text-gray-600">No pending tasks right now.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
