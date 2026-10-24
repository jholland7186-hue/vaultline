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
import type { Cadence, Obligation, ObligationType } from '@/types';
import {
  money,
  obligationTypeLabel,
  selectPaymentSchedule,
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
  return new Date().toISOString().slice(0, 10);
}

function scheduleLine(o: Obligation): string {
  if (o.scheduledPayOn) {
    return `Pay on ${o.scheduledPayOn} · due ${o.dueDate}`;
  }
  return `Not scheduled · due ${o.dueDate}`;
}

export default function ObligationsScreen() {
  const obligations = useVaultStore((s) => s.obligations);
  const toggleObligationPaid = useVaultStore((s) => s.toggleObligationPaid);
  const setObligationScheduledPayOn = useVaultStore((s) => s.setObligationScheduledPayOn);
  const updateObligation = useVaultStore((s) => s.updateObligation);
  const addObligation = useVaultStore((s) => s.addObligation);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editPayOn, setEditPayOn] = useState('');
  const [editDue, setEditDue] = useState('');

  const [showAdd, setShowAdd] = useState(false);
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [type, setType] = useState<ObligationType>('subscription');
  const [cadence, setCadence] = useState<Cadence>('monthly');
  const [dueDate, setDueDate] = useState(todayIso());
  const [payOn, setPayOn] = useState('');

  const schedule = useMemo(() => selectPaymentSchedule(obligations), [obligations]);
  const allSorted = useMemo(
    () => [...obligations].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [obligations]
  );

  const openEdit = (o: Obligation) => {
    setEditingId(o.id);
    setEditPayOn(o.scheduledPayOn ?? '');
    setEditDue(o.dueDate);
  };

  const saveEdit = () => {
    if (!editingId) return;
    updateObligation(editingId, {
      dueDate: editDue.trim() || todayIso(),
      scheduledPayOn: editPayOn.trim() || null,
    });
    setEditingId(null);
  };

  const clearPayOn = (id: string) => {
    setObligationScheduledPayOn(id, null);
    if (editingId === id) setEditPayOn('');
  };

  const submitAdd = () => {
    const n = Number.parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n <= 0 || !name.trim()) return;
    addObligation({
      name,
      amount: n,
      type,
      cadence,
      dueDate: dueDate.trim() || todayIso(),
      scheduledPayOn: payOn.trim() || null,
    });
    setName('');
    setAmount('');
    setPayOn('');
    setDueDate(todayIso());
    setShowAdd(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Due</Text>
        <Text style={styles.sub}>
          Plan when you’ll pay — local schedule only, not bank autopay. Mark paid when the money
          leaves.
        </Text>

        <Text style={styles.section}>Payment schedule</Text>
        <Text style={styles.sectionHint}>
          Upcoming unpaid bills sorted by pay-on (or due if not scheduled).
        </Text>

        {schedule.length === 0 ? (
          <Text style={styles.empty}>Nothing unpaid — schedule is clear.</Text>
        ) : (
          schedule.map((o, i) => (
            <View key={`sched-${o.id}`} style={styles.schedRow}>
              <Text style={styles.schedIndex}>{i + 1}</Text>
              <View style={styles.schedBody}>
                <View style={styles.rowTop}>
                  <Text style={styles.name}>{o.name}</Text>
                  <Text style={styles.amount}>{money(o.amount)}</Text>
                </View>
                <Text style={styles.meta}>
                  {obligationTypeLabel(o.type)} · {scheduleLine(o)}
                </Text>
              </View>
            </View>
          ))
        )}

        <Text style={[styles.section, { marginTop: 20 }]}>All obligations</Text>

        {allSorted.map((o) => {
          const isEditing = editingId === o.id;
          return (
            <View key={o.id} style={[styles.row, o.paid && styles.rowPaid]}>
              <Pressable onPress={() => toggleObligationPaid(o.id)}>
                <View style={styles.rowTop}>
                  <Text style={[styles.name, o.paid && styles.struck]}>{o.name}</Text>
                  <Text style={[styles.amount, o.paid && styles.struck]}>{money(o.amount)}</Text>
                </View>
                <Text style={styles.meta}>
                  {obligationTypeLabel(o.type)} · {o.cadence} · due {o.dueDate}
                </Text>
                <Text style={styles.payOnMeta}>
                  {o.scheduledPayOn
                    ? `Scheduled pay-on ${o.scheduledPayOn}`
                    : 'No pay-on date set'}
                </Text>
                <Text style={[styles.status, o.paid ? styles.paid : styles.unpaid]}>
                  {o.paid ? 'Paid' : 'Unpaid — tap to mark paid'}
                </Text>
              </Pressable>

              {!o.paid ? (
                <View style={styles.editActions}>
                  <Pressable onPress={() => (isEditing ? setEditingId(null) : openEdit(o))}>
                    <Text style={styles.link}>
                      {isEditing ? 'Cancel' : 'Set / edit pay-on'}
                    </Text>
                  </Pressable>
                  {o.scheduledPayOn ? (
                    <Pressable onPress={() => clearPayOn(o.id)}>
                      <Text style={styles.linkMuted}>Clear schedule</Text>
                    </Pressable>
                  ) : null}
                </View>
              ) : null}

              {isEditing ? (
                <View style={styles.editBox}>
                  <Text style={styles.label}>Due date (YYYY-MM-DD)</Text>
                  <TextInput
                    value={editDue}
                    onChangeText={setEditDue}
                    placeholder="2026-10-30"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  <Text style={styles.label}>Pay on (YYYY-MM-DD)</Text>
                  <TextInput
                    value={editPayOn}
                    onChangeText={setEditPayOn}
                    placeholder="When you plan to pay"
                    placeholderTextColor={Colors.textMuted}
                    autoCapitalize="none"
                    style={styles.input}
                  />
                  <Pressable onPress={saveEdit} style={styles.primaryBtn}>
                    <Text style={styles.primaryBtnText}>Save dates</Text>
                  </Pressable>
                </View>
              ) : null}
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
              placeholder="e.g. Netflix"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>Amount</Text>
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
            <Text style={styles.label}>Scheduled pay-on (optional)</Text>
            <TextInput
              value={payOn}
              onChangeText={setPayOn}
              placeholder="YYYY-MM-DD — when you plan to pay"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />
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
  paid: { color: Colors.success },
  unpaid: { color: Colors.copper },
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
});
