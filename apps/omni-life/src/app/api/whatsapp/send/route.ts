import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppMessage } from '@/lib/services/twilio';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: NextRequest) {
  try {
    const authedSupabase = await createClient();
    const { data: { user: sessionUser } } = await authedSupabase.auth.getUser();

    if (!sessionUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { message } = await request.json();
    const userId = sessionUser.id;

    if (!message) {
      return NextResponse.json({ error: 'Missing message' }, { status: 400 });
    }

    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Get user's WhatsApp number
    const { data: user, error: userError } = await supabase
      .from('users')
      .select('whatsapp_number')
      .eq('id', userId)
      .single();

    if (userError || !user || !user.whatsapp_number) {
      return NextResponse.json({ error: 'User or WhatsApp number not found' }, { status: 404 });
    }

    // Send message
    const result = await sendWhatsAppMessage(user.whatsapp_number, message);

    // Log notification
    await supabase.from('notifications').insert({
      user_id: userId,
      message,
      channel: 'whatsapp',
      status: 'sent',
      sent_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, messageSid: result.sid });
  } catch (error) {
    console.error('Error sending WhatsApp message:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
