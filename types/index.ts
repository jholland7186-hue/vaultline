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
  /**
   * ISO date Justin plans to pay (local schedule — not bank autopay).
   * Null/undefined = not scheduled yet.
   */
  scheduledPayOn?: string | null;
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
  /** ISO date period start (payday) */
  start: string;
  /** ISO date period end (inclusive) */
  end: string;
  /** Gross paycheck / cash for this period (local virtual — no bank) */
  paycheckAmount: number;
  saveTarget: number;
  saveCompleted: boolean;
  /**
   * Legacy discretionary override. Prefer waterfall remainder when present;
   * kept for older persisted local state.
   */
  weeklyAllowance?: number;
}

/** Local payday allocation — no bank API */
export interface PaydayWaterfall {
  paycheckAmount: number;
  obligationsDue: number;
  saveSlice: number;
  discretionary: number;
  spokenFor: number;
  shortfall: number;
  dueCount: number;
}

export interface VaultState {
  payPeriod: PayPeriod;
  goal: SavingsGoal | null;
  obligations: Obligation[];
  spends: SpendEntry[];
  hydrated: boolean;
}
