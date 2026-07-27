'use client';

import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { FinancialTransaction } from '@/types';

interface FinanceCardProps {
  transactions: FinancialTransaction[];
}

export default function FinanceCard({ transactions }: FinanceCardProps) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const todayIncome = transactions
    .filter(t => new Date(t.timestamp) >= today && (t.type === 'income' || t.type === 'subscription_income'))
    .reduce((sum, t) => sum + t.amount, 0);

  const weeklyTotal = transactions
    .filter(t => t.type === 'income' || t.type === 'subscription_income')
    .reduce((sum, t) => sum + t.amount, 0);

  const recentTransactions = transactions.slice(0, 5);

  return (
    <Card className="bg-surface border-line text-ink">
      <CardHeader>
        <CardTitle className="text-lg font-semibold">Financial Summary</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-ink3">Today's Income</p>
            <p className="text-2xl font-bold text-success">${todayIncome.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-xs text-ink3">Weekly Total</p>
            <p className="text-2xl font-bold text-speak">${weeklyTotal.toFixed(2)}</p>
          </div>
        </div>

        <div>
          <p className="text-xs text-ink3 mb-3">Recent Transactions</p>
          <div className="space-y-2">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((t) => (
                <div key={t.id} className="flex justify-between items-center text-sm bg-surface p-2 rounded">
                  <div>
                    <p className="font-medium truncate max-w-[120px]">{t.description || 'Transaction'}</p>
                    <p className="text-xs text-ink3">{new Date(t.timestamp).toLocaleDateString()}</p>
                  </div>
                  <span className={t.amount >= 0 ? 'text-success' : 'text-danger'}>
                    {t.amount >= 0 ? '+' : ''}${Math.abs(t.amount).toFixed(2)}
                  </span>
                </div>
              ))
            ) : (
              <p className="text-sm text-ink3 italic">No recent transactions</p>
            )}
          </div>
        </div>

        <div className="pt-2">
          <div className="flex items-center justify-between text-xs text-ink3">
            <span>Stripe Payout Status</span>
            <span className="px-2 py-0.5 bg-success/20 text-success rounded-full">Active</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
