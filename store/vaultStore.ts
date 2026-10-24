import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { seedGoal, seedObligations, seedPayPeriod, seedSpends } from '@/data/seed';
import type {
  Obligation,
  PaydayWaterfall,
  PayPeriod,
  SpendBucket,
  SpendEntry,
  VaultState,
} from '@/types';

interface VaultActions {
  hydrateDemoIfEmpty: () => void;
  markSaveCompleted: (done: boolean) => void;
  toggleObligationPaid: (id: string) => void;
  addSpend: (amount: number, bucket: SpendBucket, note: string) => void;
  resetDemo: () => void;
}

type Store = VaultState & VaultActions;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function money(n: number): string {
  return n.toLocaleString('en-US', { style: 'currency', currency: 'USD' });
}

export function obligationTypeLabel(type: Obligation['type']): string {
  switch (type) {
    case 'credit_card':
      return 'Credit card';
    case 'insurance':
      return 'Insurance';
    case 'rent':
      return 'Rent';
    case 'loan':
      return 'Loan';
    case 'cash_app_payback':
      return 'Cash App payback';
    case 'subscription':
      return 'Subscription';
  }
}

export function bucketLabel(bucket: SpendBucket): string {
  switch (bucket) {
    case 'needs':
      return 'Needs';
    case 'wants':
      return 'Wants';
    case 'eating_out':
      return 'Eating out';
    case 'other':
      return 'Other';
  }
}

export function selectNextDue(obligations: Obligation[]): Obligation | null {
  const unpaid = obligations.filter((o) => !o.paid);
  if (unpaid.length === 0) return null;
  return [...unpaid].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
}

export function selectTodaySpend(spends: SpendEntry[]): number {
  const today = todayIso();
  return spends
    .filter((s) => s.at.slice(0, 10) === today)
    .reduce((sum, s) => sum + s.amount, 0);
}

export function selectPeriodSpend(spends: SpendEntry[], period: PayPeriod): number {
  return spends
    .filter((s) => {
      const day = s.at.slice(0, 10);
      return day >= period.start && day <= period.end;
    })
    .reduce((sum, s) => sum + s.amount, 0);
}

/**
 * Local/virtual payday waterfall (no bank):
 * 1) obligations due this period → 2) save-first → 3) remainder = discretionary pot
 */
export function computePaydayWaterfall(
  period: PayPeriod,
  obligations: Obligation[]
): PaydayWaterfall {
  const paycheckAmount = Math.max(0, period.paycheckAmount ?? 0);
  const due = obligations.filter(
    (o) => o.dueDate >= period.start && o.dueDate <= period.end
  );
  const obligationsDue = due.reduce((sum, o) => sum + o.amount, 0);

  let remaining = paycheckAmount;
  const obligSlice = Math.min(obligationsDue, remaining);
  remaining -= obligSlice;

  const saveWanted = Math.max(0, period.saveTarget);
  const saveSlice = Math.min(saveWanted, remaining);
  remaining -= saveSlice;

  const discretionary = remaining;
  const spokenFor = obligSlice + saveSlice;
  const shortfall = Math.max(0, obligationsDue + saveWanted - paycheckAmount);

  return {
    paycheckAmount,
    obligationsDue: obligSlice,
    saveSlice,
    discretionary,
    spokenFor,
    shortfall,
    dueCount: due.length,
  };
}

/** Prefer waterfall remainder; fall back to legacy weeklyAllowance for old local state */
export function selectSpendAllowance(
  period: PayPeriod,
  obligations: Obligation[]
): number {
  if (typeof period.paycheckAmount === 'number' && period.end) {
    return computePaydayWaterfall(period, obligations).discretionary;
  }
  return period.weeklyAllowance ?? 0;
}

function normalizePayPeriod(period: PayPeriod): PayPeriod {
  if (period.end && typeof period.paycheckAmount === 'number') return period;
  return {
    ...seedPayPeriod,
    ...period,
    end: period.end ?? seedPayPeriod.end,
    paycheckAmount: period.paycheckAmount ?? seedPayPeriod.paycheckAmount,
  };
}

export const useVaultStore = create<Store>()(
  persist(
    (set, get) => ({
      payPeriod: seedPayPeriod,
      goal: seedGoal,
      obligations: seedObligations,
      spends: seedSpends,
      hydrated: false,

      hydrateDemoIfEmpty: () => {
        const { obligations, spends, payPeriod } = get();
        if (obligations.length === 0 && spends.length === 0) {
          set({
            payPeriod: seedPayPeriod,
            goal: seedGoal,
            obligations: seedObligations,
            spends: seedSpends,
            hydrated: true,
          });
          return;
        }
        set({ payPeriod: normalizePayPeriod(payPeriod), hydrated: true });
      },

      markSaveCompleted: (done) => {
        const { payPeriod, goal } = get();
        const nextGoal =
          done && !payPeriod.saveCompleted && goal
            ? {
                ...goal,
                currentAmount: Math.min(
                  goal.targetAmount,
                  goal.currentAmount + payPeriod.saveTarget
                ),
              }
            : !done && payPeriod.saveCompleted && goal
              ? {
                  ...goal,
                  currentAmount: Math.max(0, goal.currentAmount - payPeriod.saveTarget),
                }
              : goal;

        set({
          payPeriod: { ...payPeriod, saveCompleted: done },
          goal: nextGoal,
        });
      },

      toggleObligationPaid: (id) => {
        set({
          obligations: get().obligations.map((o) =>
            o.id === id ? { ...o, paid: !o.paid } : o
          ),
        });
      },

      addSpend: (amount, bucket, note) => {
        const entry: SpendEntry = {
          id: `sp-${Date.now()}`,
          amount,
          bucket,
          note: note.trim() || bucketLabel(bucket),
          at: new Date().toISOString(),
        };
        set({ spends: [entry, ...get().spends] });
      },

      resetDemo: () => {
        set({
          payPeriod: { ...seedPayPeriod, saveCompleted: false },
          goal: { ...seedGoal },
          obligations: seedObligations.map((o) => ({ ...o })),
          spends: seedSpends.map((s) => ({ ...s })),
        });
      },
    }),
    {
      name: 'vaultline-local-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        payPeriod: s.payPeriod,
        goal: s.goal,
        obligations: s.obligations,
        spends: s.spends,
      }),
      onRehydrateStorage: () => (state) => {
        state?.hydrateDemoIfEmpty();
      },
    }
  )
);
