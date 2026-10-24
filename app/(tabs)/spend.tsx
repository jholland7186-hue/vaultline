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
import type { SpendBucket } from '@/types';
import { bucketLabel, money, useVaultStore } from '@/store/vaultStore';

const BUCKETS: SpendBucket[] = ['needs', 'wants', 'eating_out', 'other'];

export default function SpendScreen() {
  const spends = useVaultStore((s) => s.spends);
  const addSpend = useVaultStore((s) => s.addSpend);
  const resetDemo = useVaultStore((s) => s.resetDemo);

  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [bucket, setBucket] = useState<SpendBucket>('wants');

  const totals = useMemo(() => {
    const map: Record<SpendBucket, number> = {
      needs: 0,
      wants: 0,
      eating_out: 0,
      other: 0,
    };
    for (const s of spends) map[s.bucket] += s.amount;
    return map;
  }, [spends]);

  const submit = () => {
    const n = Number.parseFloat(amount.replace(/[^0-9.]/g, ''));
    if (!Number.isFinite(n) || n <= 0) return;
    addSpend(n, bucket, note);
    setAmount('');
    setNote('');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Spend</Text>
        <Text style={styles.sub}>Fast manual log — four buckets, no spreadsheet tax.</Text>

        <Text style={styles.label}>Amount</Text>
        <TextInput
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={Colors.textMuted}
          style={styles.input}
        />

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

        <Text style={[styles.label, { marginTop: 20 }]}>Bucket glance</Text>
        <View style={styles.glance}>
          {BUCKETS.map((b) => (
            <Text key={b} style={styles.glanceLine}>
              {bucketLabel(b)} · {money(totals[b])}
            </Text>
          ))}
        </View>

        <Text style={[styles.label, { marginTop: 20 }]}>Recent</Text>
        {spends.slice(0, 12).map((s) => (
          <View key={s.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.rowTitle}>{s.note}</Text>
              <Text style={styles.rowMeta}>
                {bucketLabel(s.bucket)} · {s.at.slice(0, 10)}
              </Text>
            </View>
            <Text style={styles.rowAmount}>{money(s.amount)}</Text>
          </View>
        ))}

        <Pressable onPress={resetDemo} style={styles.resetBtn}>
          <Text style={styles.resetText}>Reset demo data</Text>
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
  resetBtn: { marginTop: 28, alignSelf: 'center', padding: 8 },
  resetText: { fontSize: 13, color: Colors.textMuted, textDecorationLine: 'underline' },
});
