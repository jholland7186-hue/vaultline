import { Link } from 'expo-router';
import React from 'react';
import {
  Image,
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
  selectNextDue,
  selectTodaySpend,
  useVaultStore,
} from '@/store/vaultStore';

export default function HomeScreen() {
  const payPeriod = useVaultStore((s) => s.payPeriod);
  const goal = useVaultStore((s) => s.goal);
  const obligations = useVaultStore((s) => s.obligations);
  const spends = useVaultStore((s) => s.spends);
  const markSaveCompleted = useVaultStore((s) => s.markSaveCompleted);

  const nextDue = selectNextDue(obligations);
  const todaySpend = selectTodaySpend(spends);
  const allowanceLeft = Math.max(0, payPeriod.weeklyAllowance - todaySpend);
  const goalPct =
    goal && goal.targetAmount > 0
      ? Math.min(100, Math.round((goal.currentAmount / goal.targetAmount) * 100))
      : 0;

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
          </View>
        </View>

        <View style={styles.block}>
          <Text style={styles.kicker}>This pay period</Text>
          <Text style={styles.title}>
            {payPeriod.saveCompleted ? 'Save-first done' : 'Save before you spend'}
          </Text>
          <Text style={styles.body}>
            Put {money(payPeriod.saveTarget)} in the vault before discretionary cash opens up.
          </Text>
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
          ) : null}
        </View>

        <View style={styles.block}>
          <Text style={styles.kicker}>Next due</Text>
          {nextDue ? (
            <>
              <Text style={styles.title}>{nextDue.name}</Text>
              <Text style={styles.body}>
                {money(nextDue.amount)} · {obligationTypeLabel(nextDue.type)} · due{' '}
                {nextDue.dueDate}
              </Text>
              <Link href="/obligations" asChild>
                <Pressable style={styles.linkBtn}>
                  <Text style={styles.linkBtnText}>All obligations</Text>
                </Pressable>
              </Link>
            </>
          ) : (
            <Text style={styles.body}>Nothing unpaid — you’re clear for now.</Text>
          )}
        </View>

        <View style={styles.block}>
          <Text style={styles.kicker}>Today’s spend</Text>
          <Text style={styles.title}>
            {money(todaySpend)}
            <Text style={styles.titleMuted}> / {money(payPeriod.weeklyAllowance)} allowance</Text>
          </Text>
          <Text style={styles.body}>
            {money(allowanceLeft)} left in this week’s discretionary line.
          </Text>
          <Link href="/spend" asChild>
            <Pressable style={styles.linkBtn}>
              <Text style={styles.linkBtnText}>Log a spend</Text>
            </Pressable>
          </Link>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
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
  block: { gap: 8 },
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
});
