export type ObligationType =
  | 'credit_card'
  | 'insurance'
  | 'rent'
  | 'loan'
  | 'cash_app_payback'
  | 'subscription';

export type SpendBucket = 'needs' | 'wants' | 'eating_out' | 'other';

/** Obligation recurrence (bills) */
export type Cadence = 'weekly' | 'biweekly' | 'monthly' | 'once';

/**
 * How often a paycheck lands.
 * Justin is weekly; others may differ — waterfall uses amount × this period.
 */
export type PayCadence = 'weekly' | 'biweekly' | 'semi_monthly' | 'monthly';

export interface IncomeProfile {
  /** Take-home (or usable) amount per payday — calm entry, no judgment */
  amountPerPaycheck: number;
  cadence: PayCadence;
}

/** One partial payment toward an obligation (e.g. half of a phone bill) */
export interface PaymentInstallment {
  id: string;
  amount: number;
  /** ISO date Justin plans to pay this slice (local planning — not bank autopay) */
  scheduledPayOn?: string | null;
  paid: boolean;
}

export interface Obligation {
  id: string;
  name: string;
  /** Full obligation amount (sum of installments when split) */
  amount: number;
  type: ObligationType;
  /** ISO date for next/this due */
  dueDate: string;
  /**
   * ISO date Justin plans to pay (local schedule — not bank autopay).
   * Null/undefined = not scheduled yet. Ignored when installments exist
   * (each installment has its own pay-on).
   */
  scheduledPayOn?: string | null;
  cadence: Cadence;
  /**
   * Whole-obligation paid flag. When installments exist, true only if all
   * installments are paid (kept in sync by the store).
   */
  paid: boolean;
  /**
   * Optional split: partial amounts with their own pay-on dates.
   * When present, payment schedule lists each installment; waterfall counts
   * unpaid slices whose pay-on (or parent due) falls in the period.
   */
  installments?: PaymentInstallment[];
}

/** Flattened row for the Due payment schedule (obligation or installment) */
export interface ScheduleItem {
  key: string;
  obligationId: string;
  installmentId?: string;
  name: string;
  amount: number;
  type: ObligationType;
  dueDate: string;
  scheduledPayOn?: string | null;
  paid: boolean;
  /** e.g. "1 of 2" when this row is a split payment */
  splitLabel?: string;
}

export interface SpendEntry {
  id: string;
  amount: number;
  bucket: SpendBucket;
  note: string;
  /** ISO datetime */
  at: string;
}

/**
 * Logged paycheck / deposit for lookback history (not the income profile).
 * Confirmed from screenshot import or manual catch-up — never silent.
 */
export interface IncomeEvent {
  id: string;
  amount: number;
  note: string;
  /** ISO datetime */
  at: string;
  source?: 'manual' | 'screenshot';
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
  /** Gross paycheck / cash for this period (from income profile) */
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

/** How many months of history Justin can enter through today (catch-up) */
export type LookbackMonths = 1 | 2;

export interface VaultState {
  income: IncomeProfile;
  payPeriod: PayPeriod;
  goal: SavingsGoal | null;
  obligations: Obligation[];
  spends: SpendEntry[];
  /** Confirmed paycheck / deposit history for lookback catch-up */
  incomeEvents: IncomeEvent[];
  /**
   * Catch-up lookback: 1 or 2 months ending today.
   * Default 2 — enter past bills/spends to bring the ledger current.
   */
  lookbackMonths: LookbackMonths;
  /**
   * False until Justin finishes first-run (his numbers or “explore sample”).
   * Fresh installs start here so demo data isn’t forced.
   */
  setupComplete: boolean;
  hydrated: boolean;
}
