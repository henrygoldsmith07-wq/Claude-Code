import { monthlyEquivalentCents } from "./money";
import type { CancellationLogEntry, Subscription, ToastState } from "./types";

type SetSubscriptions = (
  value: Subscription[] | ((current: Subscription[]) => Subscription[]),
) => void;
type SetCancellationLog = (
  value: CancellationLogEntry[] | ((current: CancellationLogEntry[]) => CancellationLogEntry[]),
) => void;

export function useSubscriptionActions(
  subscriptions: Subscription[],
  setSubscriptions: SetSubscriptions,
  cancellationLog: CancellationLogEntry[],
  setCancellationLog: SetCancellationLog,
  setToast: (toast: ToastState | null) => void,
) {
  function addSubscription(sub: Omit<Subscription, "id" | "priceHistory" | "active">) {
    setSubscriptions([
      ...subscriptions,
      { ...sub, id: crypto.randomUUID(), priceHistory: [], active: true },
    ]);
  }

  function updateSubscriptionPrice(id: string, newAmountCents: number) {
    setSubscriptions(
      subscriptions.map((s) => {
        if (s.id !== id || s.amountCents === newAmountCents) return s;
        return {
          ...s,
          amountCents: newAmountCents,
          priceHistory: [
            ...s.priceHistory,
            { amountCents: s.amountCents, recordedAt: new Date().toISOString() },
          ],
        };
      }),
    );
  }

  function toggleActive(id: string) {
    setSubscriptions(subscriptions.map((s) => (s.id === id ? { ...s, active: !s.active } : s)));
  }

  function bulkSetActive(category: string, active: boolean) {
    setSubscriptions(
      subscriptions.map((s) => (s.category === category ? { ...s, active } : s)),
    );
  }

  function duplicateSubscription(id: string) {
    const sub = subscriptions.find((s) => s.id === id);
    if (!sub) return;
    setSubscriptions([
      ...subscriptions,
      { ...sub, id: crypto.randomUUID(), name: `${sub.name} (copy)`, priceHistory: [] },
    ]);
  }

  function deleteSubscription(id: string) {
    const sub = subscriptions.find((s) => s.id === id);
    if (!sub) return;

    setSubscriptions(subscriptions.filter((s) => s.id !== id));

    let logEntry: CancellationLogEntry | null = null;
    if (sub.active) {
      logEntry = {
        id: crypto.randomUUID(),
        name: sub.name,
        monthlyEquivalentCentsAtCancellation: monthlyEquivalentCents(
          sub.amountCents,
          sub.billingCycle,
        ),
        cancelledAt: new Date().toISOString(),
      };
      setCancellationLog([...cancellationLog, logEntry]);
    }

    const entryToRemove = logEntry;
    setToast({
      message: `Deleted ${sub.name}`,
      actionLabel: "Undo",
      onAction: () => {
        setSubscriptions((current) => [...current, sub]);
        if (entryToRemove) {
          setCancellationLog((current) => current.filter((e) => e.id !== entryToRemove.id));
        }
        setToast(null);
      },
    });
  }

  return {
    addSubscription,
    updateSubscriptionPrice,
    toggleActive,
    bulkSetActive,
    duplicateSubscription,
    deleteSubscription,
  };
}
