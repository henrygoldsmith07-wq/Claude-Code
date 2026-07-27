import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import App from '../src/App.jsx';

const openDiary = () => {
  render(<App />);
  fireEvent.click(screen.getByText('Log'));
};

/** The leading number in "979 kcal left today · 35g protein to go". */
const dayKcal = () =>
  Number(screen.getByText(/kcal left today|kcal over your goal/).textContent.match(/[\d,]+/)[0].replace(/,/g, ''));

/** The open sheet whose heading is `title` (labels repeat inside the sheets). */
const dialogFor = (title) => {
  const dialog = [...document.querySelectorAll('[role="dialog"]')]
    .find((d) => d.querySelector('h2')?.textContent === title);
  if (!dialog) throw new Error(`No open sheet titled "${title}"`);
  return dialog;
};

describe('logging routes', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('logs a scanned barcode', () => {
    openDiary();
    fireEvent.click(screen.getByText('Barcode'));
    const sheet = dialogFor('Scan a barcode');
    fireEvent.change(within(sheet).getByLabelText('Barcode number'), { target: { value: '5000108000084' } });
    expect(within(sheet).getByText('Protein bar')).toBeDefined();

    fireEvent.click(within(sheet).getByText('Choose portion'));
    fireEvent.click(within(dialogFor('How much?')).getByText(/Add \d+ kcal to/));
    expect(screen.getAllByText('Protein bar').length).toBeGreaterThan(0);
  });

  it('tells you when a barcode is not in the catalogue', () => {
    openDiary();
    fireEvent.click(screen.getByText('Barcode'));
    const sheet = dialogFor('Scan a barcode');
    fireEvent.change(within(sheet).getByLabelText('Barcode number'), { target: { value: '9999999999999' } });
    expect(within(sheet).getByText(/No product for 9999999999999/)).toBeDefined();
  });

  it('parses a spoken sentence into portions and logs them', () => {
    openDiary();
    fireEvent.click(screen.getByText('Voice'));
    const sheet = dialogFor('Voice logging');
    fireEvent.change(within(sheet).getByLabelText('What you ate'), {
      target: { value: 'two slices of wholemeal bread and 30g cheddar for lunch' },
    });
    fireEvent.click(within(sheet).getByText('Break it into foods'));

    expect(within(sheet).getByLabelText('Grams of Wholemeal bread')).toHaveProperty('value', '72');
    fireEvent.click(within(sheet).getByText('Log 2 items'));

    const lunch = screen.getByText('Lunch').closest('section');
    expect(within(lunch).getByText('Wholemeal bread')).toBeDefined();
    expect(within(lunch).getByText('Cheddar')).toBeDefined();
  });

  it('recognises a plate from a photo and logs the detected items', async () => {
    openDiary();
    fireEvent.click(screen.getByText('Photo'));
    const sheet = dialogFor('Photo recognition');
    fireEvent.click(within(sheet).getByText('Try a sample plate'));

    const logButton = await waitFor(() => within(sheet).getByText(/^Log \d+ items/), { timeout: 3000 });
    const before = dayKcal();
    fireEvent.click(logButton);
    expect(dayKcal()).toBeLessThan(before);
  });

  it('copies a previous meal onto today', () => {
    openDiary();
    const before = dayKcal();
    fireEvent.click(screen.getByText('Copy'));
    const sheet = dialogFor('Copy a meal');
    fireEvent.click(within(sheet).getAllByText('Copy')[0]);
    expect(within(sheet).getByText(/copied to/)).toBeDefined();
    fireEvent.click(within(sheet).getByText('Back to the diary'));
    expect(dayKcal()).toBeLessThan(before);
  });

  it('applies a saved meal template', () => {
    openDiary();
    fireEvent.click(screen.getByText('Copy'));
    const sheet = dialogFor('Copy a meal');
    fireEvent.click(within(sheet).getByText('Templates'));
    fireEvent.click(within(sheet).getAllByText('Use')[0]);
    expect(within(sheet).getByText(/added to/)).toBeDefined();
    fireEvent.click(within(sheet).getByText('Back to the diary'));
    expect(screen.getAllByText('Porridge oats').length).toBeGreaterThan(1);
  });

  it('imports a pasted recipe and logs a serving', () => {
    openDiary();
    fireEvent.click(screen.getByText('Import a recipe'));
    const sheet = dialogFor('Import a recipe');
    fireEvent.click(within(sheet).getByText('Use an example'));
    fireEvent.click(within(sheet).getByText('Import recipe'));

    expect(within(sheet).getByText('Peanut butter overnight oats')).toBeDefined();
    const before = dayKcal();
    fireEvent.click(within(sheet).getByText(/^Log 1 serving/));
    expect(dayKcal()).toBeLessThan(before);
  });

  it('adjusts the portion of something already logged', () => {
    openDiary();
    const breakfast = screen.getByText('Breakfast').closest('section');
    const before = dayKcal();
    fireEvent.click(within(breakfast).getByText('Porridge oats'));

    const sheet = dialogFor('Adjust portion');
    fireEvent.change(within(sheet).getByLabelText('Portion weight'), { target: { value: '30' } });
    fireEvent.click(within(sheet).getByText('Save changes'));

    expect(dayKcal()).toBeGreaterThan(before); // smaller portion → more left in the day
    expect(within(screen.getByText('Breakfast').closest('section')).getByText(/30 g/)).toBeDefined();
  });

  it('removes an entry from the diary', () => {
    openDiary();
    const breakfast = screen.getByText('Breakfast').closest('section');
    fireEvent.click(within(breakfast).getByText('Banana'));
    fireEvent.click(within(dialogFor('Adjust portion')).getByLabelText('Delete entry'));
    expect(within(screen.getByText('Breakfast').closest('section')).queryByText('Banana')).toBeNull();
  });

  it('opens the full nutrition panel with every tracked nutrient', () => {
    openDiary();
    fireEvent.click(screen.getByText(/All 24 nutrients/));
    const sheet = dialogFor('Nutrition today');
    for (const label of ['Calories', 'Fibre', 'Saturated fat', 'Cholesterol', 'Sodium',
      'Potassium', 'Calcium', 'Iron', 'Magnesium', 'Zinc', 'Vitamin A', 'Vitamin B complex',
      'Vitamin C', 'Vitamin D', 'Vitamin E', 'Vitamin K', 'Caffeine', 'Alcohol']) {
      expect(within(sheet).getAllByText(label).length, label).toBeGreaterThan(0);
    }
    expect(within(sheet).getByText(/Micronutrients are carried by/)).toBeDefined();
  });

  it('edits a daily target and re-reads the percentage against it', () => {
    openDiary();
    fireEvent.click(screen.getByText(/All 24 nutrients/));
    const sheet = dialogFor('Nutrition today');
    fireEvent.click(within(sheet).getByText('Edit daily targets'));

    const field = within(sheet).getByLabelText('Fibre target');
    expect(field).toHaveProperty('value', '30');
    fireEvent.change(field, { target: { value: '15' } });
    expect(within(sheet).getByLabelText('Fibre target')).toHaveProperty('value', '15');

    fireEvent.click(within(sheet).getByText('Done editing targets'));
    expect(within(sheet).getByText('/ 15 g')).toBeDefined();
    expect(within(sheet).getAllByText('108%').length).toBeGreaterThan(0); // 16.2 g of 15 g
  });

  it('counts tapped glasses and logged drinks towards water intake', () => {
    openDiary();
    const water = screen.getByText('Water').closest('.card');
    const before = within(water).getByText(/\/ 2,000 ml/).textContent;
    fireEvent.click(within(water).getByText('+500 ml'));
    const after = within(water).getByText(/\/ 2,000 ml/).textContent;
    expect(Number(after.match(/[\d,]+/)[0].replace(/,/g, '')))
      .toBe(Number(before.match(/[\d,]+/)[0].replace(/,/g, '')) + 500);
    // The cappuccino and milk in the seeded diary already carry water.
    expect(within(water).getByText(/ml from food & drink/)).toBeDefined();
  });

  it('logs caffeine and alcohol from what you drink', () => {
    openDiary();
    const water = screen.getByText('Water').closest('.card');
    expect(within(water).getByText(/Caffeine 72 mg/)).toBeDefined();
    expect(within(water).getByText(/Alcohol 0 units/)).toBeDefined();
  });

  it('shows the whole nutrient profile for a chosen portion', () => {
    openDiary();
    fireEvent.click(screen.getAllByText('+ Add food')[0]);
    const addSheet = dialogFor('Add food');
    fireEvent.change(within(addSheet).getByLabelText('Search foods'), { target: { value: 'spinach' } });
    fireEvent.click(within(addSheet).getByText('Spinach'));

    const portion = dialogFor('How much?');
    fireEvent.click(within(portion).getByText(/All nutrients in this portion/));
    expect(within(portion).getByText('Vitamin K')).toBeDefined();
    expect(within(portion).getByText('145 µg')).toBeDefined(); // 30 g handful
  });

  it('creates a custom food and offers it in My foods', () => {
    openDiary();
    fireEvent.click(screen.getAllByText('+ Add food')[0]);
    const sheet = dialogFor('Add food');
    fireEvent.click(within(sheet).getByText('My foods'));
    fireEvent.click(within(sheet).getByText('New custom food'));

    fireEvent.change(within(sheet).getByPlaceholderText(/Mum’s lasagne/), { target: { value: 'Nan’s trifle' } });
    fireEvent.change(within(sheet).getByLabelText(/Serving size/), { target: { value: '200' } });
    fireEvent.change(within(sheet).getByLabelText(/^Calories/), { target: { value: '420' } });
    fireEvent.click(within(sheet).getByText('Save food'));

    expect(within(sheet).getByText('Nan’s trifle')).toBeDefined();
  });
});
