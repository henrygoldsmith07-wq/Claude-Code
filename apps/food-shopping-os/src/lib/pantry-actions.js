import { householdPermission } from './household.js';
import { decrementPantryItem } from './kitchen.js';

export const pantryActions = (set) => ({
  usePantryItem: (id) => set((state) => {
    if (!householdPermission(state, 'pantry')) return {};
    const item = state.pantry.find((entry) => entry.id === id);
    if (!item) return {};
    const next = decrementPantryItem(item);
    return {
      pantry: next.remove
        ? state.pantry.filter((entry) => entry.id !== id)
        : state.pantry.map((entry) => (entry.id === id ? next.item : entry)),
    };
  }),
});
