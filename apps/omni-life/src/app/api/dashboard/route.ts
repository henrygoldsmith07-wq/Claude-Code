import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString();

    const startOfWeek = new Date(today);
    startOfWeek.setDate(today.getDate() - today.getDay());
    const startOfWeekISO = startOfWeek.toISOString();

    // Fetch health metrics
    const { data: healthMetrics } = await supabase
      .from('health_metrics')
      .select('*')
      .eq('user_id', user.id)
      .gte('timestamp', todayISO);

    // Fetch financial transactions
    const { data: financialTransactions } = await supabase
      .from('financial_transactions')
      .select('*')
      .eq('user_id', user.id)
      .gte('timestamp', startOfWeekISO);

    // Fetch calendar events
    const { data: calendarEvents } = await supabase
      .from('calendar_events')
      .select('*')
      .eq('user_id', user.id)
      .gte('start_time', todayISO)
      .order('start_time', { ascending: true });

    // Fetch tasks
    const { data: tasks } = await supabase
      .from('tasks')
      .select('*')
      .eq('user_id', user.id)
      .neq('status', 'completed')
      .order('priority', { ascending: false });

    // Fetch automation logs
    const { data: automationLogs } = await supabase
      .from('automation_logs')
      .select('*')
      .eq('user_id', user.id)
      .order('triggered_at', { ascending: false })
      .limit(10);

    // Fetch notifications
    const { data: notifications } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch media history
    const { data: mediaHistory } = await supabase
      .from('media_listening_history')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(10);

    // Fetch productivity score (from knowledge_items where type is reflection)
    const { data: reflections } = await supabase
      .from('knowledge_items')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(7);

    return NextResponse.json({
      healthMetrics: healthMetrics || [],
      financialTransactions: financialTransactions || [],
      calendarEvents: calendarEvents || [],
      tasks: tasks || [],
      automationLogs: automationLogs || [],
      notifications: notifications || [],
      mediaHistory: mediaHistory || [],
      reflections: reflections || [],
    });
  } catch (error) {
    console.error('Dashboard API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
