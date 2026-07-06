import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripeClient) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      throw new Error('STRIPE_SECRET_KEY is not set');
    }
    stripeClient = new Stripe(key, { apiVersion: '2023-10-16' });
  }
  return stripeClient;
}

export const getRecentPayouts = async (limit: number = 5) => {
  try {
    const payouts = await getStripe().payouts.list({ limit });
    return payouts.data;
  } catch (error) {
    console.error('Error fetching Stripe payouts:', error);
    return [];
  }
};

export const getDailyIncome = async () => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const timestamp = Math.floor(today.getTime() / 1000);

    const charges = await getStripe().charges.list({
      created: { gte: timestamp },
      limit: 100,
    });

    const total = charges.data
      .filter(charge => charge.status === 'succeeded' && !charge.refunded)
      .reduce((acc, charge) => acc + charge.amount, 0);

    return total / 100; // Convert cents to dollars/pounds
  } catch (error) {
    console.error('Error fetching daily income:', error);
    return 0;
  }
};

export const getSubscriptionEvents = async (limit: number = 10) => {
  try {
    const events = await getStripe().events.list({
      types: ['customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted'],
      limit,
    });
    return events.data;
  } catch (error) {
    console.error('Error fetching subscription events:', error);
    return [];
  }
};

export const getFinancialSummary = async () => {
  const daily = await getDailyIncome();
  const payouts = await getRecentPayouts(3);
  
  return {
    dailyIncome: daily,
    recentPayouts: payouts.map(p => ({
      amount: p.amount / 100,
      currency: p.currency,
      arrivalDate: new Date(p.arrival_date * 1000).toLocaleDateString(),
      status: p.status
    }))
  };
};
