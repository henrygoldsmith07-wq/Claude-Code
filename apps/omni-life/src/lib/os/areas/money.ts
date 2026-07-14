import type { OsNode } from '@/lib/os/tree';

export const moneyOs: OsNode = {
  slug: 'money',
  name: 'Money OS',
  icon: '💷',
  tagline: 'What goes out, what comes in.',
  status: 'live',
  children: [
    { slug: 'subscriptions', name: 'Subscription Tracker', icon: '💳', tagline: 'Every recurring charge in one place.', status: 'built', repoPath: 'apps/subscription-tracker' },
    { slug: 'income', name: 'App Income', icon: '📊', tagline: 'Revenue per app — the Stripe service in Omni-Life feeds this.', status: 'live' },
    { slug: 'budget', name: 'Budget', icon: '🧾', tagline: 'Spending vs plan.', status: 'live' },
    { slug: 'savings', name: 'Savings Goals', icon: '💰', tagline: 'Name the goal, feed it, watch the bar fill.', status: 'live' },
    { slug: 'wishlist', name: 'Wishlist', icon: '🎁', tagline: 'Park the impulse; a week later it earns its price.', status: 'live' },
    { slug: 'owed', name: 'Owed & Owing', icon: '💸', tagline: 'IOUs both directions and the net position.', status: 'live' },
    { slug: 'accounts', name: 'Net Worth', icon: '🏦', tagline: 'Balance per account, one total.', status: 'live' },
    { slug: 'price-watch', name: 'Price Watch', icon: '📉', tagline: 'Waiting for the drop before buying.', status: 'live' },
    { slug: 'gifts', name: 'Gift Planner', icon: '🎀', tagline: 'Who, what, budget, bought.', status: 'live' },
    { slug: 'bills', name: 'Bills Calendar', icon: '📄', tagline: 'Recurring bills and days until each is due.', status: 'live' },
  ],
};
