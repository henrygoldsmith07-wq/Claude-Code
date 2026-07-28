import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
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

const planFirstDinner = (name = 'Coconut Chickpea Curry') => {
  fireEvent.click(screen.getAllByText('+ Dinner')[0]);
  fireEvent.click(within(dialogFor('Plan a meal')).getByText(name));
};

const openPlan = () => fireEvent.click(screen.getByText('Plan'));

describe('the weekly planner', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('walks forwards and back through the weeks', () => {
    onboard();
    openPlan();
    expect(screen.getByText('This week')).toBeDefined();

    fireEvent.click(screen.getByLabelText('Next week'));
    expect(screen.getAllByText(/^Week of /).length).toBeGreaterThan(0);
    expect(screen.getByText('Today')).toBeDefined(); // the way back

    fireEvent.click(screen.getByText('Today'));
    expect(screen.getByText('This week')).toBeDefined();
  });

  it('counts and costs only the range you are looking at', () => {
    onboard();
    openPlan();
    planFirstDinner();
    expect(screen.getByText(/1 meal planned/)).toBeDefined();

    // Next week is a different range, so it reads as empty.
    fireEvent.click(screen.getByLabelText('Next week'));
    expect(screen.getByText(/Tap any slot to plan a meal/)).toBeDefined();
  });

  it('downloads the planned week for a calendar', () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:calendar');
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    try {
      onboard();
      openPlan();
      planFirstDinner();
      fireEvent.click(screen.getByRole('button', { name: 'Add week to calendar' }));

      expect(createObjectURL).toHaveBeenCalled();
      expect(click).toHaveBeenCalled();
      expect(screen.getByRole('status').textContent).toMatch(/1 meal exported/);
    } finally {
      createObjectURL.mockRestore();
      revokeObjectURL.mockRestore();
      click.mockRestore();
    }
  });
});

describe('rearranging the plan', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('moves a meal to another slot by dragging it', () => {
    onboard();
    openPlan();
    planFirstDinner();

    const meal = screen.getByText('Coconut Chickpea Curry').closest('[draggable]');
    fireEvent.dragStart(meal);
    fireEvent.drop(screen.getAllByText('+ Lunch')[1]); // Tuesday lunch

    // Still one meal, and Monday's dinner slot is free again.
    expect(screen.getByText(/1 meal planned/)).toBeDefined();
    expect(screen.getAllByText('+ Dinner').length).toBe(7);
    expect(screen.getAllByText('+ Lunch').length).toBe(6);
  });

  it('picks a meal up by its grip and puts it down on a tap', () => {
    onboard();
    openPlan();
    planFirstDinner();

    fireEvent.click(screen.getByLabelText('Move Coconut Chickpea Curry'));
    expect(screen.getByText(/Moving Coconut Chickpea Curry/)).toBeDefined();

    fireEvent.click(screen.getAllByText('+ Dinner')[2]); // Wednesday
    expect(screen.queryByText(/Moving Coconut/)).toBeNull();
    expect(screen.getByText(/1 meal planned/)).toBeDefined();
    expect(screen.getAllByText('+ Dinner').length).toBe(6);
  });

  it('swaps rather than losing a meal when the target is taken', () => {
    onboard();
    openPlan();
    planFirstDinner('Coconut Chickpea Curry');
    fireEvent.click(screen.getAllByText('+ Dinner')[0]); // now Tuesday's, the first empty one
    fireEvent.click(within(dialogFor('Plan a meal')).getByText('Teriyaki Salmon Bowls'));
    expect(screen.getByText(/2 meals planned/)).toBeDefined();

    const curry = screen.getByText('Coconut Chickpea Curry').closest('[draggable]');
    fireEvent.dragStart(curry);
    fireEvent.drop(screen.getByText('Teriyaki Salmon Bowls'));

    expect(screen.getByText('Coconut Chickpea Curry')).toBeDefined();
    expect(screen.getByText('Teriyaki Salmon Bowls')).toBeDefined();
    expect(screen.getByText(/2 meals planned/)).toBeDefined();
  });
});

describe('the month view', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('shows a month of days and opens one to plan it', () => {
    onboard();
    openPlan();
    fireEvent.click(screen.getByText('Month'));
    expect(screen.getByText(/Nothing planned this month yet/)).toBeDefined();

    // Every day of the month is a button; the 15th is always one of them.
    fireEvent.click(screen.getByText('15'));
    const sheet = [...document.querySelectorAll('[role="dialog"]')].pop();
    expect(within(sheet).getAllByText('Nothing planned yet').length).toBe(3);

    fireEvent.click(within(sheet).getByText('Dinner'));
    fireEvent.click(within(dialogFor('Plan a meal')).getByText('Coconut Chickpea Curry'));
    expect(screen.getByText(/1 meal planned/)).toBeDefined();
  });

  it('steps between months', () => {
    onboard();
    openPlan();
    fireEvent.click(screen.getByText('Month'));
    const label = screen.getByText(/\d{4}$/).textContent;
    fireEvent.click(screen.getByLabelText('Next month'));
    expect(screen.getAllByText(/\d{4}$/)[0].textContent).not.toBe(label);
  });
});

describe('leftovers and batch cooking', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('offers a batch plan when the same dish is planned twice', () => {
    onboard();
    openPlan();
    planFirstDinner();
    fireEvent.click(screen.getAllByText('+ Dinner')[0]);
    fireEvent.click(within(dialogFor('Plan a meal')).getByText('Coconut Chickpea Curry'));

    expect(screen.getByText('Batch cooking')).toBeDefined();
    expect(screen.getByText(/covering 1 more meal/)).toBeDefined();
  });

  it('keeps leftovers in the fridge and off the shopping list', () => {
    onboard();
    // Cook the curry and save what's left.
    fireEvent.click(screen.getByText('Recipes'));
    fireEvent.click(screen.getAllByText('Coconut Chickpea Curry')[0]);
    fireEvent.click(screen.getByText(/Start cooking mode/));
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByText(/Next ›/));
    fireEvent.click(screen.getByText(/Finish & log meal/));
    fireEvent.click(screen.getByText(/Save 3 portions for later/));
    expect(screen.getByText('3 portions in the fridge')).toBeDefined();
    fireEvent.click(screen.getByText('Back to my day'));

    openPlan();
    expect(screen.getByText('Leftovers')).toBeDefined();
    expect(screen.getByText(/3 portions · best by/)).toBeDefined();

    planFirstDinner();
    expect(screen.getByText(/1 planned meal already covered/)).toBeDefined();

    // The list skips a dish the fridge already covers.
    fireEvent.click(screen.getByText(/Send this week's ingredients to the list/));
    fireEvent.click(screen.getByText('Shop'));
    expect(screen.queryByText('Chickpeas (tins)')).toBeNull();
  });

  it('eats a portion at a time', () => {
    onboard();
    fireEvent.click(screen.getByText('Recipes'));
    fireEvent.click(screen.getAllByText('Coconut Chickpea Curry')[0]);
    fireEvent.click(screen.getByText(/Start cooking mode/));
    for (let i = 0; i < 4; i += 1) fireEvent.click(screen.getByText(/Next ›/));
    fireEvent.click(screen.getByText(/Finish & log meal/));
    fireEvent.click(screen.getByLabelText('Decrease'));
    fireEvent.click(screen.getByText(/Save 2 portions for later/));
    fireEvent.click(screen.getByText('Back to my day'));

    openPlan();
    fireEvent.click(screen.getByText('Ate one'));
    expect(screen.getByText(/1 portion · best by/)).toBeDefined();
    fireEvent.click(screen.getByText('Ate one'));
    expect(screen.queryByText('Leftovers')).toBeNull();
  });
});

describe('scheduling a recipe from its page', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('puts it in the plan on the day you choose', () => {
    onboard();
    fireEvent.click(screen.getByText('Recipes'));
    fireEvent.click(screen.getAllByText('Coconut Chickpea Curry')[0]);
    fireEvent.click(screen.getByText('Add to my plan'));
    const card = screen.getByText('Schedule').closest('.card');
    fireEvent.click(within(card).getByText('Tomorrow'));
    fireEvent.click(within(card).getByText('Lunch'));
    fireEvent.click(within(card).getByText('Put it in the plan'));
    expect(screen.getByText(/Planned for lunch on/)).toBeDefined();

    // And it is there on the day you chose.
    fireEvent.click(screen.getByLabelText('Close'));
    openPlan();
    expect(screen.getByText(/1 meal planned/)).toBeDefined();
  });
});

describe('cooking for a family', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('adds people, sums their portions and pools their diets', () => {
    onboard();
    fireEvent.click(screen.getByText('Profile'));
    fireEvent.click(screen.getByText('Just you'));

    const sheet = dialogFor('Family');
    fireEvent.change(within(sheet).getByLabelText('New household member'), { target: { value: 'Alex' } });
    fireEvent.click(within(sheet).getByText('Add'));
    fireEvent.change(within(sheet).getByLabelText('New household member'), { target: { value: 'Robin' } });
    fireEvent.click(within(sheet).getByText('Add'));
    expect(within(sheet).getByText(/2 people · 2 portions a meal/)).toBeDefined();

    // Robin is vegetarian, so every plan for the table now is.
    fireEvent.click(within(sheet).getAllByText('Vegetarian')[1]);
    expect(within(sheet).getByText(/Plans avoid: vegetarian/)).toBeDefined();

    fireEvent.click(within(sheet).getByLabelText('Close'));
    openPlan();
    fireEvent.click(screen.getAllByText('+ Dinner')[0]);
    const picker = dialogFor('Plan a meal');
    expect(within(picker).getByText(/that fit your diet/)).toBeDefined();
    expect(within(picker).queryByText('Lemon Chicken Traybake')).toBeNull();
  });
});
