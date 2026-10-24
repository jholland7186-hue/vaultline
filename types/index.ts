export type ObligationType =
  | 'credit_card'
  | 'insurance'
  | 'rent'
  | 'loan'
  | 'cash_app_payback'
  | 'subscription';

export type SpendBucket = 'needs' | 'wants' | 'eating_out' | 'other';

export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'once';

export interface Obligation {
  id: string;
  name: string;
  amount: number;
  type: ObligationType;
  /** ISO date for next/this due */
  dueDate: string;
  cadence: Cadence;
  paid: boolean;
}

export interface SpendEntry {
  id: string;
  amount: number;
  bucket: SpendBucket;
  note: string;
  /** ISO datetime */
  at: string;
}

export interface SavingsGoal {
  name: string;
  targetAmount: number;
  currentAmount: number;
}

export interface PayPeriod {
  /** ISO date period start */
  start: string;
  saveTarget: number;
  saveCompleted: boolean;
  weeklyAllowance: number;
}

export interface VaultState {
  payPeriod: PayPeriod;
  goal: SavingsGoal | null;
  obligations: Obligation[];
  spends: SpendEntry[];
  hydrated: boolean;
}
