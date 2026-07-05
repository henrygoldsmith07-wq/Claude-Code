import { NextRequest, NextResponse } from 'next/server';
import { processIncomingWhatsAppMessage, sendWhatsAppMessage, isValidTwilioRequest } from '@/lib/services/twilio';
import { createClient } from '@supabase/supabase-js';
import { routeToLLM } from '@/lib/llm/router';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const payload = Object.fromEntries(formData);

    const signature = request.headers.get('x-twilio-signature');
    if (!isValidTwilioRequest(signature, request.url, payload as Record<string, unknown>)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 403 });
    }

    // Process incoming message
    const { from, messageBody } = processIncomingWhatsAppMessage(payload);

    // Find user by WhatsApp number
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: user, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('whatsapp_number', from)
      .single();

    if (userError || !user) {
      console.error('User not found:', userError);
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Route message to LLM for processing
    const llmResponse = await routeToLLM('execution', messageBody, user.id);

    // Send response back to user
    if (llmResponse.response) {
      await sendWhatsAppMessage(from, llmResponse.response);
    }

    // Log the interaction
    await supabase.from('notifications').insert({
      user_id: user.id,
      message: messageBody,
      channel: 'whatsapp',
      status: 'received',
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error processing Twilio webhook:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
