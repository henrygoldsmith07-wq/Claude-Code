import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import App from '../src/App.jsx';

describe('App', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('renders the shell with all five tabs', () => {
    render(<App />);
    for (const label of ['Home', 'Plan', 'Shop', 'Recipes', 'Profile']) {
      expect(screen.getByText(label)).toBeDefined();
    }
  });

  it('shows the greeting and budget card', () => {
    render(<App />);
    expect(screen.getAllByText(/Good (morning|afternoon|evening)/).length).toBeGreaterThan(0);
    expect(screen.getByText('Weekly budget')).toBeDefined();
  });
});
