import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../src/App.jsx';
import { STORAGE_KEY } from '../src/lib/state.js';

const state = {
  onboarded: true,
  name: 'Sam',
  day: '2026-07-28',
  weeklyBudget: 50,
  shops: [
    { id: 's1', date: '2026-07-07', store: 'Tesco', total: 45, items: [{ name: 'Milk', price: 2 }] },
    { id: 's2', date: '2026-07-14', store: 'Tesco', total: 48, items: [{ name: 'Milk', price: 2.1 }] },
    { id: 's3', date: '2026-07-21', store: 'Tesco', total: 50, items: [{ name: 'Milk', price: 2.2 }] },
    { id: 's4', date: '2026-07-28', store: 'Tesco', total: 60, items: [{ name: 'Bread', price: 1.5 }] },
  ],
  pantry: [{ id: 'p1', name: 'Eggs', low: true, cost: 2, location: 'Fridge', cat: 'Dairy' }],
};

describe('Smart Features centre', () => {
  beforeEach(() => localStorage.setItem(STORAGE_KEY, JSON.stringify(state)));
  afterEach(() => {
    cleanup();
    localStorage.clear();
  });

  it('shows evidence-backed predictions and adds its generated list', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Profile'));
    fireEvent.click(screen.getByText('Smart Features'));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Next shopping trip')).toBeDefined();
    expect(within(dialog).getByText(/4 recorded shopping days/)).toBeDefined();
    expect(within(dialog).getByText('Budget overrun')).toBeDefined();
    expect(within(dialog).getByText(/Milk/)).toBeDefined();
    expect(within(dialog).getByText(/Foreground location reminder/)).toBeDefined();

    fireEvent.click(within(dialog).getByText(/Add 2 items to shopping/));
    fireEvent.click(within(dialog).getByLabelText('Close'));
    fireEvent.click(screen.getByText('Shop'));
    expect(screen.getByLabelText('Tick Eggs')).toBeDefined();
    expect(screen.getByLabelText('Tick Milk')).toBeDefined();
  });

  it('opens the voice-enabled food coach with a typed fallback', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Profile'));
    fireEvent.click(screen.getByText('Smart Features'));
    fireEvent.click(within(screen.getByRole('dialog')).getByText('Open'));

    const coach = screen.getByText('AI food coach').closest('[role="dialog"]');
    expect(within(coach).getByLabelText('Ask by voice').disabled).toBe(true);
    expect(within(coach).getByLabelText('Ask the AI food coach')).toBeDefined();
  });
});
