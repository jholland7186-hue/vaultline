import type { Obligation, PayPeriod, SavingsGoal, SpendEntry } from '@/types';

function isoDaysFromNow(days: number): string {
  const d = new Date();
  d.setHours(12, 0, 0, 0);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

function periodStart(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + mondayOffset);
  return d.toISOString().slice(0, 10);
}

export const seedPayPeriod: PayPeriod = {
  start: periodStart(),
  saveTarget: 200,
  saveCompleted: false,
  weeklyAllowance: 150,
};

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
    cadence: 'monthly',
    paid: false,
  },
  {
    id: 'ob-ins',
    name: 'Auto insurance',
    amount: 148,
    type: 'insurance',
    dueDate: isoDaysFromNow(9),
    cadence: 'monthly',
    paid: false,
  },
  {
    id: 'ob-rent',
    name: 'Rent',
    amount: 1100,
    type: 'rent',
    dueDate: isoDaysFromNow(12),
    cadence: 'monthly',
    paid: false,
  },
  {
    id: 'ob-loan',
    name: 'Personal loan',
    amount: 210,
    type: 'loan',
    dueDate: isoDaysFromNow(6),
    cadence: 'monthly',
    paid: false,
  },
  {
    id: 'ob-cashapp',
    name: 'Cash App payback — Sam',
    amount: 60,
    type: 'cash_app_payback',
    dueDate: isoDaysFromNow(1),
    cadence: 'once',
    paid: false,
  },
  {
    id: 'ob-sub',
    name: 'Spotify',
    amount: 11.99,
    type: 'subscription',
    dueDate: isoDaysFromNow(4),
    cadence: 'monthly',
    paid: true,
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
