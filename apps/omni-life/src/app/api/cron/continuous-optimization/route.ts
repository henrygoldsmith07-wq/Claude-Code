import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchRecentMessages } from '@/lib/services/upwork';
import { getTodayEvents as getGoogleEvents } from '@/lib/services/google-workspace';
import { getDailyIncome } from '@/lib/services/stripe-service';
import { getLatestWorkout } from '@/lib/services/hevy';
import { routeToLLM } from '@/lib/llm/router';
import { sendWhatsAppMessage } from '@/lib/services/twilio';
import { decrypt } from '@/lib/encryption';
import { detectConflicts } from '@/lib/services/calendar-sync';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const { data: users } = await supabase.from('users').select('id, whatsapp_number');

  if (!users) return NextResponse.json({ status: 'no_users' });

  for (const user of users) {
    try {
      const { data: credentials } = await supabase
        .from('user_credentials')
        .select('*')
        .eq('user_id', user.id);

      const upworkCred = credentials?.find((c: { service_name: string }) => c.service_name === 'upwork');
      const googleCred = credentials?.find((c: { service_name: string }) => c.service_name === 'google');

      // 1. Check Upwork messages
      if (upworkCred) {
        const messages = await fetchRecentMessages();
        const urgentMessages = messages.filter(m => m.isUrgent);

        for (const msg of urgentMessages) {
          const draft = await routeToLLM('execution', `Draft a professional response to this Upwork message: ${msg.content}`, user.id);
          await sendWhatsAppMessage(user.whatsapp_number!, `Urgent Upwork Msg: ${msg.title}\nDraft: ${draft.response}`);
        }
      }

      // 2. Check Stripe Income & Payouts
      const dailyIncome = await getDailyIncome();
      if (dailyIncome > 0) {
        // Log to knowledge or just update stats
        console.log(`Daily income so far: ${dailyIncome}`);
      }

      // 3. Check for new Hevy workouts
      const latestWorkout = await getLatestWorkout();
      if (latestWorkout) {
        const workoutDate = new Date(latestWorkout.start_time);
        const today = new Date();
        if (workoutDate.toDateString() === today.toDateString()) {
          // Log the fitness activity for today
          await supabase.from('automation_logs').insert({
            user_id: user.id,
            loop_type: 'continuous_optimization',
            status: 'completed',
            details: { event: 'fitness_workout_logged', workout: latestWorkout.name },
            triggered_at: workoutDate.toISOString(),
            completed_at: new Date().toISOString(),
          });
        }
      }

      // 4. Calendar Conflicts
      if (googleCred) {
        const gTokens = JSON.parse(decrypt(googleCred.encrypted_token as string));
        const gEvents = await getGoogleEvents(gTokens.access_token);
        
        const conflicts = detectConflicts(gEvents.map(e => ({
          id: e.id,
          title: e.summary,
          start: e.start.dateTime || e.start.date!,
          end: e.end.dateTime || e.end.date!,
          source: 'Google',
          original: e
        })));
        
        if (conflicts.length > 0) {
          await sendWhatsAppMessage(user.whatsapp_number!, `Calendar Conflict Detected: ${conflicts.map(c => c.title).join(', ')}`);
        }
      }
    } catch (error) {
      console.error(`Optimization failed for user ${user.id}:`, error);
    }
  }

  return NextResponse.json({ status: 'ok' });
}
