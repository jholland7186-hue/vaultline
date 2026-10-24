import type { IncomeProfile, Obligation, PayPeriod, SavingsGoal, SpendEntry } from '@/types';
import { periodBoundsForIncome, periodLengthDays } from '@/lib/scheduleRules';

export { periodBoundsForIncome, periodLengthDays, periodBoundsForCadence } from '@/lib/scheduleRules';

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Sample income — weekly Thursday like Justin. Fake number for explore-demo;
 * “Start fresh” clears so he enters real take-home. Waterfall uses income
 * as the period inflow (not a hard-coded $2400).
 */
export const seedIncome: IncomeProfile = {
  amountPerPaycheck: 980,
  cadence: 'weekly',
  payWeekday: 4, // Thursday
};

/** Empty weekly shell for real planning — Justin fills amount + schedule + bills */
export const freshIncome: IncomeProfile = {
  amountPerPaycheck: 0,
  cadence: 'weekly',
  payWeekday: 4, // Thursday default
  payMonthDay: null,
  payMonthDay2: null,
  payAnchorDate: null,
};

const bounds = periodBoundsForIncome(seedIncome);

export const seedPayPeriod: PayPeriod = {
  start: bounds.start,
  end: bounds.end,
  paycheckAmount: seedIncome.amountPerPaycheck,
  saveTarget: 100,
  saveCompleted: false,
};

export function makeFreshPayPeriod(income: IncomeProfile = freshIncome): PayPeriod {
  const b = periodBoundsForIncome(income);
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

/** Stable ids used by the explore-sample path — detects leftover sample vaults */
export const SEED_OBLIGATION_IDS = [
  'ob-cc',
  'ob-ins',
  'ob-rent',
  'ob-loan',
  'ob-cashapp',
  'ob-sub',
  'ob-tmobile',
] as const;

export const SEED_SPEND_IDS = ['sp-1', 'sp-2', 'sp-3'] as const;

export function isSampleVault(input: {
  obligations: Array<{ id: string }>;
  spends: Array<{ id: string }>;
  goal: SavingsGoal | null;
}): boolean {
  const seedOb = new Set<string>(SEED_OBLIGATION_IDS);
  const seedSp = new Set<string>(SEED_SPEND_IDS);
  if (input.obligations.some((o) => seedOb.has(o.id))) return true;
  if (input.spends.some((s) => seedSp.has(s.id))) return true;
  if (input.goal?.name === seedGoal.name && input.goal.targetAmount === seedGoal.targetAmount) {
    return true;
  }
  return false;
}

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
