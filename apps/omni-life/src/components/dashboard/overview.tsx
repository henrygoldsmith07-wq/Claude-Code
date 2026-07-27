'use client';

import React, { useEffect, useState } from 'react';
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

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch('/api/dashboard');
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error('Error fetching dashboard data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-speak"></div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 pb-8">
      {/* Productivity Score - Hero Position */}
      <div className="lg:col-span-1">
        <ProductivityScore reflections={data.reflections} />
      </div>

      {/* Health Metrics */}
      <div className="lg:col-span-1">
        <HealthCard metrics={data.healthMetrics} />
      </div>

      {/* Financial Summary */}
      <div className="lg:col-span-1">
        <FinanceCard transactions={data.financialTransactions} />
      </div>

      {/* Schedule */}
      <div className="lg:col-span-1">
        <CalendarCard events={data.calendarEvents} />
      </div>

      {/* Tasks */}
      <div className="lg:col-span-2">
        <TasksCard tasks={data.tasks} />
      </div>

      {/* Media */}
      <div className="lg:col-span-1">
        <MediaCard history={data.mediaHistory} />
      </div>

      {/* Automation */}
      <div className="lg:col-span-1">
        <AutomationCard logs={data.automationLogs} />
      </div>

      {/* Recent Notifications Card (Integrated into layout or as separate) */}
      <div className="lg:col-span-full mt-4">
        <div className="bg-surface border border-line rounded-xl p-6">
          <h3 className="text-lg font-semibold text-onaccent mb-4">Recent Notifications</h3>
          <div className="space-y-3">
            {data.notifications.length > 0 ? (
              data.notifications.map((n: any) => (
                <div key={n.id} className="flex items-center justify-between py-2 border-b border-line last:border-0">
                  <p className="text-sm text-ink3">{n.message}</p>
                  <span className="text-[10px] text-ink3">{new Date(n.created_at).toLocaleTimeString()}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink3 italic">No new notifications</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
