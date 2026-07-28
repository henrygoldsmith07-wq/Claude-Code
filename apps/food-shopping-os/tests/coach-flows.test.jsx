import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, within } from '@testing-library/react';
import App from '../src/App.jsx';

const onboard = () => {
  render(<App />);
  fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Sam' } });
  fireEvent.click(screen.getByText('Continue'));
  fireEvent.click(screen.getByText('Continue'));
  fireEvent.click(screen.getByText('Start using Forq'));
};

const dialogFor = (title) => {
  const dialog = [...document.querySelectorAll('[role="dialog"]')]
    .find((d) => d.querySelector('h2')?.textContent === title);
  if (!dialog) throw new Error(`No open sheet titled "${title}"`);
  return dialog;
};

const openCoach = () => {
  fireEvent.click(screen.getByLabelText('AI food coach'));
  return dialogFor('AI food coach');
};

/** Log one catalogue food through the diary. */
const logFood = (query, meal = 'Lunch') => {
  fireEvent.click(screen.getByText('Log'));
  fireEvent.click(screen.getAllByText('Search')[0]);
  const sheet = dialogFor('Add food');
  fireEvent.change(within(sheet).getByLabelText(/Search/i), { target: { value: query } });
  fireEvent.click(within(sheet).getAllByText(new RegExp(query, 'i'))[0]);
  const portion = dialogFor('How much?');
  fireEvent.click(within(portion).getByText(meal));
  fireEvent.click(within(portion).getByText(/^Add \d/));
};

describe('the coach page', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('says the day is blank rather than inventing one', () => {
    onboard();
    const sheet = openCoach();
    expect(within(sheet).getByText(/blank\s*page until you put something in it/)).toBeDefined();

    fireEvent.click(within(sheet).getByText('Habits'));
    expect(within(sheet).getByText(/Nothing to read yet/)).toBeDefined();

    fireEvent.click(within(sheet).getByText('Progress'));
    expect(within(sheet).getByText(/Five logged days/)).toBeDefined();
  });

  it('reads today back once something is logged, with feedback on the meal', () => {
    onboard();
    logFood('Greek yogurt');

    const sheet = openCoach();
    expect(within(sheet).getByText(/of 2,200/)).toBeDefined();
    expect(within(sheet).getAllByText('Lunch').length).toBeGreaterThan(0);
    expect(within(sheet).getByText(/% of the day/)).toBeDefined();
  });

  it('needs a week before it will touch your targets', () => {
    onboard();
    logFood('Greek yogurt');
    const sheet = openCoach();
    fireEvent.click(within(sheet).getByText('Progress'));
    expect(within(sheet).getByText(/A week of logged days makes this meaningful/)).toBeDefined();
  });

  it('offers tips only with the evidence attached', () => {
    onboard();
    const sheet = openCoach();
    fireEvent.click(within(sheet).getByText('Ideas'));
    expect(within(sheet).getByText(/Log a couple of days/)).toBeDefined();
    expect(within(sheet).getByText('no logged days yet')).toBeDefined();
    // Groceries wait for real days too.
    expect(within(sheet).getByText(/Three logged days in the last week/)).toBeDefined();
  });
});

describe('the chat half', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  const ask = (sheet, prompt) => {
    fireEvent.click(within(sheet).getByText(prompt));
    return new Promise((resolve) => setTimeout(resolve, 600));
  };

  it('refuses to predict progress it cannot support', async () => {
    onboard();
    const sheet = openCoach();
    fireEvent.click(within(sheet).getByText('Ask'));
    await ask(sheet, 'Am I on track?');
    expect(within(sheet).getByText(/rather say nothing than guess/)).toBeDefined();
  });

  it('has nothing to say about habits from an empty diary', async () => {
    onboard();
    const sheet = openCoach();
    fireEvent.click(within(sheet).getByText('Ask'));
    await ask(sheet, 'What are my habits?');
    expect(within(sheet).getByText(/diary is empty, so I can’t see any patterns/)).toBeDefined();
  });

  it('names the chains it actually ships figures for', async () => {
    onboard();
    const sheet = openCoach();
    fireEvent.click(within(sheet).getByText('Ask'));
    await ask(sheet, 'Eating out — what fits?');
    expect(within(sheet).getByText(/only chains I ship figures for/)).toBeDefined();
  });
});

describe('reading a nutrition label', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  const openLabel = () => {
    fireEvent.click(screen.getByText('Log'));
    fireEvent.click(screen.getByText('Label'));
    return dialogFor('Read a nutrition label');
  };

  it('parses a panel you paste in and says what it could not find', () => {
    onboard();
    const sheet = openLabel();
    expect(within(sheet).getByText(/reads text, not pixels/)).toBeDefined();

    fireEvent.change(within(sheet).getByLabelText('Nutrition panel'), {
      target: { value: 'Energy 250kcal\nProtein 8.5g' },
    });
    expect(within(sheet).getByText('Calories')).toBeDefined();
    expect(within(sheet).getByText(/Couldn’t find carbohydrates, fat/)).toBeDefined();
  });

  it('turns a full panel into one of your foods', () => {
    onboard();
    const sheet = openLabel();
    fireEvent.click(within(sheet).getByText(/Use an example panel/));
    fireEvent.change(within(sheet).getByLabelText('Food name'), { target: { value: 'Granola' } });
    expect(within(sheet).getByText('per 100 g')).toBeDefined();
    fireEvent.click(within(sheet).getByText('Save as my food'));

    // It lands in the catalogue as one of yours.
    const add = dialogFor('Add food');
    fireEvent.change(within(add).getByLabelText(/Search/i), { target: { value: 'Granola' } });
    expect(within(add).getAllByText('Granola').length).toBeGreaterThan(0);
  });

  it('will not save a panel with no calories in it', () => {
    onboard();
    const sheet = openLabel();
    fireEvent.change(within(sheet).getByLabelText('Nutrition panel'), { target: { value: 'Protein 8.5g' } });
    fireEvent.change(within(sheet).getByLabelText('Food name'), { target: { value: 'Mystery' } });
    expect(within(sheet).getByText(/calorie figure is the one thing it can’t do without/)).toBeDefined();
    expect(within(sheet).getByText('Save as my food').closest('button').disabled).toBe(true);
  });
});

describe('healthier swaps on a food', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('offers alternatives with the reason next to them', () => {
    onboard();
    fireEvent.click(screen.getByText('Log'));
    fireEvent.click(screen.getAllByText('Search')[0]);
    const sheet = dialogFor('Add food');
    fireEvent.change(within(sheet).getByLabelText(/Search/i), { target: { value: 'crisps' } });
    fireEvent.click(within(sheet).getAllByText(/crisps/i)[0]);

    const portion = dialogFor('How much?');
    expect(within(portion).getByText('Similar, but better on paper')).toBeDefined();
    expect(within(portion).getAllByText(/more protein|more fibre|less saturated fat|less sugar/).length).toBeGreaterThan(0);
  });
});
