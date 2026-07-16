'use client';

import React, { useState } from 'react';
import OsShell, { panelCls, inputCls, btnCls, dangerBtnCls } from '@/components/os/shell';
import { useStoredState, uid } from '@/lib/os/storage';

interface Account {
  id: string;
  name: string;
  balance: number;
}

const gbp = (n: number) => n.toLocaleString('en-GB', { style: 'currency', currency: 'GBP' });

export default function NetWorthPage() {
  const [accounts, setAccounts] = useStoredState<Account[]>('os.money.accounts', []);
  const [name, setName] = useState('');
  const [balance, setBalance] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});

  const add = () => {
    const b = parseFloat(balance);
    if (!name.trim() || isNaN(b)) return;
    setAccounts([...accounts, { id: uid(), name: name.trim(), balance: b }]);
    setName(''); setBalance('');
  };

  const update = (acc: Account) => {
    const b = parseFloat(edits[acc.id] ?? '');
    if (isNaN(b)) return;
    setAccounts(accounts.map((a) => a.id === acc.id ? { ...a, balance: b } : a));
    setEdits({ ...edits, [acc.id]: '' });
  };

  const total = accounts.reduce((s, a) => s + a.balance, 0);

  return (
    <OsShell
      crumbs={[{ name: 'Life OS', href: '/os' }, { name: 'Money OS', href: '/os/money' }, { name: 'Net Worth' }]}
      icon="🏦" title="Net Worth" tagline="Every account balance, one honest total.">
      <section className={`${panelCls} text-center`}>
        <p className="text-xs text-gray-500 uppercase tracking-widest">Total</p>
        <p className={`text-5xl font-bold mt-2 ${total >= 0 ? 'text-white' : 'text-red-400'}`}>{gbp(total)}</p>
      </section>

      <section className={panelCls}>
        <div className="flex flex-wrap gap-3 mb-5">
          <input className={`${inputCls} flex-1 min-w-[200px]`} placeholder="Account (e.g. Monzo, cash, PayPal)"
            value={name} onChange={(e) => setName(e.target.value)} />
          <input className={inputCls} type="number" step="0.01" placeholder="Balance £"
            value={balance} onChange={(e) => setBalance(e.target.value)} />
          <button className={btnCls} onClick={add}>Add account</button>
        </div>
        {accounts.length === 0 && <p className="text-sm text-gray-600">No accounts yet.</p>}
        <ul className="space-y-3">
          {accounts.map((acc) => (
            <li key={acc.id} className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <span className="text-gray-200 font-medium">{acc.name}</span>
              <span className="flex items-center gap-2">
                <span className={acc.balance >= 0 ? 'text-gray-300' : 'text-red-400'}>{gbp(acc.balance)}</span>
                <input className={`${inputCls} w-28`} type="number" step="0.01" placeholder="Update £"
                  value={edits[acc.id] ?? ''}
                  onChange={(e) => setEdits({ ...edits, [acc.id]: e.target.value })}
                  onKeyDown={(e) => e.key === 'Enter' && update(acc)} />
                <button className={btnCls} onClick={() => update(acc)}>Set</button>
                <button className={dangerBtnCls}
                  onClick={() => setAccounts(accounts.filter((a) => a.id !== acc.id))}>✕</button>
              </span>
            </li>
          ))}
        </ul>
      </section>
    </OsShell>
  );
}
