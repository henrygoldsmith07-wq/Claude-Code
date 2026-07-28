import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { GestureMenu } from '../src/components/ui.jsx';

afterEach(() => {
  vi.useRealTimers();
  cleanup();
});

describe('gesture menus', () => {
  const renderRow = (over = {}) => {
    const remove = vi.fn();
    const left = vi.fn();
    const right = vi.fn();
    render(
      <GestureMenu
        label="Milk"
        actions={[{ label: 'Remove', onClick: remove }]}
        onSwipeLeft={left}
        onSwipeRight={right}
        {...over}
      >
        <span>Milk row</span>
      </GestureMenu>,
    );
    return { remove, left, right };
  };

  it('opens the same accessible menu from a context click', () => {
    const { remove } = renderRow();
    fireEvent.contextMenu(screen.getByLabelText('Actions for Milk'));
    fireEvent.click(screen.getByText('Remove'));
    expect(remove).toHaveBeenCalledOnce();
  });

  it('opens on long press', () => {
    vi.useFakeTimers();
    renderRow();
    fireEvent.touchStart(screen.getByLabelText('Actions for Milk'), { touches: [{ clientX: 20, clientY: 20 }] });
    act(() => vi.advanceTimersByTime(600));
    expect(screen.getByText('Remove')).toBeTruthy();
  });

  it('maps deliberate horizontal swipes to row actions', () => {
    const { left, right } = renderRow();
    const row = screen.getByLabelText('Actions for Milk');
    fireEvent.touchStart(row, { touches: [{ clientX: 100, clientY: 20 }] });
    fireEvent.touchEnd(row, { changedTouches: [{ clientX: 10, clientY: 20 }] });
    expect(left).toHaveBeenCalledOnce();
    fireEvent.touchStart(row, { touches: [{ clientX: 10, clientY: 20 }] });
    fireEvent.touchEnd(row, { changedTouches: [{ clientX: 100, clientY: 20 }] });
    expect(right).toHaveBeenCalledOnce();
  });
});
