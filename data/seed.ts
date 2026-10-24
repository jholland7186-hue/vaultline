import type {
  IncomeProfile,
  Obligation,
  PayCadence,
  PayPeriod,
  SavingsGoal,
  SpendEntry,
} from '@/types';

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Days in one pay period for a given paycheck cadence */
export function periodLengthDays(cadence: PayCadence): number {
  switch (cadence) {
    case 'weekly':
      return 7;
    case 'biweekly':
      return 14;
    case 'semi_monthly':
      return 15;
    case 'monthly':
      return 30;
  }
}

export function periodBoundsForCadence(cadence: PayCadence): { start: string; end: string } {
  const days = periodLengthDays(cadence);
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  start.setDate(start.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(end.getDate() + days - 1);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

/**
 * Sample income — weekly like Justin. Fake number for the explore-demo path;
 * “Start fresh” clears this so he enters real take-home. Waterfall uses income
 * as the period inflow (not a hard-coded $2400).
 */
export const seedIncome: IncomeProfile = {
  amountPerPaycheck: 980,
  cadence: 'weekly',
};

/** Empty weekly shell for real planning — Justin fills amount + save + bills */
export const freshIncome: IncomeProfile = {
  amountPerPaycheck: 0,
  cadence: 'weekly',
};

const bounds = periodBoundsForCadence(seedIncome.cadence);

export const seedPayPeriod: PayPeriod = {
  start: bounds.start,
  end: bounds.end,
  paycheckAmount: seedIncome.amountPerPaycheck,
  saveTarget: 100,
  saveCompleted: false,
};

export function makeFreshPayPeriod(income: IncomeProfile = freshIncome): PayPeriod {
  const b = periodBoundsForCadence(income.cadence);
  return {
    start: b.start,
    end: b.end,
    paycheckAmount: Math.max(0, income.amountPerPaycheck),
    saveTarget: 0,
    saveCompleted: false,
  };
}

export const seedGoal: SavingsGoal = {
  name: 'Back-to-school fund',
  targetAmount: 2500,
  currentAmount: 680,
};

export const seedObligations: Obligation[] = [
  {
    id: 'ob-cc',
    name: 'Chase card minimum',
    amount: 125,
    type: 'credit_card',
    dueDate: isoDaysFromNow(3),
    scheduledPayOn: isoDaysFromNow(2),
    cadence: 'monthly',
    paid: false,
  },
  {
    id: 'ob-ins',
    name: 'Auto insurance',
    amount: 148,
    type: 'insurance',
    dueDate: isoDaysFromNow(9),
    scheduledPayOn: isoDaysFromNow(7),
    cadence: 'monthly',
    paid: false,
  },
  {
    id: 'ob-rent',
    name: 'Rent',
    amount: 1100,
    type: 'rent',
    dueDate: isoDaysFromNow(12),
    scheduledPayOn: isoDaysFromNow(10),
    cadence: 'monthly',
    paid: false,
  },
  {
    id: 'ob-loan',
    name: 'Personal loan',
    amount: 210,
    type: 'loan',
    dueDate: isoDaysFromNow(6),
    scheduledPayOn: isoDaysFromNow(5),
    cadence: 'monthly',
    paid: false,
  },
  {
    id: 'ob-cashapp',
    name: 'Cash App payback — Sam',
    amount: 60,
    type: 'cash_app_payback',
    dueDate: isoDaysFromNow(1),
    scheduledPayOn: isoDaysFromNow(0),
    cadence: 'once',
    paid: false,
  },
  {
    id: 'ob-sub',
    name: 'Spotify',
    amount: 11.99,
    type: 'subscription',
    dueDate: isoDaysFromNow(4),
    scheduledPayOn: null,
    cadence: 'monthly',
    paid: true,
  },
  /**
   * Split example: phone bill paid in two partials (amounts + own pay-on dates).
   * Total matches obligation amount.
   */
  {
    id: 'ob-tmobile',
    name: 'T-Mobile',
    amount: 140,
    type: 'subscription',
    dueDate: isoDaysFromNow(8),
    scheduledPayOn: null,
    cadence: 'monthly',
    paid: false,
    installments: [
      {
        id: 'ob-tmobile-p1',
        amount: 70,
        scheduledPayOn: isoDaysFromNow(1),
        paid: false,
      },
      {
        id: 'ob-tmobile-p2',
        amount: 70,
        scheduledPayOn: isoDaysFromNow(8),
        paid: false,
      },
    ],
  },
];

export const seedSpends: SpendEntry[] = [
  {
    id: 'sp-1',
    amount: 18.5,
    bucket: 'eating_out',
    note: 'Lunch taco truck',
    at: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
  },
  {
    id: 'sp-2',
    amount: 42,
    bucket: 'needs',
    note: 'Groceries top-up',
    at: new Date(Date.now() - 1000 * 60 * 60 * 26).toISOString(),
  },
  {
    id: 'sp-3',
    amount: 24.99,
    bucket: 'wants',
    note: 'Impulse checkout',
    at: new Date(Date.now() - 1000 * 60 * 60 * 30).toISOString(),
  },
];
