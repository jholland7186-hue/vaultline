import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import {
  forwardGlanceEnd,
  planningLookbackStart,
  planningWindowLabel,
  todayIsoDate,
} from '@/lib/planningWindow';
import type { Cadence, ObligationType, ScheduleItem } from '@/types';
import {
  money,
  obligationTypeLabel,
  selectCatchUpSchedule,
  selectForwardSchedule,
  selectIsSampleVault,
  unpaidAmount,
  useVaultStore,
} from '@/store/vaultStore';

const TYPES: ObligationType[] = [
  'credit_card',
  'insurance',
  'rent',
  'loan',
  'cash_app_payback',
  'subscription',
];

const CADENCES: Cadence[] = ['once', 'weekly', 'biweekly', 'monthly'];

function todayIso(): string {
  return todayIsoDate();
}

function scheduleLine(item: ScheduleItem): string {
  if (item.scheduledPayOn) {
    return `Pay on ${item.scheduledPayOn} · due ${item.dueDate}`;
  }
  return `Not scheduled · due ${item.dueDate}`;
}

export default function ObligationsScreen() {
  const obligations = useVaultStore((s) => s.obligations);
  const lookbackMonths = useVaultStore((s) => s.lookbackMonths);
  const toggleObligationPaid = useVaultStore((s) => s.toggleObligationPaid);
  const toggleInstallmentPaid = useVaultStore((s) => s.toggleInstallmentPaid);
  const setObligationScheduledPayOn = useVaultStore((s) => s.setObligationScheduledPayOn);
  const setInstallmentScheduledPayOn = useVaultStore((s) => s.setInstallmentScheduledPayOn);
  const updateObligation = useVaultStore((s) => s.updateObligation);
  const addObligation = useVaultStore((s) => s.addObligation);
  const removeObligation = useVaultStore((s) => s.removeObligation);
  const startFresh = useVaultStore((s) => s.startFresh);
  const goal = useVaultStore((s) => s.goal);
  const spends = useVaultStore((s) => s.spends);

  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editPayOn, setEditPayOn] = useState('');
  const [editDue, setEditDue] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<ObligationType>('subscription');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [dueDate, setDueDate] = useState(todayIso());
  const [payOn, setPayOn] = useState('');
  const [splitInto, setSplitInto] = useState(1);
  const [splitPayOn2, setSplitPayOn2] = useState('');

  const lookbackStart = planningLookbackStart(lookbackMonths);
  const forwardEnd = forwardGlanceEnd();
  const showingSample = selectIsSampleVault({ obligations, spends, goal });
  const catchUp = useMemo(
    () => selectCatchUpSchedule(obligations, lookbackMonths),
    [obligations, lookbackMonths]
  );
  const upcoming = useMemo(() => selectForwardSchedule(obligations), [obligations]);
  const allSorted = useMemo(
    () => [...obligations].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [obligations]
  );

  const renderScheduleItem = (item: ScheduleItem, i: number) => {
    const isEditing = editingKey === item.key;
    return (
      <View key={item.key} style={styles.schedRow}>
        <Text style={styles.schedIndex}>{i + 1}</Text>
        <View style={styles.schedBody}>
          <Pressable onPress={() => markSchedulePaid(item)}>
            <View style={styles.rowTop}>
              <Text style={styles.name}>
                {item.name}
                {item.splitLabel ? ` · ${item.splitLabel}` : ''}
              </Text>
              <Text style={styles.amount}>{money(item.amount)}</Text>
            </View>
            <Text style={styles.meta}>
              {obligationTypeLabel(item.type)} · {scheduleLine(item)}
            </Text>
            <Text style={styles.statusUnpaid}>Unpaid — tap to mark this payment paid</Text>
          </Pressable>
          <View style={styles.editActions}>
            <Pressable
              onPress={() => (isEditing ? setEditingKey(null) : openEditSchedule(item))}
            >
              <Text style={styles.link}>{isEditing ? 'Cancel' : 'Set / edit pay-on'}</Text>
            </Pressable>
            {item.scheduledPayOn ? (
              <Pressable onPress={() => clearPayOn(item)}>
                <Text style={styles.linkMuted}>Clear schedule</Text>
              </Pressable>
            ) : null}
          </View>
          {isEditing ? (
            <View style={styles.editBox}>
              {!item.installmentId ? (
                <>
                  <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
                  <TextInput
                    value={editDue}
                    onChangeText={setEditDue}
                    placeholder={`${lookbackStart} … ${forwardEnd}`}
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                </>
              ) : null}
              <Text style={styles.label}>Pay on (YYYY-MM-DD)</Text>
              <TextInput
                value={editPayOn}
                onChangeText={setEditPayOn}
                placeholder="When you plan to pay this slice"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="none"
                style={styles.input}
              />
              <Text style={styles.hint}>
                Catch-up: {lookbackStart} → today. Upcoming: through {forwardEnd}.
              </Text>
              <Pressable onPress={() => saveEditSchedule(item)} style={styles.primaryBtn}>
                <Text style={styles.primaryBtnText}>Save dates</Text>
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    );
  };

  const openEditSchedule = (item: ScheduleItem) => {
    setEditingKey(item.key);
    setEditPayOn(item.scheduledPayOn ?? '');
    setEditDue(item.dueDate);
  };

  const saveEditSchedule = (item: ScheduleItem) => {
    if (item.installmentId) {
      setInstallmentScheduledPayOn(item.obligationId, item.installmentId, editPayOn.trim() || null);
    } else {
      updateObligation(item.obligationId, {
        dueDate: editDue.trim() || todayIso(),
        scheduledPayOn: editPayOn.trim() || null,
      });
    }
    setEditingKey(null);
  };

  const clearPayOn = (item: ScheduleItem) => {
    if (item.installmentId) {
      setInstallmentScheduledPayOn(item.obligationId, item.installmentId, null);
    } else {
      setObligationScheduledPayOn(item.obligationId, null);
    }
    if (editingKey === item.key) setEditPayOn('');
  };

  const markSchedulePaid = (item: ScheduleItem) => {
    if (item.installmentId) {
      toggleInstallmentPaid(item.obligationId, item.installmentId);
    } else {
      toggleObligationPaid(item.obligationId);
    }
  };

  const submitAdd = () => {
    const n = Number.parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n <= 0 || !name.trim()) return;

    let installments: Array<{ amount: number; scheduledPayOn?: string | null }> | undefined;
    if (splitInto >= 2) {
      const parts = splitInto;
      const base = Math.floor((n / parts) * 100) / 100;
      installments = [];
      let allocated = 0;
      for (let i = 0; i < parts; i++) {
        const amt = i === parts - 1 ? Math.round((n - allocated) * 100) / 100 : base;
        allocated += amt;
        const when =
          i === 0
            ? payOn.trim() || null
            : i === 1
              ? splitPayOn2.trim() || null
              : null;
        installments.push({ amount: amt, scheduledPayOn: when });
      }
    }

    addObligation({
      name,
      amount: n,
      type,
      cadence,
      dueDate: dueDate.trim() || todayIso(),
      scheduledPayOn: splitInto >= 2 ? null : payOn.trim() || null,
      installments,
    });
    setName('');
    setAmount('');
    setPayOn('');
    setSplitPayOn2('');
    setSplitInto(1);
    setDueDate(todayIso());
    setShowAdd(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Due</Text>
        <Text style={styles.sub}>
          {planningWindowLabel(lookbackMonths)}. Enter past dues/pay-ons to catch up, then mark
          paid. Local schedule only — not bank autopay. Upcoming glance through {forwardEnd}.
        </Text>

        {showingSample ? (
          <View style={styles.sampleBanner}>
            <Text style={styles.sampleTitle}>Sample bills are loaded</Text>
            <Text style={styles.sectionHint}>
              Clear the sample to add your real rent, cards, and phone — or remove one bill at a
              time below.
            </Text>
            <Pressable onPress={startFresh} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Clear sample & start over</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={styles.section}>Catch up (lookback → today)</Text>
        <Text style={styles.sectionHint}>
          Unpaid from {lookbackStart} through today — bring the ledger current. Splits show each
          installment.
        </Text>
        {catchUp.length === 0 ? (
          <Text style={styles.empty}>Nothing unpaid in the lookback window.</Text>
        ) : (
          catchUp.map((item, i) => renderScheduleItem(item, i))
        )}

        <Text style={[styles.section, { marginTop: 20 }]}>Upcoming (~1 month)</Text>
        <Text style={styles.sectionHint}>
          Unpaid after today through {forwardEnd}, sorted by pay-on (or due).
        </Text>
        {upcoming.length === 0 ? (
          <Text style={styles.empty}>Nothing upcoming in the forward glance.</Text>
        ) : (
          upcoming.map((item, i) => renderScheduleItem(item, i))
        )}

        <Text style={[styles.section, { marginTop: 20 }]}>All obligations</Text>

        {allSorted.map((o) => {
          const remaining = unpaidAmount(o);
          const split = o.installments && o.installments.length > 0;
          return (
            <View key={o.id} style={[styles.row, o.paid && styles.rowPaid]}>
              <Pressable onPress={() => toggleObligationPaid(o.id)}>
                <View style={styles.rowTop}>
                  <Text style={[styles.name, o.paid && styles.struck]}>{o.name}</Text>
                  <Text style={[styles.amount, o.paid && styles.struck]}>{money(o.amount)}</Text>
                </View>
                <Text style={styles.meta}>
                  {obligationTypeLabel(o.type)} · {o.cadence} · due {o.dueDate}
                  {split ? ` · split ${o.installments!.length} ways` : ''}
                </Text>
                {split ? (
                  <View style={styles.splitList}>
                    {o.installments!.map((inst, idx) => (
                      <Pressable
                        key={inst.id}
                        onPress={() => toggleInstallmentPaid(o.id, inst.id)}
                        style={styles.splitLine}
                      >
                        <Text
                          style={[styles.splitText, inst.paid && styles.struck]}
                        >
                          {idx + 1}/{o.installments!.length} · {money(inst.amount)}
                          {inst.scheduledPayOn
                            ? ` · pay on ${inst.scheduledPayOn}`
                            : ' · no pay-on'}
                          {inst.paid ? ' · paid' : ' · tap to mark paid'}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                ) : (
                  <Text style={styles.payOnMeta}>
                    {o.scheduledPayOn
                      ? `Scheduled pay-on ${o.scheduledPayOn}`
                      : 'No pay-on date set'}
                  </Text>
                )}
                <Text style={[styles.status, o.paid ? styles.paid : styles.unpaid]}>
                  {o.paid
                    ? 'Paid'
                    : split
                      ? `${money(remaining)} left — tap name to mark all paid`
                      : 'Unpaid — tap to mark paid'}
                </Text>
              </Pressable>
              <Pressable onPress={() => removeObligation(o.id)} style={styles.removeWrap}>
                <Text style={styles.removeText}>Remove</Text>
              </Pressable>
            </View>
          );
        })}

        <Pressable
          onPress={() => setShowAdd((v) => !v)}
          style={[styles.primaryBtn, { marginTop: 16, alignSelf: 'stretch' }]}
        >
          <Text style={styles.primaryBtnText}>
            {showAdd ? 'Close add form' : 'Add obligation'}
          </Text>
        </Pressable>

        {showAdd ? (
          <View style={styles.addBox}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. T-Mobile"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>Amount (full obligation)</Text>
            <TextInput
              value={amount}
              onChangeText={setAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>Type</Text>
            <View style={styles.chipRow}>
              {TYPES.map((t) => {
                const active = t === type;
                return (
                  <Pressable
                    key={t}
                    onPress={() => setType(t)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {obligationTypeLabel(t)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Cadence</Text>
            <View style={styles.chipRow}>
              {CADENCES.map((c) => {
                const active = c === cadence;
                return (
                  <Pressable
                    key={c}
                    onPress={() => setCadence(c)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>{c}</Text>
                  </Pressable>
                );
              })}
            </View>
            <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
            <TextInput
              value={dueDate}
              onChangeText={setDueDate}
              placeholder={todayIso()}
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />
            <Text style={styles.hint}>
              Backdate within {lookbackStart} → today to catch up, or set upcoming through{' '}
              {forwardEnd}.
            </Text>
            <Text style={styles.label}>Split into payments</Text>
            <View style={styles.chipRow}>
              {[1, 2, 3, 4].map((n) => {
                const active = splitInto === n;
                return (
                  <Pressable
                    key={n}
                    onPress={() => setSplitInto(n)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {n === 1 ? 'One payment' : `${n} payments`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {splitInto === 1 ? (
              <>
                <Text style={styles.label}>Scheduled pay-on (optional)</Text>
                <TextInput
                  value={payOn}
                  onChangeText={setPayOn}
                  placeholder="YYYY-MM-DD — when you plan to pay"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  style={styles.input}
                />
              </>
            ) : (
              <>
                <Text style={styles.hint}>
                  Amounts split evenly (last slice gets the leftover cents). Set pay-on dates for
                  the first two slices below.
                </Text>
                <Text style={styles.label}>1st payment pay-on (optional)</Text>
                <TextInput
                  value={payOn}
                  onChangeText={setPayOn}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  style={styles.input}
                />
                <Text style={styles.label}>2nd payment pay-on (optional)</Text>
                <TextInput
                  value={splitPayOn2}
                  onChangeText={setSplitPayOn2}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  style={styles.input}
                />
              </>
            )}
            <Pressable onPress={submitAdd} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Save obligation</Text>
            </Pressable>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.sand },
  scroll: { padding: 24, paddingBottom: 48, gap: 10 },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.forest,
    letterSpacing: -0.5,
  },
  sub: { fontSize: 15, color: Colors.textSecondary, marginBottom: 8, lineHeight: 22 },
  section: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: Colors.copper,
  },
  sectionHint: { fontSize: 13, color: Colors.textMuted, marginBottom: 4, lineHeight: 18 },
  empty: { fontSize: 14, color: Colors.textSecondary, marginBottom: 8 },
  schedRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'flex-start',
    backgroundColor: Colors.cream,
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  schedIndex: {
    width: 22,
    fontSize: 14,
    fontWeight: '700',
    color: Colors.copper,
    marginTop: 2,
  },
  schedBody: { flex: 1, gap: 4 },
  row: {
    backgroundColor: Colors.cream,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 6,
  },
  rowPaid: { opacity: 0.72 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 12 },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: Colors.text },
  amount: { fontSize: 16, fontWeight: '700', color: Colors.copper },
  struck: { textDecorationLine: 'line-through', color: Colors.textMuted },
  meta: { fontSize: 13, color: Colors.textSecondary },
  payOnMeta: { fontSize: 13, color: Colors.forestMuted, fontWeight: '600' },
  status: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  statusUnpaid: { fontSize: 12, fontWeight: '700', marginTop: 2, color: Colors.copper },
  paid: { color: Colors.success },
  unpaid: { color: Colors.copper },
  splitList: { marginTop: 4, gap: 4 },
  splitLine: { paddingVertical: 2 },
  splitText: { fontSize: 13, color: Colors.forestMuted, fontWeight: '600' },
  editActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 14,
    marginTop: 6,
  },
  link: {
    fontSize: 13,
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
  editBox: { marginTop: 8, gap: 6 },
  addBox: {
    marginTop: 4,
    gap: 6,
    padding: 14,
    backgroundColor: Colors.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    marginTop: 6,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.copper,
  },
  hint: { fontSize: 13, lineHeight: 18, color: Colors.textMuted },
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
    marginTop: 10,
    backgroundColor: Colors.forest,
    paddingVertical: 13,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    alignSelf: 'flex-start',
  },
  primaryBtnText: { color: Colors.cream, fontWeight: '700', fontSize: 15 },
  sampleBanner: {
    gap: 6,
    padding: 14,
    marginBottom: 8,
    backgroundColor: Colors.cream,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: Colors.copper,
  },
  sampleTitle: { fontSize: 16, fontWeight: '700', color: Colors.text },
  removeWrap: { marginTop: 8, alignSelf: 'flex-start' },
  removeText: {
    fontSize: 13,
    fontWeight: '700',
    color: Colors.danger,
    textDecorationLine: 'underline',
  },
});
