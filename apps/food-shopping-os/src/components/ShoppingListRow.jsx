import { useState } from 'react';
import { Check, Trash2 } from 'lucide-react';
import { useApp } from '../lib/store.jsx';
import { AISLE_ORDER } from '../data/stores.js';
import { cx } from '../lib/utils.js';
import { haptic } from '../lib/haptics.js';
import { unitPrice } from '../lib/shopping.js';
import { Glyph } from './icons.jsx';
import { Chip, GestureMenu } from './ui.jsx';

export default function ShoppingListRow({ item, onAisle, dragging, setDragging }) {
  const app = useApp();
  const [moving, setMoving] = useState(false);
  const comparablePrice = unitPrice(item);
  const toggle = () => {
    app.toggleChecked(item.id);
    if (!item.checked) haptic();
  };
  return (
    <GestureMenu
      label={item.name}
      actions={[
        { label: item.checked ? 'Mark not bought' : 'Mark bought', onClick: toggle },
        { label: item.priority === 'high' ? 'Normal priority' : 'High priority', onClick: () => app.updateListItem(item.id, { priority: item.priority === 'high' ? 'normal' : 'high' }) },
        { label: 'Move to another aisle', onClick: () => setMoving(true) },
        { label: 'Remove', tone: 'danger', onClick: () => app.removeListItem(item.id) },
      ]}
      onSwipeLeft={() => app.removeListItem(item.id)}
      onSwipeRight={toggle}
      draggable
      onDragStart={() => setDragging(item.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => {
        if (dragging) app.moveListItem(dragging, item.id);
        setDragging(null);
      }}
    >
      <div className="p-3" style={{ borderColor: 'var(--line)' }}>
      <div className="flex items-center gap-3">
        <button
          onClick={toggle}
          aria-label={`Tick ${item.name}`}
          className="press flex h-6 w-6 items-center justify-center rounded-full border-2 shrink-0"
          style={item.checked
            ? { background: 'var(--accent)', borderColor: 'var(--accent)', color: 'var(--on-accent)' }
            : { borderColor: 'var(--line)', color: 'transparent' }}
        >
          {item.checked && <Check className="check-in" size={13} strokeWidth={3} />}
        </button>
        <button onClick={() => setMoving((v) => !v)} aria-label={`Move ${item.name} to another aisle`} className="press shrink-0">
          <Glyph e={item.emoji} size={20} style={{ color: 'var(--muted)' }} />
        </button>
        <div className="min-w-0 flex-1">
          <p className={cx('font-bold text-[0.875rem] truncate', item.checked && 'line-through opacity-45')}>
            {item.name}
            {item.qty && <span className="font-semibold text-[0.75rem]" style={{ color: 'var(--muted)' }}> · {item.qty}</span>}
          </p>
          {item.priority === 'high' && <p className="text-[0.625rem] font-bold uppercase tracking-wide" style={{ color: 'var(--warn)' }}>Need it</p>}
          {item.note && <p className="text-[0.71875rem] font-semibold truncate" style={{ color: 'var(--muted)' }}>{item.note}</p>}
          {item.fromRecipe && (
            <p className="text-[0.71875rem] font-semibold truncate" style={{ color: 'var(--muted)' }}>for {item.fromRecipe}</p>
          )}
          {comparablePrice && (
            <p className="text-[0.71875rem] font-extrabold" style={{ color: 'var(--accent)' }}>
              £{comparablePrice.value.toFixed(2)} / {comparablePrice.unit}
            </p>
          )}
          {app.members.length > 0 && (
            <select
              value={item.assigneeId || ''}
              onChange={(event) => app.assignListItem(item.id, event.target.value)}
              aria-label={`Assign ${item.name}`}
              className="mt-1 rounded-lg border px-2 py-1 text-[0.6875rem] font-bold"
              style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--muted)' }}
            >
              <option value="">Anyone</option>
              {app.members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
            </select>
          )}
        </div>
        <input
          type="number"
          min="0"
          step="0.25"
          value={item.price || ''}
          onChange={(e) => app.updateListItem(item.id, { price: Number(e.target.value) || 0 })}
          placeholder="£"
          aria-label={`Price of ${item.name}`}
          className="w-16 shrink-0 rounded-xl border px-2 py-1.5 text-[0.8125rem] font-bold text-right outline-none"
          style={{ background: 'var(--card)', borderColor: 'var(--line)', color: 'var(--ink)' }}
        />
        <button
          onClick={() => app.removeListItem(item.id)}
          aria-label={`Remove ${item.name}`}
          className="press p-1 shrink-0"
          style={{ color: 'var(--faint)' }}
        >
          <Trash2 size={15} />
        </button>
      </div>
      {moving && (
        <div className="mt-2 flex gap-2 overflow-x-auto no-scrollbar">
          {AISLE_ORDER.map((aisle) => (
            <Chip
              key={aisle}
              active={item.aisle === aisle}
              onClick={() => { onAisle(item.id, aisle); setMoving(false); }}
            >
              {aisle}
            </Chip>
          ))}
        </div>
      )}
      </div>
    </GestureMenu>
  );
}
