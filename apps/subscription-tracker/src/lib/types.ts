export type BillingCycle = "weekly" | "monthly" | "yearly";

export interface PriceHistoryEntry {
  amountCents: number;
  recordedAt: string;
}

export interface Subscription {
  id: string;
  name: string;
  category: string;
  amountCents: number;
  billingCycle: BillingCycle;
  nextRenewalDate: string;
  priceHistory: PriceHistoryEntry[];
  active: boolean;
  isTrial: boolean;
  trialEndsDate: string | null;
  splitCount: number;
  yearlyPriceCents: number | null;
  notes: string;
  cancelUrl: string | null;
  lastUsedDate: string | null;
  isFavorite: boolean;
  paymentMethod: string;
  owner: string;
  currencyCode: string;
  archived: boolean;
  createdAt: string;
}

export interface CancellationLogEntry {
  id: string;
  name: string;
  monthlyEquivalentCentsAtCancellation: number;
  cancelledAt: string;
}

export type RefundStatus = "pending" | "received" | "overdue";

export interface Refund {
  id: string;
  merchant: string;
  amountCents: number;
  expectedDate: string | null;
  status: RefundStatus;
  receivedAt: string | null;
}

export interface Budget {
  id: string;
  category: string;
  monthlyLimitCents: number;
}

export interface ToastState {
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}
