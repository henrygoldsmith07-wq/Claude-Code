'use client';

import React, { useCallback, useEffect, useState } from 'react';
import HealthCard from './health-card';
import FinanceCard from './finance-card';
import CalendarCard from './calendar-card';
import TasksCard from './tasks-card';
import AutomationCard from './automation-card';
import MediaCard from './media-card';
import ProductivityScore from './productivity-score';

export default function Overview() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/dashboard');
      if (!response.ok) throw new Error(`Dashboard request failed (${response.status})`);
      const result = await response.json();
      setData(result);
    } catch (err) {
      console.error('Error fetching dashboard data:', err);
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="h-40 animate-pulse rounded-xl border border-gray-800 bg-gray-900/60"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-6 text-center">
        <p className="text-sm text-red-300">{error}</p>
        <button
          type="button"
          onClick={() => fetchData(true)}
          className="mt-4 rounded-lg bg-gray-800 px-4 py-2 text-sm text-white hover:bg-gray-700"
        >
          Retry
        </button>
      </div>
    );
  }

  if (!data) return null;

  const notifications = data.notifications ?? [];

  return (
    <div className="space-y-4 pb-8">
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => fetchData(true)}
          disabled={refreshing}
          className="rounded-lg border border-gray-800 px-3 py-1.5 text-xs text-gray-400 hover:text-white disabled:opacity-50"
        >
          {refreshing ? 'Refreshing…' : 'Refresh'}
        </button>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        <div className="lg:col-span-1">
          <ProductivityScore reflections={data.reflections} />
        </div>

        <div className="lg:col-span-1" id="health">
          <HealthCard metrics={data.healthMetrics} />
        </div>

        <div className="lg:col-span-1" id="finance">
          <FinanceCard transactions={data.financialTransactions} />
        </div>

        <div className="lg:col-span-1" id="calendar">
          <CalendarCard events={data.calendarEvents} />
        </div>

        <div className="lg:col-span-2" id="tasks">
          <TasksCard tasks={data.tasks} />
        </div>

        <div className="lg:col-span-1" id="media">
          <MediaCard history={data.mediaHistory} />
        </div>

        <div className="lg:col-span-1">
          <AutomationCard logs={data.automationLogs} />
        </div>

        <div className="mt-4 lg:col-span-full">
          <div className="rounded-xl border border-gray-800 bg-gray-900 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">Recent Notifications</h3>
            <div className="space-y-3">
              {notifications.length > 0 ? (
                notifications.map((n: any) => (
                  <div
                    key={n.id}
                    className="flex items-center justify-between border-b border-gray-800 py-2 last:border-0"
                  >
                    <p className="text-sm text-gray-300">{n.message}</p>
                    <span className="text-[10px] text-gray-500">
                      {new Date(n.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-sm italic text-gray-500">No new notifications</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
