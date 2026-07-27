import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import App from '../src/App.jsx';

describe('App', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('renders the shell with all six tabs', () => {
    render(<App />);
    for (const label of ['Home', 'Plan', 'Log', 'Shop', 'Recipes', 'Profile']) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('shows the greeting and budget card', () => {
    render(<App />);
    expect(screen.getAllByText(/Good (morning|afternoon|evening)/).length).toBeGreaterThan(0);
    expect(screen.getByText('Weekly budget')).toBeDefined();
  });

  it('opens the food diary with the seeded meals', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Log'));
    expect(screen.getByText('Food diary')).toBeDefined();
    expect(screen.getByText('Breakfast')).toBeDefined();
    expect(screen.getAllByText('Porridge oats').length).toBeGreaterThan(0);
    expect(screen.getByText(/eating window|Log something/)).toBeDefined();
  });

  it('logs a food through search and updates the day total', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Log'));
    const before = Number(screen.getByText(/kcal left today|kcal over your goal/).textContent.replace(/\D/g, ''));

    fireEvent.click(screen.getAllByText('+ Add food')[0]);
    const addSheet = screen.getByText('Add food').closest('[role="dialog"]');
    fireEvent.change(within(addSheet).getByLabelText('Search foods'), { target: { value: 'hummus' } });
    fireEvent.click(within(addSheet).getByText('Hummus'));

    const portionSheet = screen.getByText('How much?').closest('[role="dialog"]');
    fireEvent.click(within(portionSheet).getByText(/Add \d+ kcal to/));

    const after = Number(screen.getByText(/kcal left today|kcal over your goal/).textContent.replace(/\D/g, ''));
    expect(after).toBeLessThan(before);
    expect(screen.getAllByText('Hummus').length).toBeGreaterThan(0);
  });

  it('quick-adds calories without a food', () => {
    render(<App />);
    fireEvent.click(screen.getByText('Log'));
    fireEvent.click(screen.getAllByText('+ Add food')[0]);
    fireEvent.click(screen.getByText('Quick add'));
    fireEvent.click(screen.getByText(/Full meal · 650/));
    fireEvent.click(screen.getByText(/^Add 650 kcal$/));
    expect(screen.getAllByText('Quick add').length).toBeGreaterThan(0);
  });
});
