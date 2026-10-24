import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Colors from '@/constants/colors';
import { WEEKDAYS } from '@/lib/scheduleRules';
import type { PayCadence } from '@/types';

type Props = {
  cadence: PayCadence;
  payWeekday: number;
  payMonthDay: string;
  payMonthDay2: string;
  payAnchorDate: string;
  onWeekday: (day: number) => void;
  onMonthDay: (value: string) => void;
  onMonthDay2: (value: string) => void;
  onAnchorDate: (value: string) => void;
};

export function IncomeScheduleFields({
  cadence,
  payWeekday,
  payMonthDay,
  payMonthDay2,
  payAnchorDate,
  onWeekday,
  onMonthDay,
  onMonthDay2,
  onAnchorDate,
}: Props) {
  if (cadence === 'weekly' || cadence === 'biweekly') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>Payday weekday</Text>
        <View style={styles.chipRow}>
          {WEEKDAYS.map((d) => {
            const active = d.value === payWeekday;
            return (
              <Pressable
                key={d.value}
                onPress={() => onWeekday(d.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{d.short}</Text>
              </Pressable>
            );
          })}
        </View>
        {cadence === 'biweekly' ? (
          <>
            <Text style={styles.label}>Known payday (optional, YYYY-MM-DD)</Text>
            <TextInput
              value={payAnchorDate}
              onChangeText={onAnchorDate}
              placeholder="Anchors every-2-weeks series"
              placeholderTextColor={Colors.textMuted}
              autoCapitalize="none"
              style={styles.input}
            />
          </>
        ) : null}
        <Text style={styles.hint}>
          {cadence === 'weekly'
            ? 'Example: paid every Thursday → pick Thu. Period runs payday → day before next.'
            : 'Pick the weekday you get paid, plus one known payday if the every-2-weeks phase matters.'}
        </Text>
      </View>
    );
  }

  if (cadence === 'semi_monthly') {
    return (
      <View style={styles.wrap}>
        <Text style={styles.label}>Payday days of month</Text>
        <View style={styles.row}>
          <TextInput
            value={payMonthDay}
            onChangeText={onMonthDay}
            keyboardType="number-pad"
            placeholder="2"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, styles.half]}
          />
          <TextInput
            value={payMonthDay2}
            onChangeText={onMonthDay2}
            keyboardType="number-pad"
            placeholder="15"
            placeholderTextColor={Colors.textMuted}
            style={[styles.input, styles.half]}
          />
        </View>
        <Text style={styles.hint}>
          Example: paid on the 2nd and the 15th → enter 2 and 15. Each payday starts a new period.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Payday day of month</Text>
      <TextInput
        value={payMonthDay}
        onChangeText={onMonthDay}
        keyboardType="number-pad"
        placeholder="1"
        placeholderTextColor={Colors.textMuted}
        style={styles.input}
      />
      <Text style={styles.hint}>Example: paid on the 1st every month → enter 1.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, marginTop: 4 },
  label: {
    marginTop: 4,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: Colors.copper,
  },
  hint: { fontSize: 13, lineHeight: 18, color: Colors.textMuted },
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
  row: { flexDirection: 'row', gap: 8 },
  half: { flex: 1 },
});
