import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Colors from '@/constants/colors';
import {
  money,
  obligationTypeLabel,
  useVaultStore,
} from '@/store/vaultStore';

export default function ObligationsScreen() {
  const obligations = useVaultStore((s) => s.obligations);
  const toggleObligationPaid = useVaultStore((s) => s.toggleObligationPaid);

  const sorted = useMemo(
    () => [...obligations].sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
    [obligations]
  );

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Text style={styles.brand}>Due</Text>
        <Text style={styles.sub}>
          Bills and paybacks in one list — mark paid when the money leaves.
        </Text>

        {sorted.map((o) => (
          <Pressable
            key={o.id}
            onPress={() => toggleObligationPaid(o.id)}
            style={[styles.row, o.paid && styles.rowPaid]}
          >
            <View style={styles.rowTop}>
              <Text style={[styles.name, o.paid && styles.struck]}>{o.name}</Text>
              <Text style={[styles.amount, o.paid && styles.struck]}>{money(o.amount)}</Text>
            </View>
            <Text style={styles.meta}>
              {obligationTypeLabel(o.type)} · {o.cadence} · due {o.dueDate}
            </Text>
            <Text style={[styles.status, o.paid ? styles.paid : styles.unpaid]}>
              {o.paid ? 'Paid' : 'Unpaid — tap to mark paid'}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.sand },
  scroll: { padding: 24, paddingBottom: 40, gap: 14 },
  brand: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.forest,
    letterSpacing: -0.5,
  },
  sub: { fontSize: 15, color: Colors.textSecondary, marginBottom: 8, lineHeight: 22 },
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
  status: { fontSize: 12, fontWeight: '700', marginTop: 2 },
  paid: { color: Colors.success },
  unpaid: { color: Colors.copper },
});
