import * as ImagePicker from 'expo-image-picker';
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
import {
  isInLookbackThroughToday,
  planningLookbackStart,
  planningWindowLabel,
  todayIsoDate,
} from '@/lib/planningWindow';
import { stubParseScreenshot } from '@/lib/screenshotParse';
import type { LookbackMonths, ObligationType, PayCadence, SpendBucket } from '@/types';
import {
  bucketLabel,
  money,
  obligationTypeLabel,
  payCadenceLabel,
  selectLookbackSpend,
  selectPeriodSpend,
  selectSpendAllowance,
  useVaultStore,
} from '@/store/vaultStore';

const LOOKBACK_OPTIONS: LookbackMonths[] = [1, 2];

const BUCKETS: SpendBucket[] = ['needs', 'wants', 'eating_out', 'other'];
const PAY_CADENCES: PayCadence[] = ['weekly', 'biweekly', 'semi_monthly', 'monthly'];
const BILL_TYPES: ObligationType[] = [
  'subscription',
  'credit_card',
  'insurance',
  'rent',
  'loan',
  'cash_app_payback',
];

export default function SpendScreen() {
  const spends = useVaultStore((s) => s.spends);
  const income = useVaultStore((s) => s.income);
  const payPeriod = useVaultStore((s) => s.payPeriod);
  const obligations = useVaultStore((s) => s.obligations);
  const lookbackMonths = useVaultStore((s) => s.lookbackMonths);
  const addSpend = useVaultStore((s) => s.addSpend);
  const addObligation = useVaultStore((s) => s.addObligation);
  const setIncome = useVaultStore((s) => s.setIncome);
  const setLookbackMonths = useVaultStore((s) => s.setLookbackMonths);
  const startFresh = useVaultStore((s) => s.startFresh);
  const loadDemo = useVaultStore((s) => s.loadDemo);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [bucket, setBucket] = useState<SpendBucket>('wants');
  const [spendDay, setSpendDay] = useState(todayIsoDate());
  const [dateHint, setDateHint] = useState<string | null>(null);

  const [showIncome, setShowIncome] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState(String(income.amountPerPaycheck || ''));
  const [incomeCadence, setIncomeCadence] = useState<PayCadence>(income.cadence);

  const [shotUri, setShotUri] = useState<string | null>(null);
  const [shotName, setShotName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [cAmount, setCAmount] = useState('');
  const [cMerchant, setCMerchant] = useState('');
  const [cBucket, setCBucket] = useState<SpendBucket>('wants');
  const [cHint, setCHint] = useState('');
  const [looksLikeBill, setLooksLikeBill] = useState(false);
  const [billType, setBillType] = useState<ObligationType>('subscription');
  const [alsoObligation, setAlsoObligation] = useState(false);

  const spendPot = useMemo(
    () => selectSpendAllowance(payPeriod, obligations),
    [payPeriod, obligations]
  );
  const periodSpend = useMemo(
    () => selectPeriodSpend(spends, payPeriod),
    [spends, payPeriod]
  );
  const lookbackSpend = useMemo(
    () => selectLookbackSpend(spends, lookbackMonths),
    [spends, lookbackMonths]
  );
  const lookbackStart = planningLookbackStart(lookbackMonths);

  const totals = useMemo(() => {
    const map: Record<SpendBucket, number> = {
      needs: 0,
      wants: 0,
      eating_out: 0,
      other: 0,
    };
    for (const s of spends) {
      const day = s.at.slice(0, 10);
      if (day >= lookbackStart && day <= todayIsoDate()) map[s.bucket] += s.amount;
    }
    return map;
  }, [spends, lookbackStart]);

  const submit = () => {
    const n = Number.parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return;
    const day = spendDay.trim() || todayIsoDate();
    if (!isInLookbackThroughToday(day, lookbackMonths)) {
      setDateHint(`Use a date from ${lookbackStart} through today to catch up.`);
      return;
    }
    setDateHint(null);
    addSpend(n, bucket, note, day);
    setAmount('');
    setNote('');
    setSpendDay(todayIsoDate());
  };

  const openIncome = () => {
    setIncomeAmount(income.amountPerPaycheck > 0 ? String(income.amountPerPaycheck) : '');
    setIncomeCadence(income.cadence);
    setShowIncome(true);
  };

  const saveIncome = () => {
    const n = Number.parseFloat(incomeAmount.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return;
    setIncome(n, incomeCadence);
    setShowIncome(false);
  };

  const applyGuess = (fileName?: string | null) => {
    const guess = stubParseScreenshot({ fileName, pastedText });
    setCAmount(guess.amount != null ? String(guess.amount) : '');
    setCMerchant(guess.merchant);
    setCBucket(guess.bucket);
    setCHint(guess.confidenceNote);
    setLooksLikeBill(guess.looksLikeBill);
    setAlsoObligation(guess.looksLikeBill);
    if (guess.suggestedObligationType) setBillType(guess.suggestedObligationType);
    setConfirmOpen(true);
  };

  const pickScreenshot = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    setShotUri(asset.uri);
    setShotName(asset.fileName ?? 'screenshot');
    applyGuess(asset.fileName ?? 'screenshot');
  };

  const runStubOnPaste = () => {
    applyGuess(shotName || null);
  };

  const confirmScreenshotSpend = () => {
    const n = Number.parseFloat(cAmount.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return;
    const merchant = cMerchant.trim() || 'Screenshot spend';
    addSpend(n, cBucket, merchant);
    if (alsoObligation && looksLikeBill) {
      const due = new Date();
      due.setDate(due.getDate() + 7);
      addObligation({
        name: merchant,
        amount: n,
        type: billType,
        cadence: 'monthly',
        dueDate: due.toISOString().slice(0, 10),
        scheduledPayOn: null,
      });
    }
    setConfirmOpen(false);
    setShotUri(null);
    setShotName('');
    setPastedText('');
    setAlsoObligation(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Spend</Text>
        <Text style={styles.sub}>
          {planningWindowLabel(lookbackMonths)}. This pay period pot: {money(periodSpend)} of{' '}
          {money(spendPot)} used ({payCadenceLabel(income.cadence).toLowerCase()}{' '}
          {money(income.amountPerPaycheck)}). Lookback logged: {money(lookbackSpend)}. Screenshot
          import is local stub OCR — you always confirm.
        </Text>

        <Text style={styles.label}>Amount</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />

        <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
        <TextInput
          value={spendDay}
          onChangeText={(t) => {
            setSpendDay(t);
            setDateHint(null);
          }}
          placeholder={todayIsoDate()}
          placeholderTextColor={Colors.textMuted}
          autoCapitalize="none"
          style={styles.input}
        />
        <Text style={styles.hint}>
          Backdate within {lookbackStart} → today to catch the ledger up. Defaults to today.
        </Text>
        {dateHint ? <Text style={styles.warn}>{dateHint}</Text> : null}

        <Text style={styles.label}>Bucket</Text>
        <View style={styles.bucketRow}>
          {BUCKETS.map((b) => {
            const active = b === bucket;
            return (
              <Pressable
                key={b}
                onPress={() => setBucket(b)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {bucketLabel(b)}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.label}>Note</Text>
        <TextInput
          value={note}
          onChangeText={setNote}
          placeholder="What was it?"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />

        <Pressable onPress={submit} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>Log spend</Text>
        </Pressable>

        <Text style={[styles.label, { marginTop: 22 }]}>Screenshot → confirm → log</Text>
        <Text style={styles.hint}>
          Pick a bank/receipt image. Optional: paste amount/merchant text to help the stub. No
          Plaid — confirm before anything is saved.
        </Text>
        <Pressable onPress={pickScreenshot} style={styles.secondaryBtn}>
          <Text style={styles.secondaryBtnText}>Choose screenshot</Text>
        </Pressable>
        <Text style={styles.label}>Paste receipt text (optional)</Text>
        <TextInput
          value={pastedText}
          onChangeText={setPastedText}
          placeholder={'$12.34  Taco truck'}
          placeholderTextColor={Colors.textMuted}
          multiline
          style={[styles.input, styles.pasteBox]}
        />
        <Pressable onPress={runStubOnPaste} style={styles.linkWrap}>
          <Text style={styles.link}>Run stub read on pasted text</Text>
        </Pressable>

        {confirmOpen ? (
          <View style={styles.confirmBox}>
            {shotUri ? (
              <Image source={{ uri: shotUri }} style={styles.preview} resizeMode="cover" />
            ) : null}
            <Text style={styles.hint}>{cHint}</Text>
            <Text style={styles.label}>Amount</Text>
            <TextInput
              value={cAmount}
              onChangeText={setCAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>Merchant / note</Text>
            <TextInput
              value={cMerchant}
              onChangeText={setCMerchant}
              placeholder="Where was this?"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>Bucket</Text>
            <View style={styles.bucketRow}>
              {BUCKETS.map((b) => {
                const active = b === cBucket;
                return (
                  <Pressable
                    key={b}
                    onPress={() => setCBucket(b)}
                    style={[styles.chip, active && styles.chipActive]}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {bucketLabel(b)}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
            {looksLikeBill ? (
              <View style={styles.billSuggest}>
                <Pressable onPress={() => setAlsoObligation((v) => !v)}>
                  <Text style={styles.link}>
                    {alsoObligation
                      ? '✓ Also add as obligation (tap to skip)'
                      : 'Looks like a bill — also add as obligation?'}
                  </Text>
                </Pressable>
                {alsoObligation ? (
                  <View style={styles.bucketRow}>
                    {BILL_TYPES.map((t) => {
                      const active = t === billType;
                      return (
                        <Pressable
                          key={t}
                          onPress={() => setBillType(t)}
                          style={[styles.chip, active && styles.chipActive]}
                        >
                          <Text style={[styles.chipText, active && styles.chipTextActive]}>
                            {obligationTypeLabel(t)}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : null}
              </View>
            ) : null}
            <Pressable onPress={confirmScreenshotSpend} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Confirm & log</Text>
            </Pressable>
            <Pressable onPress={() => setConfirmOpen(false)}>
              <Text style={styles.linkMuted}>Cancel</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={[styles.label, { marginTop: 20 }]}>Income & pay schedule</Text>
        <Text style={styles.incomeSummary}>
          {payCadenceLabel(income.cadence)} · {money(income.amountPerPaycheck)} each payday
        </Text>
        <Pressable onPress={() => (showIncome ? setShowIncome(false) : openIncome())}>
          <Text style={styles.link}>
            {showIncome ? 'Cancel' : 'Edit what you make'}
          </Text>
        </Pressable>
        {showIncome ? (
          <View style={styles.incomeBox}>
            <Text style={styles.hint}>
              Take-home per payday. Waterfall uses it as period inflow — practical numbers only.
            </Text>
            <Text style={styles.label}>Amount per payday</Text>
            <TextInput
              value={incomeAmount}
              onChangeText={setIncomeAmount}
              keyboardType="decimal-pad"
              placeholder="0.00"
              placeholderTextColor={Colors.textMuted}
              style={styles.input}
            />
            <Text style={styles.label}>Pay schedule</Text>
            <View style={styles.bucketRow}>
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

        <Text style={[styles.label, { marginTop: 20 }]}>Planning lookback</Text>
        <Text style={styles.hint}>
          How far back you can enter bills and spends through today. Default is 2 months.
        </Text>
        <View style={styles.bucketRow}>
          {LOOKBACK_OPTIONS.map((m) => {
            const active = m === lookbackMonths;
            return (
              <Pressable
                key={m}
                onPress={() => setLookbackMonths(m)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {m} month{m === 1 ? '' : 's'}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.incomeSummary}>{planningWindowLabel(lookbackMonths)}</Text>

        <Text style={[styles.label, { marginTop: 20 }]}>Bucket glance (lookback)</Text>
        <View style={styles.glance}>
          {BUCKETS.map((b) => (
            <Text key={b} style={styles.glanceLine}>
              {bucketLabel(b)} · {money(totals[b])}
            </Text>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 20 }]}>Recent</Text>
        {spends.length === 0 ? (
          <Text style={styles.hint}>No spends yet — log one or confirm a screenshot.</Text>
        ) : (
          spends.slice(0, 12).map((s) => (
            <View key={s.id} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{s.note}</Text>
                <Text style={styles.rowMeta}>
                  {bucketLabel(s.bucket)} · {s.at.slice(0, 10)}
                </Text>
              </View>
              <Text style={styles.rowAmount}>{money(s.amount)}</Text>
            </View>
          ))
        )}

        <Pressable onPress={startFresh} style={styles.resetBtn}>
          <Text style={styles.resetText}>Start fresh with my numbers</Text>
        </Pressable>
        <Pressable onPress={loadDemo} style={styles.resetBtn}>
          <Text style={styles.resetText}>Reload sample week</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.sand },
  scroll: { padding: 24, paddingBottom: 48, gap: 8 },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.forest,
    letterSpacing: -0.5,
  },
  sub: { fontSize: 15, color: Colors.textSecondary, marginBottom: 12, lineHeight: 22 },
  label: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.copper,
  },
  input: {
    backgroundColor: Colors.cream,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    color: Colors.text,
  },
  pasteBox: { minHeight: 72, textAlignVertical: 'top' },
  bucketRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cream,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
  },
  chipActive: { backgroundColor: Colors.forest, borderColor: Colors.forest },
  chipText: { fontSize: 13, fontWeight: '600', color: Colors.textSecondary },
  chipTextActive: { color: Colors.cream },
  primaryBtn: {
    marginTop: 12,
    backgroundColor: Colors.forest,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryBtnText: { color: Colors.cream, fontWeight: '700', fontSize: 15 },
  secondaryBtn: {
    marginTop: 6,
    borderWidth: 1,
    borderColor: Colors.forest,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    backgroundColor: Colors.cream,
  },
  secondaryBtnText: { color: Colors.forest, fontWeight: '700', fontSize: 15 },
  incomeSummary: { fontSize: 14, color: Colors.textSecondary },
  linkWrap: { marginTop: 4 },
  link: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.forestMuted,
    textDecorationLine: 'underline',
    marginTop: 4,
  },
  linkMuted: {
    marginTop: 10,
    fontSize: 13,
    fontWeight: '600',
    color: Colors.textMuted,
    textDecorationLine: 'underline',
    textAlign: 'center',
  },
  incomeBox: {
    marginTop: 8,
    gap: 6,
    padding: 14,
    backgroundColor: Colors.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmBox: {
    marginTop: 10,
    gap: 6,
    padding: 14,
    backgroundColor: Colors.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  preview: {
    width: '100%',
    height: 140,
    borderRadius: 12,
    backgroundColor: Colors.sandDark,
    marginBottom: 6,
  },
  billSuggest: { marginTop: 6, gap: 8 },
  hint: { fontSize: 13, lineHeight: 18, color: Colors.textMuted },
  warn: { fontSize: 13, lineHeight: 18, color: Colors.danger, fontWeight: '600' },
  glance: { gap: 4 },
  glanceLine: { fontSize: 14, color: Colors.textSecondary },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  rowTitle: { fontSize: 15, fontWeight: '600', color: Colors.text },
  rowMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  rowAmount: { fontSize: 15, fontWeight: '700', color: Colors.copper },
  resetBtn: { marginTop: 16, alignSelf: 'center', padding: 8 },
  resetText: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline' },
});
