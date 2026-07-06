import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { routeToLLM } from '@/lib/llm/router';
import { sendWhatsAppMessage } from '@/lib/services/twilio';
import { getDailySteps, getActiveCalories, getSleepDuration } from '@/lib/services/google-fit';
import { getLatestWorkout } from '@/lib/services/hevy';
import { getDailyIncome } from '@/lib/services/stripe-service';
import { refreshSpotifyToken, getRecentlyPlayed } from '@/lib/services/spotify';
import { authenticate as authPocketCasts, getListeningHistory } from '@/lib/services/pocket-casts';
import { decrypt } from '@/lib/encryption';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const supabase = createServiceClient();
    const { data: users } = await supabase.from('users').select('id, whatsapp_number');

    if (!users) return NextResponse.json({ error: 'No users found' }, { status: 404 });

    for (const user of users) {
      try {
        const { data: credentials } = await supabase
          .from('user_credentials')
          .select('*')
          .eq('user_id', user.id);

        const googleCred = credentials?.find((c: { service_name: string }) => c.service_name === 'google');
        const spotifyCred = credentials?.find((c: { service_name: string }) => c.service_name === 'spotify');

        const today = new Date();
        let context = `Evening Reflection for ${today.toLocaleDateString()}:\n\n`;

        // 1. Health Metrics
        if (googleCred) {
          const tokens = JSON.parse(decrypt(googleCred.encrypted_token as string));
          const steps = await getDailySteps(tokens.access_token, today);
          const calories = await getActiveCalories(tokens.access_token, today);
          const sleep = await getSleepDuration(tokens.access_token, today);
          context += `Health: ${steps} steps, ${calories} cal burned, ${sleep}h sleep\n`;
        }

        const latestWorkout = await getLatestWorkout();
        if (latestWorkout && new Date(latestWorkout.start_time).toDateString() === today.toDateString()) {
          context += `Workout: ${latestWorkout.name} (${latestWorkout.duration_seconds / 60} mins)\n`;
        }

        // 2. Financial Summary
        const income = await getDailyIncome();
        context += `Financial: $${income.toFixed(2)} income today\n`;

        // 3. Media/Listening History
        if (spotifyCred) {
          const spotifyTokens = JSON.parse(decrypt(spotifyCred.encrypted_token as string));
          const refreshed = await refreshSpotifyToken(spotifyTokens.refresh_token);
          if (refreshed) {
            const recentlyPlayed = await getRecentlyPlayed(refreshed.accessToken);
            context += `Spotify: ${recentlyPlayed.slice(0, 3).map(t => `${t.name} by ${t.artist}`).join(', ')}\n`;
          }
        }

        const pcToken = await authPocketCasts();
        if (pcToken) {
          const podcasts = await getListeningHistory(pcToken);
          context += `Podcasts: ${podcasts.slice(0, 3).map(p => p.title).join(', ')}\n`;
        }

        // 4. Summarize and Score with Claude
        const reflection = await routeToLLM('reasoning', `Summarize the day and calculate a "Productivity vs Rest" score (0-100) based on this data:\n${context}`, user.id);
        
        // 5. Store in knowledge_items
        await supabase.from('knowledge_items').insert({
          user_id: user.id,
          title: `Evening Reflection - ${today.toISOString().split('T')[0]}`,
          content: reflection.response,
          source: 'evening_reflection_cron',
          tags: ['daily_reflection'],
        });

        // 6. Send WhatsApp Summary
        if (user.whatsapp_number) {
          await sendWhatsAppMessage(user.whatsapp_number, `🌙 *Evening Reflection*\n\n${reflection.response}`);
        }

      } catch (userError) {
        console.error(`Reflection failed for user ${user.id}:`, userError);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Evening reflection error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
