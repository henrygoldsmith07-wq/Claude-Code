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
    <Card className="bg-gray-900 border-gray-800 text-white">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg font-semibold">Pending Tasks</CardTitle>
        <span className="text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">{tasks.length}</span>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {sortedTasks.length > 0 ? (
            sortedTasks.map((task) => (
              <div key={task.id} className="group flex items-center justify-between bg-gray-800/50 hover:bg-gray-800 p-3 rounded-lg transition-colors">
                <div className="flex items-center gap-3">
                  <button className="w-5 h-5 rounded border border-gray-600 hover:border-blue-500 transition-colors"></button>
                  <div>
                    <p className="text-sm font-medium">{task.title}</p>
                    <div className="flex gap-2 mt-1">
                      <span className="text-[10px] bg-blue-500/20 text-blue-400 px-1.5 rounded uppercase font-bold">
                        {task.source || 'Task'}
                      </span>
                      {task.priority && task.priority > 2 && (
                        <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 rounded uppercase font-bold">
                          High Priority
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <button className="opacity-0 group-hover:opacity-100 text-xs text-blue-400 hover:underline transition-opacity">
                  Details
                </button>
              </div>
            ))
          ) : (
            <p className="text-sm text-gray-500 italic text-center py-4">All caught up!</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
