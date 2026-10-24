import * as ImagePicker from 'expo-image-picker';
import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IncomeScheduleFields } from '@/components/IncomeScheduleFields';
import Colors from '@/constants/colors';
import { extractTextFromUri, isOcrAvailable } from '@/lib/ocr';
import {
  isInLookbackThroughToday,
  planningLookbackStart,
  planningWindowLabel,
  todayIsoDate,
} from '@/lib/planningWindow';
import {
  parseScreenshotText,
  type DetectedKind,
  type DetectedLine,
} from '@/lib/screenshotParse';
import { pickBankStatement } from '@/lib/statementImport';
import type { LookbackMonths, ObligationType, PayCadence, SpendBucket } from '@/types';
import {
  bucketLabel,
  incomeScheduleLabel,
  money,
  obligationTypeLabel,
  payCadenceLabel,
  selectIsSampleVault,
  selectLookbackIncome,
  selectLookbackSpend,
  selectPeriodSpend,
  selectRecentHistory,
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
const KINDS: DetectedKind[] = ['income', 'spend', 'bill'];

function kindLabel(kind: DetectedKind): string {
  switch (kind) {
    case 'income':
      return 'Income';
    case 'spend':
      return 'Spend';
    case 'bill':
      return 'Bill';
  }
}

export default function SpendScreen() {
  const spends = useVaultStore((s) => s.spends);
  const incomeEvents = useVaultStore((s) => s.incomeEvents);
  const income = useVaultStore((s) => s.income);
  const payPeriod = useVaultStore((s) => s.payPeriod);
  const obligations = useVaultStore((s) => s.obligations);
  const lookbackMonths = useVaultStore((s) => s.lookbackMonths);
  const addSpend = useVaultStore((s) => s.addSpend);
  const addIncomeEvent = useVaultStore((s) => s.addIncomeEvent);
  const addObligation = useVaultStore((s) => s.addObligation);
  const setIncome = useVaultStore((s) => s.setIncome);
  const setLookbackMonths = useVaultStore((s) => s.setLookbackMonths);
  const startFresh = useVaultStore((s) => s.startFresh);
  const loadDemo = useVaultStore((s) => s.loadDemo);
  const removeSpend = useVaultStore((s) => s.removeSpend);
  const removeIncomeEvent = useVaultStore((s) => s.removeIncomeEvent);
  const goal = useVaultStore((s) => s.goal);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [bucket, setBucket] = useState<SpendBucket>('wants');
  const [spendDay, setSpendDay] = useState(todayIsoDate());
  const [dateHint, setDateHint] = useState<string | null>(null);

  const [showIncome, setShowIncome] = useState(false);
  const [incomeAmount, setIncomeAmount] = useState(String(income.amountPerPaycheck || ''));
  const [incomeCadence, setIncomeCadence] = useState<PayCadence>(income.cadence);
  const [payWeekday, setPayWeekday] = useState(income.payWeekday ?? 4);
  const [payMonthDay, setPayMonthDay] = useState(
    income.payMonthDay != null ? String(income.payMonthDay) : '1'
  );
  const [payMonthDay2, setPayMonthDay2] = useState(
    income.payMonthDay2 != null ? String(income.payMonthDay2) : '15'
  );
  const [payAnchorDate, setPayAnchorDate] = useState(income.payAnchorDate ?? '');

  const [shotUris, setShotUris] = useState<string[]>([]);
  const [shotName, setShotName] = useState('');
  const [pastedText, setPastedText] = useState('');
  const [ocrNote, setOcrNote] = useState('');
  const [reading, setReading] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [detected, setDetected] = useState<DetectedLine[]>([]);
  const [cHint, setCHint] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [importSource, setImportSource] = useState<'screenshot' | 'statement'>('screenshot');

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
  const lookbackIncome = useMemo(
    () => selectLookbackIncome(incomeEvents ?? [], lookbackMonths),
    [incomeEvents, lookbackMonths]
  );
  const lookbackStart = planningLookbackStart(lookbackMonths);
  const showingSample = selectIsSampleVault({ obligations, spends, goal });
  const recent = useMemo(
    () => selectRecentHistory(spends, incomeEvents ?? [], 14),
    [spends, incomeEvents]
  );

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

  const includedCount = detected.filter((d) => d.included && d.amount != null && d.amount > 0)
    .length;

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
    setPayWeekday(income.payWeekday ?? 4);
    setPayMonthDay(income.payMonthDay != null ? String(income.payMonthDay) : '1');
    setPayMonthDay2(income.payMonthDay2 != null ? String(income.payMonthDay2) : '15');
    setPayAnchorDate(income.payAnchorDate ?? '');
    setShowIncome(true);
  };

  const saveIncome = () => {
    const n = Number.parseFloat(incomeAmount.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return;
    setIncome(n, incomeCadence, {
      payWeekday: incomeCadence === 'weekly' || incomeCadence === 'biweekly' ? payWeekday : null,
      payMonthDay:
        incomeCadence === 'monthly' || incomeCadence === 'semi_monthly'
          ? Number.parseInt(payMonthDay, 10) || 1
          : null,
      payMonthDay2:
        incomeCadence === 'semi_monthly' ? Number.parseInt(payMonthDay2, 10) || 15 : null,
      payAnchorDate: incomeCadence === 'biweekly' ? payAnchorDate.trim() || null : null,
    });
    setShowIncome(false);
  };

  const openReview = (text: string, fileName?: string | null) => {
    const result = parseScreenshotText({ text, fileName });
    setDetected(result.lines);
    setCHint(result.confidenceNote);
    setConfirmError(null);
    setConfirmOpen(true);
  };

  const readUris = async (uris: string[], fileName?: string | null) => {
    setReading(true);
    setOcrNote('');
    try {
      const chunks: string[] = [];
      let usedNative = false;
      for (const uri of uris) {
        const ocr = await extractTextFromUri(uri);
        if (ocr?.source === 'native' && ocr.joined.trim()) {
          chunks.push(ocr.joined);
          usedNative = true;
        }
      }
      const combined = [chunks.join('\n\n'), pastedText].filter(Boolean).join('\n\n');
      if (usedNative) {
        setOcrNote('On-device text read worked. Review the list before anything is saved.');
      } else if (Platform.OS === 'web') {
        setOcrNote('Web can’t read screenshots on-device — paste a few lines or type amounts.');
      } else if (!isOcrAvailable()) {
        setOcrNote(
          'On-device read isn’t in this install yet. Paste history text under the image, or rebuild the APK for OCR.'
        );
      } else {
        setOcrNote('Couldn’t pull text from the image. Paste a few lines — still confirm before save.');
      }
      openReview(combined, fileName);
    } finally {
      setReading(false);
    }
  };

  const pickScreenshots = async () => {
    setImportSource('screenshot');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.8,
      allowsMultipleSelection: true,
      selectionLimit: 6,
    });
    if (result.canceled || !result.assets?.length) return;
    const uris = result.assets.map((a) => a.uri);
    const name = result.assets[0]?.fileName ?? `screenshot×${uris.length}`;
    setShotUris(uris);
    setShotName(name);
    await readUris(uris, name);
  };

  const pickStatement = async () => {
    setImportSource('statement');
    setReading(true);
    setOcrNote('');
    try {
      const picked = await pickBankStatement();
      if (!picked.ok) {
        if (!picked.canceled) setOcrNote(picked.message);
        return;
      }
      setShotName(picked.name);
      if (picked.kind === 'image') {
        setShotUris([picked.uri]);
        await readUris([picked.uri], picked.name);
        return;
      }
      setShotUris([]);
      const combined = [picked.text ?? '', pastedText].filter(Boolean).join('\n\n');
      setOcrNote('Read statement / export text. Review each line before anything is saved.');
      openReview(combined, picked.name);
    } finally {
      setReading(false);
    }
  };

  const captureScreenshot = async () => {
    setImportSource('screenshot');
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      setOcrNote('Camera permission is needed to capture a bank or Cash App screen.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.8,
    });
    if (result.canceled || !result.assets?.[0]) return;
    const asset = result.assets[0];
    const uris = [asset.uri];
    const name = asset.fileName ?? 'camera-capture';
    setShotUris(uris);
    setShotName(name);
    await readUris(uris, name);
  };

  const runOnPaste = () => {
    openReview(pastedText, shotName || null);
  };

  const patchLine = (id: string, patch: Partial<DetectedLine>) => {
    setDetected((rows) => rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  };

  const addBlankLine = () => {
    setDetected((rows) => [
      ...rows,
      {
        id: `dl-manual-${Date.now()}`,
        kind: 'spend',
        amount: null,
        label: '',
        day: todayIsoDate(),
        bucket: 'wants',
        looksLikeBill: false,
        suggestedObligationType: null,
        included: true,
        raw: '',
      },
    ]);
    setConfirmOpen(true);
  };

  const confirmImport = () => {
    const selected = detected.filter((d) => d.included);
    if (selected.length === 0) {
      setConfirmError('Turn on at least one line, or cancel.');
      return;
    }
    let saved = 0;
    for (const line of selected) {
      const n = line.amount;
      if (n == null || !(n > 0)) continue;
      const day = (line.day && isInLookbackThroughToday(line.day, lookbackMonths)
        ? line.day
        : todayIsoDate());
      if (line.day && !isInLookbackThroughToday(line.day, lookbackMonths)) {
        // Soft clamp: still save as today rather than drop the line
      }
      const label = line.label.trim() || (line.kind === 'income' ? 'Paycheck / deposit' : 'Screenshot line');

      if (line.kind === 'income') {
        addIncomeEvent(n, label, day, importSource);
        saved += 1;
        continue;
      }

      addSpend(n, line.bucket, label, day);
      saved += 1;

      if (line.kind === 'bill' || line.looksLikeBill) {
        const due = new Date();
        due.setDate(due.getDate() + 7);
        addObligation({
          name: label,
          amount: n,
          type: line.suggestedObligationType ?? 'subscription',
          cadence: 'monthly',
          dueDate: due.toISOString().slice(0, 10),
          scheduledPayOn: null,
        });
      }
    }

    if (saved === 0) {
      setConfirmError('Add an amount on each line you want to keep, then confirm.');
      return;
    }

    setConfirmOpen(false);
    setShotUris([]);
    setShotName('');
    setPastedText('');
    setDetected([]);
    setConfirmError(null);
    setOcrNote(`Saved ${saved} confirmed line${saved === 1 ? '' : 's'} into your lookback history.`);
  };

  const closeReview = () => {
    setConfirmOpen(false);
    setConfirmError(null);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Spend</Text>
        <Text style={styles.sub}>
          {planningWindowLabel(lookbackMonths)}. This pay period pot: {money(periodSpend)} of{' '}
          {money(spendPot)} used ({payCadenceLabel(income.cadence).toLowerCase()}{' '}
          {money(income.amountPerPaycheck)}). Lookback: {money(lookbackIncome)} in ·{' '}
          {money(lookbackSpend)} out. Screenshot catch-up always asks you to confirm.
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

        {showingSample ? (
          <View style={styles.sampleBanner}>
            <Text style={styles.sampleTitle}>Sample data is loaded</Text>
            <Text style={styles.hint}>
              Clear the sample week before importing your real history — or remove lines one at a
              time below.
            </Text>
            <Pressable onPress={startFresh} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Clear sample & enter my numbers</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={[styles.label, { marginTop: 22 }]}>Import income & spending history</Text>
        <Text style={styles.hint}>
          Screenshot your bank / Cash App / paycheck screens, or upload a statement image / CSV /
          TXT export. On-device read when available — you classify income vs spend, then confirm.
          Nothing silent. PDFs work best as CSV export or page screenshots.
        </Text>
        <View style={styles.shotActions}>
          <Pressable onPress={pickScreenshots} style={styles.secondaryBtn} disabled={reading}>
            <Text style={styles.secondaryBtnText}>Choose screenshot(s)</Text>
          </Pressable>
          <Pressable onPress={captureScreenshot} style={styles.secondaryBtn} disabled={reading}>
            <Text style={styles.secondaryBtnText}>Take photo</Text>
          </Pressable>
          <Pressable onPress={pickStatement} style={styles.secondaryBtn} disabled={reading}>
            <Text style={styles.secondaryBtnText}>Upload statement / CSV</Text>
          </Pressable>
        </View>
        {reading ? (
          <View style={styles.readingRow}>
            <ActivityIndicator color={Colors.forest} />
            <Text style={styles.hint}>Reading…</Text>
          </View>
        ) : null}
        {ocrNote ? <Text style={styles.hint}>{ocrNote}</Text> : null}

        <Text style={styles.label}>Paste history text (optional)</Text>
        <TextInput
          value={pastedText}
          onChangeText={setPastedText}
          placeholder={'$1,240.00  Direct Deposit\n$42.18  DoorDash\n$15.00  Cash App'}
          placeholderTextColor={Colors.textMuted}
          multiline
          style={[styles.input, styles.pasteBox]}
        />
        <Pressable onPress={runOnPaste} style={styles.linkWrap}>
          <Text style={styles.link}>Review pasted lines</Text>
        </Pressable>
        <Pressable onPress={addBlankLine} style={styles.linkWrap}>
          <Text style={styles.link}>Add a blank line to fill in</Text>
        </Pressable>

        {confirmOpen ? (
          <View style={styles.confirmBox}>
            {shotUris[0] ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.previewRow}>
                {shotUris.map((uri) => (
                  <Image key={uri} source={{ uri }} style={styles.preview} resizeMode="cover" />
                ))}
              </ScrollView>
            ) : null}
            <Text style={styles.hint}>{cHint}</Text>
            <Text style={styles.confirmCount}>
              {includedCount} line{includedCount === 1 ? '' : 's'} ready to save
            </Text>

            {detected.map((line) => (
              <View
                key={line.id}
                style={[styles.lineCard, !line.included && styles.lineCardOff]}
              >
                <Pressable onPress={() => patchLine(line.id, { included: !line.included })}>
                  <Text style={styles.link}>
                    {line.included ? '✓ Include' : '○ Skipped — tap to include'}
                  </Text>
                </Pressable>

                <Text style={styles.label}>Type</Text>
                <View style={styles.bucketRow}>
                  {KINDS.map((k) => {
                    const active = line.kind === k;
                    return (
                      <Pressable
                        key={k}
                        onPress={() =>
                          patchLine(line.id, {
                            kind: k,
                            looksLikeBill: k === 'bill',
                            suggestedObligationType:
                              k === 'bill'
                                ? line.suggestedObligationType ?? 'subscription'
                                : null,
                          })
                        }
                        style={[styles.chip, active && styles.chipActive]}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {kindLabel(k)}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.label}>Amount</Text>
                <TextInput
                  value={line.amount != null ? String(line.amount) : ''}
                  onChangeText={(t) => {
                    const n = Number.parseFloat(t.replace(/[^0-9.]/g, ''));
                    patchLine(line.id, {
                      amount: Number.isFinite(n) && n > 0 ? n : null,
                    });
                  }}
                  keyboardType="decimal-pad"
                  placeholder="0.00"
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                />

                <Text style={styles.label}>Label</Text>
                <TextInput
                  value={line.label}
                  onChangeText={(t) => patchLine(line.id, { label: t })}
                  placeholder={line.kind === 'income' ? 'Paycheck / deposit' : 'Merchant or note'}
                  placeholderTextColor={Colors.textMuted}
                  style={styles.input}
                />

                <Text style={styles.label}>Date (YYYY-MM-DD)</Text>
                <TextInput
                  value={line.day ?? ''}
                  onChangeText={(t) => patchLine(line.id, { day: t.trim() || null })}
                  placeholder={todayIsoDate()}
                  placeholderTextColor={Colors.textMuted}
                  autoCapitalize="none"
                  style={styles.input}
                />

                {line.kind !== 'income' ? (
                  <>
                    <Text style={styles.label}>Bucket</Text>
                    <View style={styles.bucketRow}>
                      {BUCKETS.map((b) => {
                        const active = line.bucket === b;
                        return (
                          <Pressable
                            key={b}
                            onPress={() => patchLine(line.id, { bucket: b })}
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {bucketLabel(b)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}

                {line.kind === 'bill' ? (
                  <>
                    <Text style={styles.hint}>
                      Confirming a bill also adds it as an obligation so Due can track it.
                    </Text>
                    <View style={styles.bucketRow}>
                      {BILL_TYPES.map((t) => {
                        const active = (line.suggestedObligationType ?? 'subscription') === t;
                        return (
                          <Pressable
                            key={t}
                            onPress={() =>
                              patchLine(line.id, { suggestedObligationType: t, looksLikeBill: true })
                            }
                            style={[styles.chip, active && styles.chipActive]}
                          >
                            <Text style={[styles.chipText, active && styles.chipTextActive]}>
                              {obligationTypeLabel(t)}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </View>
                  </>
                ) : null}
              </View>
            ))}

            {confirmError ? <Text style={styles.warn}>{confirmError}</Text> : null}

            <Pressable onPress={confirmImport} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>
                Confirm & save {includedCount > 0 ? `(${includedCount})` : ''}
              </Text>
            </Pressable>
            <Pressable onPress={closeReview}>
              <Text style={styles.linkMuted}>Cancel — don’t save</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={[styles.label, { marginTop: 20 }]}>Income & pay schedule</Text>
        <Text style={styles.incomeSummary}>
          {incomeScheduleLabel(income)} · {money(income.amountPerPaycheck)} each payday
        </Text>
        <Pressable onPress={() => (showIncome ? setShowIncome(false) : openIncome())}>
          <Text style={styles.link}>{showIncome ? 'Cancel' : 'Edit what you make'}</Text>
        </Pressable>
        {showIncome ? (
          <View style={styles.incomeBox}>
            <Text style={styles.hint}>
              Take-home per payday. Set the weekday or month days you actually get paid — waterfall
              uses that period.
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
            <IncomeScheduleFields
              cadence={incomeCadence}
              payWeekday={payWeekday}
              payMonthDay={payMonthDay}
              payMonthDay2={payMonthDay2}
              payAnchorDate={payAnchorDate}
              onWeekday={setPayWeekday}
              onMonthDay={setPayMonthDay}
              onMonthDay2={setPayMonthDay2}
              onAnchorDate={setPayAnchorDate}
            />
            <Pressable onPress={saveIncome} style={styles.primaryBtn}>
              <Text style={styles.primaryBtnText}>Save income</Text>
            </Pressable>
          </View>
        ) : null}

        <Text style={[styles.label, { marginTop: 20 }]}>Planning lookback</Text>
        <Text style={styles.hint}>
          How far back you can enter bills, income, and spends through today. Default is 2 months.
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

        <Text style={[styles.label, { marginTop: 20 }]}>Recent history</Text>
        {recent.length === 0 ? (
          <Text style={styles.hint}>
            No history yet — log a spend or confirm a screenshot to catch up.
          </Text>
        ) : (
          recent.map((row) => (
            <View key={`${row.kind}-${row.id}`} style={styles.row}>
              <View style={{ flex: 1 }}>
                <Text style={styles.rowTitle}>{row.label}</Text>
                <Text style={styles.rowMeta}>
                  {row.kind === 'income'
                    ? 'Income'
                    : bucketLabel(row.bucket)}{' '}
                  · {row.at.slice(0, 10)}
                </Text>
                <Pressable
                  onPress={() =>
                    row.kind === 'income'
                      ? removeIncomeEvent(row.id)
                      : removeSpend(row.id)
                  }
                >
                  <Text style={styles.removeText}>Remove</Text>
                </Pressable>
              </View>
              <Text
                style={[
                  styles.rowAmount,
                  row.kind === 'income' && styles.rowAmountIncome,
                ]}
              >
                {row.kind === 'income' ? '+' : ''}
                {money(row.amount)}
              </Text>
            </View>
          ))
        )}

        <Pressable onPress={startFresh} style={styles.primaryBtn}>
          <Text style={styles.primaryBtnText}>
            {showingSample ? 'Clear sample & enter my numbers' : 'Clear everything & start over'}
          </Text>
        </Pressable>
        <Pressable onPress={loadDemo} style={styles.resetBtn}>
          <Text style={styles.resetText}>
            {showingSample ? 'Reload sample week' : 'Load sample week (optional)'}
          </Text>
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
  pasteBox: { minHeight: 88, textAlignVertical: 'top' },
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
  shotActions: { gap: 8 },
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
  readingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6 },
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
    gap: 8,
    padding: 14,
    backgroundColor: Colors.cream,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  confirmCount: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.forest,
  },
  previewRow: { marginBottom: 4 },
  preview: {
    width: 160,
    height: 120,
    borderRadius: 12,
    backgroundColor: Colors.sandDark,
    marginRight: 8,
  },
  lineCard: {
    marginTop: 6,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.sand,
    gap: 4,
  },
  lineCardOff: { opacity: 0.55 },
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
  rowAmountIncome: { color: Colors.forest },
  resetBtn: { marginTop: 16, alignSelf: 'center', padding: 8 },
  resetText: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline' },
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
  removeText: {
    marginTop: 4,
    fontSize: 12,
    fontWeight: '700',
    color: Colors.danger,
    textDecorationLine: 'underline',
  },
});
