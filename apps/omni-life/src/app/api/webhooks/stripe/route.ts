import { NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createServiceClient } from '@/lib/supabase/server';
import { sendWhatsAppMessage } from '@/lib/services/twilio';

export async function POST(req: Request) {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secretKey || !endpointSecret) {
    console.error('Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET');
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }
  const stripe = new Stripe(secretKey, { apiVersion: '2023-10-16' });

  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    const { data: notifyUser } = await supabase
      .from('users')
      .select('id, whatsapp_number')
      .limit(1)
      .single();

    if (!notifyUser?.id) {
      console.error('No user found to attribute Stripe transaction to');
      return NextResponse.json({ error: 'No user configured' }, { status: 500 });
    }
    const userId = notifyUser.id;

    switch (event.type) {
      case 'charge.succeeded': {
        const charge = event.data.object as Stripe.Charge;
        await supabase.from('financial_transactions').insert({
          user_id: userId,
          transaction_id: charge.id,
          amount: charge.amount / 100,
          currency: charge.currency.toUpperCase(),
          type: 'income',
          description: charge.description || 'Charge succeeded',
          source: 'stripe',
          timestamp: new Date(charge.created * 1000).toISOString(),
        });
        break;
      }

      case 'payout.paid': {
        const payout = event.data.object as Stripe.Payout;
        await supabase.from('financial_transactions').insert({
          user_id: userId,
          transaction_id: payout.id,
          amount: payout.amount / 100,
          currency: payout.currency.toUpperCase(),
          type: 'payout',
          description: 'Stripe Payout',
          source: 'stripe',
          timestamp: new Date(payout.created * 1000).toISOString(),
        });

        // Send WhatsApp notification for payouts
        if (notifyUser?.whatsapp_number) {
          await sendWhatsAppMessage(
            notifyUser.whatsapp_number,
            `💰 *New Payout Received!*\n\nAmount: ${payout.amount / 100} ${payout.currency.toUpperCase()}\nStatus: Paid\nExpected Arrival: ${new Date(payout.arrival_date * 1000).toLocaleDateString()}`
          );
        }
        break;
      }

      case 'invoice.payment_succeeded': {
        const invoice = event.data.object as Stripe.Invoice;
        await supabase.from('financial_transactions').insert({
          user_id: userId,
          transaction_id: invoice.id,
          amount: invoice.amount_paid / 100,
          currency: invoice.currency.toUpperCase(),
          type: 'subscription_income',
          description: `Invoice for ${invoice.customer_email}`,
          source: 'stripe',
          timestamp: new Date(invoice.created * 1000).toISOString(),
        });
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (dbError) {
    console.error('Error updating database from Stripe webhook:', dbError);
    return NextResponse.json({ error: 'Database update failed' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
