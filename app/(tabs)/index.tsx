import { Link } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import { planningWindowLabel } from '@/lib/planningWindow';
import type { PayCadence } from '@/types';
import {
  computePaydayWaterfall,
  money,
  obligationTypeLabel,
  payCadenceLabel,
  selectNextDue,
  selectNextScheduled,
  selectPeriodSpend,
  selectTodaySpend,
  unpaidAmount,
  useVaultStore,
} from '@/store/vaultStore';

const PAY_CADENCES: PayCadence[] = ['weekly', 'biweekly', 'semi_monthly', 'monthly'];

export default function HomeScreen() {
  const income = useVaultStore((s) => s.income);
  const payPeriod = useVaultStore((s) => s.payPeriod);
  const goal = useVaultStore((s) => s.goal);
  const obligations = useVaultStore((s) => s.obligations);
  const spends = useVaultStore((s) => s.spends);
  const lookbackMonths = useVaultStore((s) => s.lookbackMonths);
  const setupComplete = useVaultStore((s) => s.setupComplete);
  const markSaveCompleted = useVaultStore((s) => s.markSaveCompleted);
  const setIncome = useVaultStore((s) => s.setIncome);
  const setSaveTarget = useVaultStore((s) => s.setSaveTarget);
  const setGoal = useVaultStore((s) => s.setGoal);
  const completeSetup = useVaultStore((s) => s.completeSetup);
  const loadDemo = useVaultStore((s) => s.loadDemo);
  const startFresh = useVaultStore((s) => s.startFresh);

  const [editingIncome, setEditingIncome] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState(
    income.amountPerPaycheck > 0 ? String(income.amountPerPaycheck) : ''
  );
  const [incomeCadence, setIncomeCadence] = useState<PayCadence>(income.cadence);

  const [editingSave, setEditingSave] = useState(false);
  const [saveAmount, setSaveAmount] = useState(
    payPeriod.saveTarget > 0 ? String(payPeriod.saveTarget) : ''
  );

  const [editingGoal, setEditingGoal] = useState(false);
  const [goalName, setGoalName] = useState(goal?.name ?? '');
  const [goalTarget, setGoalTarget] = useState(
    goal?.targetAmount ? String(goal.targetAmount) : ''
  );
  const [goalCurrent, setGoalCurrent] = useState(
    goal?.currentAmount ? String(goal.currentAmount) : '0'
  );

  const waterfall = useMemo(
    () => computePaydayWaterfall(payPeriod, obligations),
    [payPeriod, obligations]
  );
  const nextDue = selectNextDue(obligations);
  const nextScheduled = selectNextScheduled(obligations);
  const showNextScheduled =
    !!nextScheduled &&
    !!nextScheduled.scheduledPayOn &&
    (!nextDue || nextScheduled.obligationId !== nextDue.id);
  const todaySpend = selectTodaySpend(spends);
  const periodSpend = selectPeriodSpend(spends, payPeriod);
  const freeLeft = Math.max(0, waterfall.discretionary - periodSpend);
  const goalPct =
    goal && goal.targetAmount > 0
      ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
      : 0;

  const needsSetup = !setupComplete || income.amountPerPaycheck <= 0;

  const openIncomeEdit = () => {
    setIncomeAmount(income.amountPerPaycheck > 0 ? String(income.amountPerPaycheck) : '');
    setIncomeCadence(income.cadence);
    setEditingIncome(true);
  };

  const saveIncome = () => {
    const n = Number.parseFloat(incomeAmount.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return;
    setIncome(n, incomeCadence);
    setEditingIncome(false);
  };

  const saveSaveTarget = () => {
    const n = Number.parseFloat(saveAmount.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n < 0) return;
    setSaveTarget(n);
    setEditingSave(false);
  };

  const saveGoalForm = () => {
    const target = Number.parseFloat(goalTarget.replace(/[^0-9.]/g, ''));
    const current = Number.parseFloat(goalCurrent.replace(/[^0-9.]/g, '')) || 0;
    if (!goalName.trim() || !Number.isFinite(target) || target <= 0) return;
    setGoal({ name: goalName, targetAmount: target, currentAmount: current });
    setEditingGoal(false);
  };

  const finishWithMyNumbers = () => {
    const n = Number.parseFloat(incomeAmount.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(n) && n > 0) {
      setIncome(n, incomeCadence);
    } else if (income.amountPerPaycheck <= 0) {
      return;
    }
    const saveN = Number.parseFloat(saveAmount.replace(/[^0-9.]/g, ''));
    if (Number.isFinite(saveN) && saveN >= 0) setSaveTarget(saveN);
    if (goalName.trim()) {
      const target = Number.parseFloat(goalTarget.replace(/[^0-9.]/g, ''));
      const current = Number.parseFloat(goalCurrent.replace(/[^0-9.]/g, '')) || 0;
      if (Number.isFinite(target) && target > 0) {
        setGoal({ name: goalName, targetAmount: target, currentAmount: current });
      }
    }
    completeSetup();
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.brandRow}>
          <Image
            source={require('../../assets/images/icon.png')}
            style={styles.logo}
          />
          <View>
            <Text style={styles.brand}>Vaultline</Text>
            <Text style={styles.tagline}>Save first. See what’s due.</Text>
            <Text style={styles.windowLine}>{planningWindowLabel(lookbackMonths)}</Text>
          </View>
        </View>

        {needsSetup ? (
          <View style={styles.setupBox}>
            <Text style={styles.kicker}>Your numbers</Text>
            <Text style={styles.title}>Plan with what you actually make</Text>
            <Text style={styles.body}>
              Enter take-home and how often you’re paid. Catch up {lookbackMonths} month
              {lookbackMonths === 1 ? '' : 's'} of bills and spends through today on Due / Spend —
              waterfall still uses this pay period for spoken-for vs free.
            </Text>

            <Text style={styles.label}>Take-home each payday</Text>
            <TextInput
              value={incomeAmount}
              onChangeText={setIncomeAmount}
              keyboardType="decimal-pad"
              placeholder="e.g. 980"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>Pay schedule</Text>
            <View style={styles.chipRow}>
              {PAY_CADENCES.map((c) => {
                const active = c === incomeCadence;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setIncomeCadence(c)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {payCadenceLabel(c)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <Text style={styles.label}>Save-first this period (optional)</Text>
            <TextInput
              value={saveAmount}
              onChangeText={setSaveAmount}
              keyboardType="decimal-pad"
              placeholder="e.g. 100"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />

            <Text style={styles.label}>Primary goal name (optional)</Text>
            <TextInput
              value={goalName}
              onChangeText={setGoalName}
              placeholder="e.g. Back-to-school fund"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>Goal target · already saved</Text>
            <View style={styles.rowInputs}>
              <TextInput
                value={goalTarget}
                onChangeText={setGoalTarget}
                keyboardType="decimal-pad"
                placeholder="2500"
                placeholderTextColor={Colors.textMuted}
                style={[styles.input, styles.halfInput]}
              />
              <TextInput
                value={goalCurrent}
                onChangeText={setGoalCurrent}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={Colors.textMuted}
                style={[styles.input, styles.halfInput]}
              />
            </View>

            <Pressable onPress={finishWithMyNumbers} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Continue with my numbers</Text>
            </Pressable>
            <Text style={styles.hint}>
              Next: Due → add rent, cards, phone (split if you pay in parts). Spend → log or
              screenshot. Home updates free-to-spend from your paycheck.
            </Text>
            <Pressable onPress={loadDemo} style={styles.secondaryBtn}>
              <Text style={styles.secondaryBtnText}>Explore a sample week instead</Text>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.block}>
          <Text style={styles.kicker}>Payday waterfall</Text>
          <Text style={styles.title}>
            {money(waterfall.discretionary)}
            <Text style={styles.titleMuted}> free to spend</Text>
          </Text>
          <Text style={styles.body}>
            Spoken for {money(waterfall.spokenFor)} of {money(waterfall.paycheckAmount)} — due{' '}
            {money(waterfall.obligationsDue)}, then save {money(waterfall.saveSlice)}.
            Remainder is the normal spend pot.
          </Text>
          {waterfall.shortfall > 0 ? (
            <Text style={styles.warn}>
              Short {money(waterfall.shortfall)} vs due + save on this paycheck. That’s a planning
              signal — adjust income, bill timing, or save if you need room.
            </Text>
          ) : null}
          <Text style={styles.metaLine}>
            {payCadenceLabel(income.cadence)} take-home {money(income.amountPerPaycheck)} ·{' '}
            {waterfall.dueCount} item{waterfall.dueCount === 1 ? '' : 's'} in {payPeriod.start} →{' '}
            {payPeriod.end}
          </Text>
          <Pressable onPress={() => (editingIncome ? setEditingIncome(false) : openIncomeEdit())}>
            <Text style={styles.linkBtnText}>
              {editingIncome ? 'Cancel' : 'Edit income & pay schedule'}
            </Text>
          </Pressable>
          {editingIncome ? (
            <View style={styles.incomeBox}>
              <Text style={styles.label}>What you take home each payday</Text>
              <TextInput
                value={incomeAmount}
                onChangeText={setIncomeAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
              />
              <Text style={styles.label}>Pay schedule</Text>
              <View style={styles.chipRow}>
                {PAY_CADENCES.map((c) => {
                  const active = c === incomeCadence;
                  return (
                    <Pressable
                      key={c}
                      onPress={() => setIncomeCadence(c)}
                      style={[styles.chip, active && styles.chipActive]}
                    >
                      <Text style={[styles.chipText, active && styles.chipTextActive]}>
                        {payCadenceLabel(c)}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
              <Pressable onPress={saveIncome} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Save income</Text>
              </Pressable>
            </View>
          ) : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.kicker}>This pay period</Text>
          <Text style={styles.title}>
            {payPeriod.saveCompleted ? 'Save-first done' : 'Save before you spend'}
          </Text>
          <Text style={styles.body}>
            Put {money(payPeriod.saveTarget)} in the vault (waterfall slice 2) before tapping into
            the spend pot.
          </Text>
          <Pressable
            onPress={() => {
              setSaveAmount(String(payPeriod.saveTarget || ''));
              setEditingSave((v) => !v);
            }}
          >
            <Text style={styles.linkBtnText}>
              {editingSave ? 'Cancel' : 'Edit save-first amount'}
            </Text>
          </Pressable>
          {editingSave ? (
            <View style={styles.incomeBox}>
              <TextInput
                value={saveAmount}
                onChangeText={setSaveAmount}
                keyboardType="decimal-pad"
                placeholder="0.00"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
              />
              <Pressable onPress={saveSaveTarget} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Save amount</Text>
              </Pressable>
            </View>
          ) : null}
          <Pressable
            onPress={() => markSaveCompleted(!payPeriod.saveCompleted)}
            style={[
              styles.primaryBtn,
              payPeriod.saveCompleted && styles.primaryBtnDone,
            ]}
          >
            <Text
              style={[
                styles.primaryBtnText,
                payPeriod.saveCompleted && styles.primaryBtnTextDone,
              ]}
            >
              {payPeriod.saveCompleted
                ? `Saved ${money(payPeriod.saveTarget)} ✓`
                : `Mark ${money(payPeriod.saveTarget)} saved`}
            </Text>
          </Pressable>
          {goal ? (
            <View style={styles.goalLine}>
              <View style={styles.goalMeta}>
                <Text style={styles.goalName}>{goal.name}</Text>
                <Text style={styles.goalAmounts}>
                  {money(goal.currentAmount)} of {money(goal.targetAmount)}
                </Text>
              </View>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${goalPct}%` }]} />
              </View>
            </View>
          ) : (
            <Text style={styles.metaLine}>No primary goal yet — optional, when you’re ready.</Text>
          )}
          <Pressable
            onPress={() => {
              setGoalName(goal?.name ?? '');
              setGoalTarget(goal?.targetAmount ? String(goal.targetAmount) : '');
              setGoalCurrent(goal?.currentAmount ? String(goal.currentAmount) : '0');
              setEditingGoal((v) => !v);
            }}
          >
            <Text style={styles.linkBtnText}>
              {editingGoal ? 'Cancel' : goal ? 'Edit goal' : 'Set a primary goal'}
            </Text>
          </Pressable>
          {editingGoal ? (
            <View style={styles.incomeBox}>
              <Text style={styles.label}>Name</Text>
              <TextInput
                value={goalName}
                onChangeText={setGoalName}
                placeholder="Goal name"
                placeholderTextColor={Colors.textMuted}
                style={styles.input}
              />
              <Text style={styles.label}>Target · already saved</Text>
              <View style={styles.rowInputs}>
                <TextInput
                  value={goalTarget}
                  onChangeText={setGoalTarget}
                  keyboardType="decimal-pad"
                  placeholder="2500"
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.input, styles.halfInput]}
                />
                <TextInput
                  value={goalCurrent}
                  onChangeText={setGoalCurrent}
                  keyboardType="decimal-pad"
                  placeholder="0"
                  placeholderTextColor={Colors.textMuted}
                  style={[styles.input, styles.halfInput]}
                />
              </View>
              <Pressable onPress={saveGoalForm} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Save goal</Text>
              </Pressable>
              {goal ? (
                <Pressable onPress={() => { setGoal(null); setEditingGoal(false); }}>
                  <Text style={styles.linkMuted}>Clear goal</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.kicker}>Next due</Text>
          {nextDue ? (
            <>
              <Text style={styles.title}>{nextDue.name}</Text>
              <Text style={styles.body}>
                {money(unpaidAmount(nextDue))}
                {hasSplit(nextDue) ? ` left of ${money(nextDue.amount)}` : ''} ·{' '}
                {obligationTypeLabel(nextDue.type)} · due {nextDue.dueDate}
              </Text>
              {showNextScheduled ? (
                <Text style={styles.metaLine}>
                  Next scheduled: {nextScheduled.name}
                  {nextScheduled.splitLabel ? ` (${nextScheduled.splitLabel})` : ''} · pay on{' '}
                  {nextScheduled.scheduledPayOn}
                </Text>
              ) : null}
              <Link href="/obligations" asChild>
                <Pressable style={styles.linkBtn}>
                  <Text style={styles.linkBtnText}>Payment schedule</Text>
                </Pressable>
              </Link>
            </>
          ) : (
            <>
              <Text style={styles.body}>
                Nothing unpaid yet. Add rent, cards, phone on Due — split a bill if you pay in
                parts.
              </Text>
              <Link href="/obligations" asChild>
                <Pressable style={styles.linkBtn}>
                  <Text style={styles.linkBtnText}>Add obligations</Text>
                </Pressable>
              </Link>
            </>
          )}
        </View>

        <View style={styles.block}>
          <Text style={styles.kicker}>Spend pot</Text>
          <Text style={styles.title}>
            {money(periodSpend)}
            <Text style={styles.titleMuted}>
              {' '}
              / {money(waterfall.discretionary)} this period
            </Text>
          </Text>
          <Text style={styles.body}>
            {money(freeLeft)} left free to spend · today {money(todaySpend)}.
          </Text>
          <Link href="/spend" asChild>
            <Pressable style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>Log or screenshot a spend</Text>
            </Pressable>
          </Link>
        </View>

        {setupComplete ? (
          <View style={styles.footerLinks}>
            <Pressable onPress={startFresh}>
              <Text style={styles.linkMuted}>Start fresh with my numbers</Text>
            </Pressable>
            <Pressable onPress={loadDemo}>
              <Text style={styles.linkMuted}>Reload sample week</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function hasSplit(o: { installments?: unknown[] }): boolean {
  return Array.isArray(o.installments) && o.installments.length > 0;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.sand },
  scroll: { padding: 24, paddingBottom: 40, gap: 28 },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 4 },
  logo: { width: 56, height: 56, borderRadius: 14 },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.forest,
    letterSpacing: -0.5,
  },
  tagline: { fontSize: 14, color: Colors.textSecondary, marginTop: 2 },
  windowLine: { fontSize: 12, color: Colors.textMuted, marginTop: 4 },
  block: { gap: 8 },
  setupBox: {
    gap: 8,
    padding: 16,
    backgroundColor: Colors.cream,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.copper,
  },
  title: { fontSize: 22, fontWeight: '700', color: Colors.text, letterSpacing: -0.3 },
  titleMuted: { fontSize: 16, fontWeight: '500', color: Colors.textMuted },
  body: { fontSize: 15, lineHeight: 22, color: Colors.textSecondary },
  warn: { fontSize: 14, lineHeight: 20, color: Colors.danger, fontWeight: '600' },
  metaLine: { fontSize: 13, color: Colors.textMuted },
  hint: { fontSize: 13, lineHeight: 18, color: Colors.textMuted },
  label: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.copper,
  },
  incomeBox: {
    marginTop: 4,
    gap: 6,
    padding: 14,
    backgroundColor: Colors.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  input: {
    backgroundColor: Colors.sand,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 15,
    color: Colors.text,
  },
  rowInputs: { flexDirection: 'row', gap: 8 },
  halfInput: { flex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.sand,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 10,
  },
  chipActive: { backgroundColor: Colors.forest, borderColor: Colors.forest },
  chipText: { fontSize: 12, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.cream },
  primaryBtn: {
    marginTop: 8,
    backgroundColor: Colors.forest,
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  primaryBtnDone: { backgroundColor: Colors.sandDark },
  primaryBtnText: { color: Colors.cream, fontWeight: '700', fontSize: 15 },
  primaryBtnTextDone: { color: Colors.forest },
  secondaryBtn: {
    marginTop: 4,
    paddingVertical: 10,
    alignSelf: 'flex-start',
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.forestMuted,
    textDecorationLine: 'underline',
  },
  goalLine: { marginTop: 14, gap: 8 },
  goalMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: 12,
  },
  goalName: { fontSize: 14, fontWeight: '600', color: Colors.text, flex: 1 },
  goalAmounts: { fontSize: 13, color: Colors.textSecondary },
  track: {
    height: 8,
    borderRadius: 999,
    backgroundColor: Colors.sandDark,
    overflow: 'hidden',
  },
  fill: { height: '100%', backgroundColor: Colors.copper, borderRadius: 999 },
  linkBtn: { marginTop: 6, alignSelf: 'flex-start' },
  linkBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.forestMuted,
    textDecorationLine: 'underline',
  },
  linkMuted: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textDecorationLine: 'underline',
  },
  footerLinks: { gap: 10, alignItems: 'center', marginTop: 8 },
});
