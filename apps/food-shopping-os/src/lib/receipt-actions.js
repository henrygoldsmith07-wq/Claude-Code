import { householdPermission } from './household.js';
import { emojiFor, uid } from './state.js';

const text = (value, max) => String(value || '').trim().slice(0, max);

const receiptItems = (items) => (Array.isArray(items) ? items : [])
  .map((item) => ({
    name: text(item?.name, 120),
    price: Math.max(0, Number(item?.price) || 0),
    qty: text(item?.qty, 60),
    emoji: text(item?.emoji, 12),
  }))
  .filter((item) => item.name);

const receiptShop = (state, { store, date, total }, items) => ({
  id: uid('h'),
  date: /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : state.day,
  store: text(store, 80) || 'Unnamed shop',
  total: Math.round(Math.max(0, Number(total) || 0) * 100) / 100,
  saved: 0,
  items,
});

/** Save a confirmed receipt as one undoable pantry + shop-history operation. */
export const receiptActions = (set) => ({
  saveReceipt: ({ store, date, total, items = [] } = {}) => set((state) => {
    if (!householdPermission(state, 'shopping') || !householdPermission(state, 'pantry')) return {};
    const bought = receiptItems(items);
    if (!bought.length) return {};
    const shop = receiptShop(state, { store, date, total }, bought);
    return {
      shops: [...state.shops, shop],
      pantry: [...state.pantry, ...bought.map((item) => {
        const qty = Number(item.qty);
        return {
          id: uid('p'),
          emoji: item.emoji || emojiFor(item.name),
          low: false,
          addedAt: state.day,
          name: item.name,
          cat: 'Fresh',
          location: 'Cupboard',
          qty: qty !== 1 ? `${qty}` : '',
          cost: item.price,
          store: shop.store,
          expiry: null,
        };
      })],
    };
  }),
});
