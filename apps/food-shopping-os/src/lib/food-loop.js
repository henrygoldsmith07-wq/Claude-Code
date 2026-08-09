import { weekDates } from './kitchen.js';

const inWeek = (date, dates) => dates.includes(date);

/** The smallest useful measure of whether a household's food week is moving. */
export const weeklyFoodLoop = (state, today = state.day) => {
  const dates = weekDates(today);
  const plannedMeals = dates.reduce(
    (total, date) => total + Object.values(state.plan?.[date] || {}).filter(Boolean).length,
    0,
  );
  const cookedMeals = (state.cooked || []).filter((entry) => inWeek(entry.date, dates)).length;
  const shops = (state.shops || []).filter((shop) => inWeek(shop.date, dates));
  const pendingItems = (state.shoppingList || []).filter((item) => !item.checked).length;
  const planDone = plannedMeals > 0;
  const shopDone = shops.length > 0;
  const cookDone = cookedMeals > 0;
  const next = !planDone ? 'plan' : !shopDone && pendingItems > 0 ? 'shop' : !cookDone ? 'cook' : 'steady';
  return {
    plannedMeals,
    cookedMeals,
    shops: shops.length,
    pendingItems,
    next,
    steps: [
      { id: 'plan', label: 'Meals', done: planDone },
      { id: 'shop', label: 'Basket', done: shopDone },
      { id: 'cook', label: 'Cooked', done: cookDone },
    ],
  };
};
