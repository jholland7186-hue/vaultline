import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import {
  freshIncome,
  makeFreshPayPeriod,
  periodBoundsForCadence,
  periodLengthDays,
  seedGoal,
  seedIncome,
  seedObligations,
  seedPayPeriod,
  seedSpends,
} from '@/data/seed';
import {
  DEFAULT_LOOKBACK_MONTHS,
  forwardGlanceEnd,
  isIsoDay,
  normalizeLookbackMonths,
  planningLookbackStart,
  todayIsoDate,
} from '@/lib/planningWindow';
import type {
  Cadence,
  IncomeProfile,
  LookbackMonths,
  Obligation,
  ObligationType,
  PayCadence,
  PaydayWaterfall,
  PaymentInstallment,
  PayPeriod,
  SavingsGoal,
  ScheduleItem,
  SpendBucket,
  SpendEntry,
  VaultState,
} from '@/types';

export type NewObligationInput = {
  name: string;
  amount: number;
  type: ObligationType;
  dueDate: string;
  scheduledPayOn?: string | null;
  cadence: Cadence;
  /** Optional split into N equal (or custom) installments with pay-on dates */
  installments?: Array<{ amount: number; scheduledPayOn?: string | null }>;
};

interface VaultActions {
  hydrateDemoIfEmpty: () => void;
  markSaveCompleted: (done: boolean) => void;
  setIncome: (amountPerPaycheck: number, cadence: PayCadence) => void;
  setSaveTarget: (amount: number) => void;
  setGoal: (goal: SavingsGoal | null) => void;
  /** 1 or 2 months of catch-up history through today */
  setLookbackMonths: (months: LookbackMonths) => void;
  /** Clear sample data — weekly shell so Justin enters real numbers */
  startFresh: () => void;
  /** Load sample week to explore (not his real plan) */
  loadDemo: () => void;
  completeSetup: () => void;
  toggleObligationPaid: (id: string) => void;
  toggleInstallmentPaid: (obligationId: string, installmentId: string) => void;
  setObligationScheduledPayOn: (id: string, scheduledPayOn: string | null) => void;
  setInstallmentScheduledPayOn: (
    obligationId: string,
    installmentId: string,
    scheduledPayOn: string | null
  ) => void;
  updateObligation: (
    id: string,
    patch: Partial<
      Pick<Obligation, 'name' | 'amount' | 'type' | 'dueDate' | 'scheduledPayOn' | 'cadence'>
    >
  ) => void;
  addObligation: (input: NewObligationInput) => void;
  /**
   * Log a spend. Optional ISO day (YYYY-MM-DD) for catch-up within lookback → today.
   * Defaults to today.
   */
  addSpend: (amount: number, bucket: SpendBucket, note: string, atDay?: string) => void;
  /** Alias for loadDemo — keeps Spend “Reset demo data” working */
  resetDemo: () => void;
}

type Store = VaultState & VaultActions;

function todayIso(): string {
  return todayIsoDate();
}

function isIsoDate(value: string | null | undefined): value is string {
  return isIsoDay(value);
}

function cleanIsoDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const t = value.trim();
  return /^\d{4}-\d{2}-\d{2}$/.test(t) ? t : null;
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

export function payCadenceLabel(cadence: PayCadence): string {
  switch (cadence) {
    case 'weekly':
      return 'Weekly';
    case 'biweekly':
      return 'Every 2 weeks';
    case 'semi_monthly':
      return 'Twice a month';
    case 'monthly':
      return 'Monthly';
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

function hasInstallments(o: Obligation): o is Obligation & { installments: PaymentInstallment[] } {
  return Array.isArray(o.installments) && o.installments.length > 0;
}

function syncObligationPaid(o: Obligation): Obligation {
  if (!hasInstallments(o)) return o;
  const allPaid = o.installments.every((i) => i.paid);
  return { ...o, paid: allPaid };
}

/** Remaining unpaid amount on an obligation (installments or whole) */
export function unpaidAmount(o: Obligation): number {
  if (hasInstallments(o)) {
    return o.installments.filter((i) => !i.paid).reduce((sum, i) => sum + i.amount, 0);
  }
  return o.paid ? 0 : o.amount;
}

/**
 * Amount that counts toward waterfall "due this period" for one obligation.
 * Unpaid only. Split bills contribute installment amounts whose pay-on (else due)
 * falls in the period.
 */
export function periodSpokenForAmount(o: Obligation, period: PayPeriod): number {
  if (hasInstallments(o)) {
    return o.installments
      .filter((i) => {
        if (i.paid) return false;
        const when = i.scheduledPayOn || o.dueDate;
        return when >= period.start && when <= period.end;
      })
      .reduce((sum, i) => sum + i.amount, 0);
  }
  if (o.paid) return 0;
  if (o.dueDate >= period.start && o.dueDate <= period.end) return o.amount;
  return 0;
}

export function selectNextDue(obligations: Obligation[]): Obligation | null {
  const unpaid = obligations.filter((o) => unpaidAmount(o) > 0);
  if (unpaid.length === 0) return null;
  return [...unpaid].sort((a, b) => a.dueDate.localeCompare(b.dueDate))[0] ?? null;
}

/** Sort key for a schedule row: planned pay-on, else due date */
export function scheduleSortKey(item: { scheduledPayOn?: string | null; dueDate: string }): string {
  return item.scheduledPayOn || item.dueDate;
}

/**
 * Upcoming payment schedule — unpaid whole bills and unpaid installments,
 * sorted by pay-on (or due). Local planning only; not bank autopay.
 */
export function selectPaymentSchedule(obligations: Obligation[]): ScheduleItem[] {
  const items: ScheduleItem[] = [];

  for (const o of obligations) {
    if (hasInstallments(o)) {
      const total = o.installments.length;
      o.installments.forEach((inst, idx) => {
        if (inst.paid) return;
        items.push({
          key: `${o.id}:${inst.id}`,
          obligationId: o.id,
          installmentId: inst.id,
          name: o.name,
          amount: inst.amount,
          type: o.type,
          dueDate: o.dueDate,
          scheduledPayOn: inst.scheduledPayOn ?? null,
          paid: false,
          splitLabel: `${idx + 1} of ${total}`,
        });
      });
    } else if (!o.paid) {
      items.push({
        key: o.id,
        obligationId: o.id,
        name: o.name,
        amount: o.amount,
        type: o.type,
        dueDate: o.dueDate,
        scheduledPayOn: o.scheduledPayOn ?? null,
        paid: false,
      });
    }
  }

  return items.sort((a, b) => scheduleSortKey(a).localeCompare(scheduleSortKey(b)));
}

/**
 * Catch-up unpaid items: pay-on/due from lookback start through today.
 * Lets Justin bring the ledger current without only seeing forward dues.
 */
export function selectCatchUpSchedule(
  obligations: Obligation[],
  lookbackMonths: LookbackMonths
): ScheduleItem[] {
  const start = planningLookbackStart(lookbackMonths);
  const today = todayIsoDate();
  return selectPaymentSchedule(obligations).filter((item) => {
    const when = scheduleSortKey(item);
    return when >= start && when <= today;
  });
}

/**
 * Forward glance: unpaid items after today through ~1 month ahead.
 */
export function selectForwardSchedule(obligations: Obligation[]): ScheduleItem[] {
  const today = todayIsoDate();
  const end = forwardGlanceEnd();
  return selectPaymentSchedule(obligations).filter((item) => {
    const when = scheduleSortKey(item);
    return when > today && when <= end;
  });
}

/** Spends logged in the lookback → today catch-up window */
export function selectLookbackSpend(
  spends: SpendEntry[],
  lookbackMonths: LookbackMonths
): number {
  const start = planningLookbackStart(lookbackMonths);
  const today = todayIsoDate();
  return spends
    .filter((s) => {
      const day = s.at.slice(0, 10);
      return day >= start && day <= today;
    })
    .reduce((sum, s) => sum + s.amount, 0);
}

/** Soonest unpaid item that has an explicit scheduled pay-on date */
export function selectNextScheduled(obligations: Obligation[]): ScheduleItem | null {
  const scheduled = selectPaymentSchedule(obligations).filter((i) => !!i.scheduledPayOn);
  if (scheduled.length === 0) return null;
  return (
    [...scheduled].sort((a, b) =>
      (a.scheduledPayOn as string).localeCompare(b.scheduledPayOn as string)
    )[0] ?? null
  );
}

function normalizeObligation(o: Obligation): Obligation {
  const base: Obligation = {
    ...o,
    scheduledPayOn: o.scheduledPayOn ?? null,
  };
  if (Array.isArray(o.installments) && o.installments.length > 0) {
    base.installments = o.installments.map((i) => ({
      ...i,
      scheduledPayOn: i.scheduledPayOn ?? null,
      paid: !!i.paid,
    }));
    return syncObligationPaid(base);
  }
  return base;
}

/**
 * Patch missing seed schedules / splits onto matching seed ids only.
 * Does not inject new demo bills into a personal vault.
 */
function mergeSeedObligations(obligations: Obligation[]): Obligation[] {
  const byId = new Map(seedObligations.map((s) => [s.id, s]));
  return obligations.map((o) => {
    const seed = byId.get(o.id);
    if (!seed) return normalizeObligation(o);

    let next = normalizeObligation(o);
    if (o.scheduledPayOn === undefined && seed.scheduledPayOn !== undefined) {
      next = { ...next, scheduledPayOn: seed.scheduledPayOn };
    }
    if (
      (!o.installments || o.installments.length === 0) &&
      seed.installments &&
      seed.installments.length > 0
    ) {
      next = {
        ...next,
        amount: seed.amount,
        installments: seed.installments.map((i) => ({ ...i })),
        paid: seed.paid,
      };
    }
    return normalizeObligation(next);
  });
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
 * Period inflow comes from income profile → payPeriod.paycheckAmount.
 */
export function computePaydayWaterfall(
  period: PayPeriod,
  obligations: Obligation[]
): PaydayWaterfall {
  const paycheckAmount = Math.max(0, period.paycheckAmount ?? 0);

  let obligationsDue = 0;
  let dueCount = 0;
  for (const o of obligations) {
    const slice = periodSpokenForAmount(o, period);
    if (slice > 0) {
      obligationsDue += slice;
      dueCount += 1;
    }
  }

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
    dueCount,
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

function buildPayPeriodFromIncome(
  income: IncomeProfile,
  prev?: PayPeriod
): PayPeriod {
  const bounds = periodBoundsForCadence(income.cadence);
  let start = bounds.start;
  let end = bounds.end;
  if (prev?.start && isIsoDate(prev.start)) {
    start = prev.start;
    const startDate = new Date(prev.start + 'T12:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + periodLengthDays(income.cadence) - 1);
    end = endDate.toISOString().slice(0, 10);
  }
  return {
    start,
    end,
    paycheckAmount: Math.max(0, income.amountPerPaycheck),
    saveTarget: prev?.saveTarget ?? seedPayPeriod.saveTarget,
    saveCompleted: prev?.saveCompleted ?? false,
  };
}

function normalizeIncome(income: IncomeProfile | undefined): IncomeProfile {
  if (
    income &&
    typeof income.amountPerPaycheck === 'number' &&
    income.cadence
  ) {
    return {
      amountPerPaycheck: Math.max(0, income.amountPerPaycheck),
      cadence: income.cadence,
    };
  }
  return { ...seedIncome };
}

function normalizePayPeriod(period: PayPeriod, income: IncomeProfile): PayPeriod {
  if (period.end && typeof period.paycheckAmount === 'number') {
    return {
      ...period,
      paycheckAmount: income.amountPerPaycheck,
    };
  }
  return buildPayPeriodFromIncome(income, period);
}

function cloneSeedObligations(): Obligation[] {
  return seedObligations.map((o) =>
    normalizeObligation({
      ...o,
      installments: o.installments?.map((i) => ({ ...i })),
    })
  );
}

export const useVaultStore = create<Store>()(
  persist(
    (set, get) => ({
      // Fresh install: empty shell + setup prompt (no forced fake paycheck)
      income: { ...freshIncome },
      payPeriod: makeFreshPayPeriod(freshIncome),
      goal: null,
      obligations: [],
      spends: [],
      lookbackMonths: DEFAULT_LOOKBACK_MONTHS,
      setupComplete: false,
      hydrated: false,

      hydrateDemoIfEmpty: () => {
        const state = get() as Store & {
          income?: IncomeProfile;
          setupComplete?: boolean;
          lookbackMonths?: LookbackMonths;
        };
        const { obligations, spends, payPeriod, income, setupComplete, lookbackMonths } =
          state;
        const nextIncome = normalizeIncome(income ?? freshIncome);
        const nextLookback = normalizeLookbackMonths(lookbackMonths);

        // Brand-new empty vault — stay on setup, do not inject demo
        if (
          obligations.length === 0 &&
          spends.length === 0 &&
          !setupComplete &&
          (nextIncome.amountPerPaycheck <= 0 || !income)
        ) {
          set({
            income: { ...freshIncome },
            payPeriod: makeFreshPayPeriod(freshIncome),
            goal: null,
            obligations: [],
            spends: [],
            lookbackMonths: nextLookback,
            setupComplete: false,
            hydrated: true,
          });
          return;
        }

        set({
          income: nextIncome,
          payPeriod: normalizePayPeriod(payPeriod, nextIncome),
          obligations:
            setupComplete === false && obligations.length === 0
              ? []
              : mergeSeedObligations(obligations),
          lookbackMonths: nextLookback,
          setupComplete: setupComplete ?? nextIncome.amountPerPaycheck > 0,
          hydrated: true,
        });
      },

      setIncome: (amountPerPaycheck, cadence) => {
        const amount = Math.max(0, amountPerPaycheck);
        const income: IncomeProfile = { amountPerPaycheck: amount, cadence };
        const { payPeriod } = get();
        set({
          income,
          payPeriod: buildPayPeriodFromIncome(income, payPeriod),
        });
      },

      setSaveTarget: (amount) => {
        const saveTarget = Math.max(0, amount);
        const { payPeriod } = get();
        set({
          payPeriod: { ...payPeriod, saveTarget, saveCompleted: false },
        });
      },

      setGoal: (goal) => {
        if (!goal) {
          set({ goal: null });
          return;
        }
        const name = goal.name.trim() || 'Savings goal';
        set({
          goal: {
            name,
            targetAmount: Math.max(0, goal.targetAmount),
            currentAmount: Math.max(0, goal.currentAmount),
          },
        });
      },

      setLookbackMonths: (months) => {
        set({ lookbackMonths: normalizeLookbackMonths(months) });
      },

      startFresh: () => {
        const { lookbackMonths } = get();
        set({
          income: { ...freshIncome },
          payPeriod: makeFreshPayPeriod(freshIncome),
          goal: null,
          obligations: [],
          spends: [],
          lookbackMonths: normalizeLookbackMonths(lookbackMonths),
          setupComplete: false,
        });
      },

      loadDemo: () => {
        const { lookbackMonths } = get();
        set({
          income: { ...seedIncome },
          payPeriod: { ...seedPayPeriod, saveCompleted: false },
          goal: { ...seedGoal },
          obligations: cloneSeedObligations(),
          spends: seedSpends.map((s) => ({ ...s })),
          lookbackMonths: normalizeLookbackMonths(lookbackMonths),
          setupComplete: true,
        });
      },

      completeSetup: () => {
        set({ setupComplete: true });
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
          obligations: get().obligations.map((o) => {
            if (o.id !== id) return o;
            if (hasInstallments(o)) {
              const nextPaid = !o.paid;
              return syncObligationPaid({
                ...o,
                paid: nextPaid,
                installments: o.installments.map((i) => ({ ...i, paid: nextPaid })),
              });
            }
            return { ...o, paid: !o.paid };
          }),
        });
      },

      toggleInstallmentPaid: (obligationId, installmentId) => {
        set({
          obligations: get().obligations.map((o) => {
            if (o.id !== obligationId || !hasInstallments(o)) return o;
            const installments = o.installments.map((i) =>
              i.id === installmentId ? { ...i, paid: !i.paid } : i
            );
            return syncObligationPaid({ ...o, installments });
          }),
        });
      },

      setObligationScheduledPayOn: (id, scheduledPayOn) => {
        const cleaned = cleanIsoDate(scheduledPayOn);
        set({
          obligations: get().obligations.map((o) =>
            o.id === id ? { ...o, scheduledPayOn: cleaned } : o
          ),
        });
      },

      setInstallmentScheduledPayOn: (obligationId, installmentId, scheduledPayOn) => {
        const cleaned = cleanIsoDate(scheduledPayOn);
        set({
          obligations: get().obligations.map((o) => {
            if (o.id !== obligationId || !hasInstallments(o)) return o;
            return {
              ...o,
              installments: o.installments.map((i) =>
                i.id === installmentId ? { ...i, scheduledPayOn: cleaned } : i
              ),
            };
          }),
        });
      },

      updateObligation: (id, patch) => {
        set({
          obligations: get().obligations.map((o) => {
            if (o.id !== id) return o;
            const next = { ...o, ...patch };
            if (patch.scheduledPayOn !== undefined) {
              next.scheduledPayOn = cleanIsoDate(patch.scheduledPayOn);
            }
            return next;
          }),
        });
      },

      addObligation: (input) => {
        const name = input.name.trim();
        if (!name || !(input.amount > 0)) return;
        const dueDate = cleanIsoDate(input.dueDate) ?? todayIso();
        const scheduledPayOn = cleanIsoDate(input.scheduledPayOn ?? null);

        let installments: PaymentInstallment[] | undefined;
        if (input.installments && input.installments.length > 0) {
          installments = input.installments
            .filter((i) => i.amount > 0)
            .map((i, idx) => ({
              id: `ob-${Date.now()}-p${idx + 1}`,
              amount: i.amount,
              scheduledPayOn: cleanIsoDate(i.scheduledPayOn ?? null),
              paid: false,
            }));
        }

        const entry: Obligation = {
          id: `ob-${Date.now()}`,
          name,
          amount: input.amount,
          type: input.type,
          dueDate,
          scheduledPayOn: installments?.length ? null : scheduledPayOn,
          cadence: input.cadence,
          paid: false,
          ...(installments?.length ? { installments } : {}),
        };
        set({ obligations: [...get().obligations, entry] });
      },

      addSpend: (amount, bucket, note, atDay) => {
        const day = cleanIsoDate(atDay) ?? todayIso();
        const at = `${day}T12:00:00.000Z`;
        const entry: SpendEntry = {
          id: `sp-${Date.now()}`,
          amount,
          bucket,
          note: note.trim() || bucketLabel(bucket),
          at,
        };
        set({ spends: [entry, ...get().spends] });
      },

      resetDemo: () => {
        get().loadDemo();
      },
    }),
    {
      name: 'vaultline-local-v4',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        income: s.income,
        payPeriod: s.payPeriod,
        goal: s.goal,
        obligations: s.obligations,
        spends: s.spends,
        lookbackMonths: s.lookbackMonths,
        setupComplete: s.setupComplete,
      }),
      onRehydrateStorage: () => (state) => {
        state?.hydrateDemoIfEmpty();
      },
    }
  )
);
