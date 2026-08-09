import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import App from '../src/App.jsx';

const onboard = () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Sam' } });
  fireEvent.click(screen.getByText('Continue'));
  fireEvent.click(screen.getByText('Continue'));
  fireEvent.click(screen.getByText('Start using Forq'));
};

describe('global UX controls', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('opens the command palette from the keyboard and navigates search results', () => {
    onboard();
    fireEvent.keyDown(window, { key: 'k', ctrlKey: true });
    const palette = screen.getByText('Command palette').closest('[role="dialog"]');
    const input = within(palette).getByLabelText('Search Forq');
    fireEvent.change(input, { target: { value: 'pantry' } });
    fireEvent.click(within(palette).getByText('Open pantry'));
    expect(screen.getByText('Smart pantry')).toBeTruthy();
  });

  it('opens quick add with Q and undoes an action with Ctrl+Z', () => {
    onboard();
    fireEvent.keyDown(window, { key: 'q' });
    const quick = screen.getByText('Quick add').closest('[role="dialog"]');
    fireEvent.click(within(quick).getByText('Glass of water'));
    expect(screen.getByText((_, element) => element.tagName === 'P' && element.textContent.includes('250 / 2,000 ml'))).toBeTruthy();
    fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(screen.getByText((_, element) => element.tagName === 'P' && element.textContent.includes('0 / 2,000 ml'))).toBeTruthy();
    expect(screen.getByText('Undid last action')).toBeTruthy();
  });

  it('shows filtering, sorting and shortcut help in the palette', () => {
    onboard();
    fireEvent.click(screen.getByLabelText('Global search'));
    const palette = screen.getByText('Command palette').closest('[role="dialog"]');
    expect(within(palette).getByLabelText('Result type')).toBeTruthy();
    expect(within(palette).getByLabelText('Sort results')).toBeTruthy();
    expect(within(palette).getByText(/Ctrl K/)).toBeTruthy();
    expect(within(palette).getByText(/Q.*quick add/)).toBeTruthy();
  });
});
