import { addDays, pantryAnalytics, spendByMonth } from './kitchen.js';
import { dayTotals } from './nutrition.js';
import { periodFootprint, shopFootprint } from './footprint.js';

const round = (value, places = 0) => {
  const scale = 10 ** places;
  return Math.round((Number(value) || 0) * scale) / scale;
};

const sum = (rows, read) => rows.reduce((total, row) => total + (Number(read(row)) || 0), 0);

const monthLabel = (key) => new Date(`${key}-01T12:00:00`)
  .toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });

const grouped = (rows, readKey, readValue = () => 1) => {
  const groups = new Map();
  rows.forEach((row) => {
    const name = String(readKey(row) || '').trim();
    if (!name) return;
    const key = name.toLowerCase();
    const current = groups.get(key) || { name, count: 0, value: 0 };
    current.count += 1;
    current.value += Number(readValue(row)) || 0;
    groups.set(key, current);
  });
  return [...groups.values()];
};

const nutritionForDates = (state, dates) => {
  const rows = dates
    .map((date) => ({ date, entries: state.log?.[date] || [] }))
    .filter((row) => row.entries.length);
  const totals = rows.map((row) => ({ date: row.date, ...dayTotals(row.entries) }));
  const keys = ['kcal', 'protein', 'carbs', 'fat', 'fibre', 'sugar', 'sodium'];
  const averages = Object.fromEntries(keys.map((key) => [
    key,
    round(sum(totals, (row) => row[key]) / (totals.length || 1), key === 'kcal' ? 0 : 1),
  ]));
  return { rows: totals, loggedDays: totals.length, averages };
};

export const shoppingAnalytics = (state, today = state.day) => {
  const shops = state.shops || [];
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const thisMonth = shops.filter((shop) => String(shop.date || '').startsWith(month));
  const thisYear = shops.filter((shop) => String(shop.date || '').startsWith(year));
  const stores = grouped(shops, (shop) => shop.store, (shop) => shop.total)
    .map((row) => {
      const trips = shops.filter((shop) => String(shop.store || '').trim().toLowerCase() === row.name.toLowerCase());
      const spent = round(sum(trips, (shop) => shop.total), 2);
      return {
        name: row.name,
        trips: trips.length,
        spent,
        average: round(spent / trips.length, 2),
        saved: round(sum(trips, (shop) => shop.saved), 2),
      };
    })
    .sort((a, b) => b.trips - a.trips || b.spent - a.spent || a.name.localeCompare(b.name));
  const products = grouped(shops.flatMap((shop) => shop.items || []), (item) => item.name)
    .map((row) => ({ name: row.name, times: row.count }))
    .sort((a, b) => b.times - a.times || a.name.localeCompare(b.name));
  const brands = grouped(
    Object.values(state.log || {}).flatMap((entries) => entries || []),
    (entry) => entry.brand,
  )
    .map((row) => ({ name: row.name, times: row.count }))
    .sort((a, b) => b.times - a.times || a.name.localeCompare(b.name));
  const days = grouped(shops, (shop) => {
    if (!shop.date) return '';
    return new Date(`${shop.date}T12:00:00`).toLocaleDateString('en-GB', { weekday: 'long' });
  })
    .map((row) => ({ name: row.name, trips: row.count }))
    .sort((a, b) => b.trips - a.trips || a.name.localeCompare(b.name));
  const totalItems = sum(shops, (shop) => (shop.items || []).length);
  const allSaved = round(sum(shops, (shop) => shop.saved), 2);

  return {
    spent: {
      month: round(sum(thisMonth, (shop) => shop.total), 2),
      year: round(sum(thisYear, (shop) => shop.total), 2),
      total: round(sum(shops, (shop) => shop.total), 2),
    },
    trips: shops.length,
    averageBasket: round(sum(shops, (shop) => shop.total) / (shops.length || 1), 2),
    averageItems: round(totalItems / (shops.length || 1), 1),
    stores,
    products,
    brands,
    favouriteDay: days[0] || null,
    monthly: spendByMonth(shops, 12, today),
    savings: {
      total: allSaved,
      month: round(sum(thisMonth, (shop) => shop.saved), 2),
      year: round(sum(thisYear, (shop) => shop.saved), 2),
      trips: shops.filter((shop) => Number(shop.saved) > 0).length,
    },
  };
};

export const nutritionAnalytics = (state, { days = 30, today = state.day } = {}) => {
  const dates = Array.from({ length: days }, (_, index) => addDays(today, index - days + 1));
  const report = nutritionForDates(state, dates);
  const targets = state.targets || {};
  return {
    ...report,
    days,
    coverage: Math.round((report.loggedDays / days) * 100),
    nutrients: ['kcal', 'protein', 'carbs', 'fat', 'fibre'].map((key) => ({
      key,
      average: report.averages[key],
      target: Number(targets[key]) || 0,
      pct: targets[key] ? Math.round((report.averages[key] / targets[key]) * 100) : null,
    })),
  };
};

export const pantryDashboard = (state, today = state.day) => {
  const report = pantryAnalytics(state.pantry || [], today);
  return {
    ...report,
    datedCoverage: report.total ? Math.round((report.dated / report.total) * 100) : 0,
  };
};

export const wasteAnalytics = (state, today = state.day) => {
  const waste = state.waste || [];
  const month = today.slice(0, 7);
  const year = today.slice(0, 4);
  const shopping = shoppingAnalytics(state, today);
  const monthRows = waste.filter((row) => String(row.date || '').startsWith(month));
  const yearRows = waste.filter((row) => String(row.date || '').startsWith(year));
  const top = grouped(waste, (row) => row.name, (row) => row.cost)
    .map((row) => ({ name: row.name, count: row.count, cost: round(row.value, 2) }))
    .sort((a, b) => b.cost - a.cost || b.count - a.count || a.name.localeCompare(b.name));
  const monthlySpend = shopping.spent.month;

  return {
    month: {
      count: monthRows.length,
      cost: round(sum(monthRows, (row) => row.cost), 2),
      rate: monthlySpend ? round((sum(monthRows, (row) => row.cost) / monthlySpend) * 100, 1) : null,
    },
    year: {
      count: yearRows.length,
      cost: round(sum(yearRows, (row) => row.cost), 2),
    },
    total: {
      count: waste.length,
      cost: round(sum(waste, (row) => row.cost), 2),
    },
    top,
    monthly: spendByMonth(
      waste.map((row, index) => ({ ...row, id: `waste-${index}`, total: row.cost })),
      6,
      today,
    ).map(({ key, label, spend }) => ({ key, label, cost: spend })),
  };
};

export const carbonAnalytics = (state, today = state.day) => ({
  food: periodFootprint(state.log || {}, { days: 30, today }),
  shopping: shopFootprint(state.shops || [], { days: 30, today }),
});

export const calendarAnalyticsReport = (state, period = 'month', today = state.day) => {
  const prefix = period === 'year' ? today.slice(0, 4) : today.slice(0, 7);
  const shops = (state.shops || []).filter((row) => String(row.date || '').startsWith(prefix));
  const waste = (state.waste || []).filter((row) => String(row.date || '').startsWith(prefix));
  const dates = Object.keys(state.log || {}).filter((date) => date.startsWith(prefix)).sort();
  const nutrition = nutritionForDates(state, dates);
  const elapsedDays = period === 'year'
    ? Math.floor((new Date(`${today}T12:00:00`) - new Date(`${today.slice(0, 4)}-01-01T12:00:00`)) / 86400000) + 1
    : Number(today.slice(8, 10));
  return {
    period,
    label: period === 'year' ? prefix : monthLabel(prefix),
    spend: round(sum(shops, (shop) => shop.total), 2),
    trips: shops.length,
    items: sum(shops, (shop) => (shop.items || []).length),
    saved: round(sum(shops, (shop) => shop.saved), 2),
    wasteCost: round(sum(waste, (row) => row.cost), 2),
    wasteItems: waste.length,
    loggedDays: nutrition.loggedDays,
    nutrition: nutrition.averages,
    carbon: periodFootprint(state.log || {}, { days: elapsedDays, today }),
  };
};
