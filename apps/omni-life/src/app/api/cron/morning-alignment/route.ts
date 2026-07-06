import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchPriorityEmails, getTodayEvents } from '@/lib/services/google-workspace';
import { getUrgentItems } from '@/lib/services/upwork';
import { getDailySteps, getActiveCalories, getSleepDuration } from '@/lib/services/google-fit';
import { getLatestWorkout } from '@/lib/services/hevy';
import { routeToLLM } from '@/lib/llm/router';
import { sendWhatsAppMessage } from '@/lib/services/twilio';
import { decrypt } from '@/lib/encryption';

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

      const googleCred = credentials?.find((c: { service_name: string }) => c.service_name === 'google');
      const upworkCred = credentials?.find((c: { service_name: string }) => c.service_name === 'upwork');

      let context = '';

      if (googleCred) {
        const tokens = JSON.parse(decrypt(googleCred.encrypted_token as string));
        const emails = await fetchPriorityEmails(tokens.access_token);
        const events = await getTodayEvents(tokens.access_token);
        
        // Fetch health stats from yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const steps = await getDailySteps(tokens.access_token, yesterday);
        const calories = await getActiveCalories(tokens.access_token, yesterday);
        const sleep = await getSleepDuration(tokens.access_token, yesterday);
        
        context += `Gmail Priority: ${JSON.stringify(emails)}\nGoogle Events: ${JSON.stringify(events)}\n`;
        context += `Yesterday's Health: ${steps} steps, ${calories} calories burned, ${sleep}h sleep\n`;
      }

      if (upworkCred) {
        const items = await getUrgentItems();
        context += `Upwork Urgent: ${JSON.stringify(items)}\n`;
      }

      // Latest Hevy Workout
      const latestWorkout = await getLatestWorkout();
      if (latestWorkout) {
        context += `Latest Workout: ${latestWorkout.name} on ${new Date(latestWorkout.start_time).toLocaleDateString()} (${latestWorkout.duration_seconds / 60} mins)\n`;
      }

      // Use Gemini for context scanning
      const analysis = await routeToLLM('context_scanning', `Analyze this morning's context and identify key priorities and potential conflicts, including health performance:\n${context}`, user.id);
      
      // Use ChatGPT for formatting the briefing
      const briefing = await routeToLLM('execution', `Format this analysis into a concise, professional WhatsApp morning briefing. Include a health summary section:\n${analysis.response}`, user.id);

      if (user.whatsapp_number) {
        await sendWhatsAppMessage(user.whatsapp_number, briefing.response);
      }
    } catch (error) {
      console.error(`Failed for user ${user.id}:`, error);
    }
  }

  return NextResponse.json({ status: 'ok' });
}
