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

const goTab = (label) => fireEvent.click(within(document.querySelector('nav')).getByText(label));

const logFood = (name) => {
  goTab('Log');
  fireEvent.click(screen.getAllByText('+ Add food')[0]);
  const sheet = dialogFor('Add food');
  fireEvent.change(within(sheet).getByLabelText('Search foods'), { target: { value: name } });
  fireEvent.click(within(sheet).getAllByText(new RegExp(name, 'i'))[0]);
  fireEvent.click(within(dialogFor('How much?')).getByText(/Add \d+ kcal to/));
};

const openAdvanced = (tab) => {
  goTab('Profile');
  const section = screen.getByText('Reports & you').closest('section');
  fireEvent.click(within(section).getByText('Advanced'));
  const sheet = dialogFor('Advanced');
  if (tab) fireEvent.click(within(sheet).getByText(tab));
  return sheet;
};

describe('the footprint', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('computes nothing from an empty diary, and says why', () => {
    onboard();
    const sheet = openAdvanced();
    expect(within(sheet).getByText(/it doesn’t estimate a diet for you/)).toBeTruthy();
  });

  it('says what share of your food it could actually place', () => {
    onboard();
    logFood('Chicken breast');
    const sheet = openAdvanced();
    expect(within(sheet).getByText(/kg CO₂e a day/)).toBeTruthy();
    expect(within(sheet).getByText(/of what you logged/)).toBeTruthy();
    expect(within(sheet).getByText(/rather than counted as nothing/)).toBeTruthy();
  });

  it('names its source and its uncertainty rather than presenting a bare figure', () => {
    onboard();
    logFood('Chicken breast');
    const sheet = openAdvanced();
    expect(within(sheet).getByText(/Poore & Nemecek/)).toBeTruthy();
    expect(within(sheet).getByText(/order of magnitude, not a reading/)).toBeTruthy();
  });
});

describe('nutrient gaps', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('will not compute an optimisation off a couple of days', () => {
    onboard();
    const sheet = openAdvanced('Gaps');
    expect(within(sheet).getByText(/5 logged days make this worth computing — you have 0/)).toBeTruthy();
  });
});

describe('fasting', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('offers a window without recommending one', () => {
    onboard();
    const sheet = openAdvanced('Fasting');
    expect(within(sheet).getByText(/A window you chose — Forq isn’t\s+recommending one/)).toBeTruthy();
  });

  it('runs a fast only once you start it, and can end it', () => {
    onboard();
    const sheet = openAdvanced('Fasting');
    expect(within(sheet).getByText('Start a fast')).toBeTruthy();
    fireEvent.click(within(sheet).getByText('Start now'));
    expect(within(sheet).getByText('Fasting now')).toBeTruthy();
    expect(within(sheet).getByText(/0h 00m/)).toBeTruthy();
    fireEvent.click(within(sheet).getByText('End the fast'));
    expect(within(sheet).getByText('Start a fast')).toBeTruthy();
  });

  it('needs nights the diary can bound before calling it a pattern', () => {
    onboard();
    const sheet = openAdvanced('Fasting');
    expect(within(sheet).getByText(/3 nights the diary can bound either side/)).toBeTruthy();
  });
});

describe('results you had taken elsewhere', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('is clear that no lab is being called', () => {
    onboard();
    const sheet = openAdvanced('Results');
    expect(within(sheet).getByText(/No lab has an API a web page can call/)).toBeTruthy();
    expect(within(sheet).queryByText(/Connect your lab/i)).toBeNull();
  });

  it('bands a result you type against its reference range', () => {
    onboard();
    const sheet = openAdvanced('Results');
    fireEvent.change(within(sheet).getByLabelText(/^Ferritin/), { target: { value: '15' } });
    fireEvent.click(within(sheet).getByText('Save this panel'));
    expect(within(sheet).getByText('Below range')).toBeTruthy();
    expect(within(sheet).getByText(/the person who ordered the test can/)).toBeTruthy();
  });

  it('says why there is no CGM connect button, and reads the export instead', () => {
    onboard();
    const sheet = openAdvanced('Results');
    expect(within(sheet).getByText(/Dexcom and Libre have no browser API/)).toBeTruthy();
    fireEvent.change(within(sheet).getByLabelText('Glucose export'), {
      target: {
        value: [
          'Device Timestamp,Historic Glucose mmol/L',
          '28/07/2026 08:00,5.2',
          '28/07/2026 08:15,5.6',
        ].join('\n'),
      },
    });
    fireEvent.click(within(sheet).getByText(/Read it/));
    expect(within(sheet).getByText(/2 readings/)).toBeTruthy();
  });
});

describe('the register of what it will not pretend to do', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  it('names what a browser genuinely cannot do, with the nearest real thing', () => {
    onboard();
    const sheet = openAdvanced('What it can’t');
    fireEvent.click(within(sheet).getAllByText('A browser can’t')[0]);
    expect(within(sheet).getByText('Smart kitchen integration')).toBeTruthy();
    expect(within(sheet).getByText('Healthcare provider access')).toBeTruthy();
    expect(within(sheet).getAllByText(/Instead:/).length).toBeGreaterThan(0);
  });

  it('refuses DNA-based advice and explains, rather than saying coming soon', () => {
    onboard();
    const sheet = openAdvanced('What it can’t');
    fireEvent.click(within(sheet).getAllByText('Deliberately not')[0]);
    expect(within(sheet).getByText('DNA-based nutrition advice')).toBeTruthy();
    expect(within(sheet).getByText(/evidence that does not support them/)).toBeTruthy();
    expect(within(sheet).queryByText(/coming soon/i)).toBeNull();
  });

  it('is honest that the interface is English only', () => {
    onboard();
    const sheet = openAdvanced('What it can’t');
    expect(within(sheet).getByText(/interface is English only/)).toBeTruthy();
  });
});

describe('reading a receipt', () => {
  beforeEach(() => localStorage.clear());
  afterEach(cleanup);

  const openReceipt = () => {
    goTab('Shop');
    fireEvent.click(screen.getAllByText(/Read a receipt/)[0]);
    return dialogFor('Read a receipt');
  };

  it('says plainly that it is not reading the photo', () => {
    onboard();
    const sheet = openReceipt();
    expect(within(sheet).getByText(/ships no OCR/)).toBeTruthy();
    expect(within(sheet).getByText(/the parsing is the part that’s real/)).toBeTruthy();
  });

  it('parses the example and checks itself against the printed total', () => {
    onboard();
    const sheet = openReceipt();
    fireEvent.click(within(sheet).getByText('Example'));
    fireEvent.click(within(sheet).getByText(/Read it/));
    expect(within(sheet).getByText(/5 items · Tesco/)).toBeTruthy();
    expect(within(sheet).getByText('Adds up')).toBeTruthy();
    expect(within(sheet).getByText(/That matches, so the parse is sound/)).toBeTruthy();
  });

  it('puts what it read into the pantry', () => {
    onboard();
    const sheet = openReceipt();
    fireEvent.click(within(sheet).getByText('Example'));
    fireEvent.click(within(sheet).getByText(/Read it/));
    fireEvent.click(within(sheet).getByText(/Add 5 to the pantry/));
    goTab('Shop');
    expect(screen.getAllByText(/BANANAS LOOSE/i).length).toBeGreaterThan(0);
  });
});
