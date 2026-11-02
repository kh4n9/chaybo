import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityRow } from '@/components/ActivityRow';
import { Eyebrow, IconButton } from '@/components/ui';
import { useActivities } from '@/hooks/useActivities';
import { monthWeeks, shiftMonth } from '@/lib/calendar';
import {
  formatFullDate,
  formatKmDecimal,
  formatMonthLabel,
  startOfDay,
  startOfMonth,
} from '@/lib/format';
import { colors, radius } from '@/lib/theme';

export default function CalendarScreen() {
  const router = useRouter();
  const { activities, fetchedAt } = useActivities();
  const now = fetchedAt ?? 0;

  const [monthStart, setMonthStart] = useState<number | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  const currentMonth = monthStart ?? (now ? startOfMonth(now) : 0);

  const weeks = useMemo(
    () => (currentMonth && now ? monthWeeks(activities, currentMonth, now) : []),
    [activities, currentMonth, now],
  );

  const runsOnSelectedDay = useMemo(() => {
    if (selectedDay == null) return [];
    const dayStart = startOfDay(selectedDay);
    return activities.filter((activity) => startOfDay(activity.startedAt) === dayStart);
  }, [activities, selectedDay]);

  const monthDistance = useMemo(
    () =>
      activities
        .filter((activity) => startOfMonth(activity.startedAt) === currentMonth)
        .reduce((sum, activity) => sum + activity.distanceM, 0),
    [activities, currentMonth],
  );

  const monthRuns = useMemo(
    () => activities.filter((activity) => startOfMonth(activity.startedAt) === currentMonth).length,
    [activities, currentMonth],
  );

  const isCurrentMonth =
    currentMonth && now ? startOfMonth(now) === currentMonth : false;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Quay lại" />
        <Text style={styles.headerTitle}>Lịch chạy</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.monthBar}>
          <Pressable
            onPress={() => setMonthStart(shiftMonth(currentMonth, -1))}
            style={({ pressed }) => [styles.monthButton, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Tháng trước"
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <View style={styles.monthInfo}>
            <Text style={styles.monthLabel}>{formatMonthLabel(currentMonth)}</Text>
            <Text style={styles.monthMeta}>
              {monthRuns} buổi · {formatKmDecimal(monthDistance, 1)} km
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (isCurrentMonth) return;
              setMonthStart(shiftMonth(currentMonth, 1));
            }}
            disabled={isCurrentMonth}
            style={({ pressed }) => [
              styles.monthButton,
              pressed && { opacity: 0.6 },
              isCurrentMonth && { opacity: 0.3 },
            ]}
            accessibilityRole="button"
            accessibilityLabel="Tháng sau"
          >
            <Ionicons name="chevron-forward" size={18} color={colors.text} />
          </Pressable>
        </View>

        <View style={styles.weekdayHeader}>
          {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((label) => (
            <Text key={label} style={styles.weekdayLabel}>
              {label}
            </Text>
          ))}
        </View>

        {weeks.map((week, weekIndex) => (
          <View key={weekIndex} style={styles.weekRow}>
            {week.map((day) => {
              const selected = selectedDay != null && startOfDay(selectedDay) === day.dayStart;
              const today = now && startOfDay(now) === day.dayStart;
              const intensity = day.distanceM > 0 ? Math.min(1, day.distanceM / 8000) : 0;
              const background =
                day.future || !day.inMonth
                  ? 'transparent'
                  : day.count > 0
                    ? `rgba(216, 255, 62, ${0.18 + intensity * 0.72})`
                    : colors.surfaceAlt;
              return (
                <Pressable
                  key={day.dayStart}
                  onPress={() => {
                    if (!day.inMonth || day.future) return;
                    setSelectedDay(day.dayStart);
                  }}
                  style={({ pressed }) =>
                    [
                      styles.dayCell,
                      { backgroundColor: background },
                      selected && styles.dayCellSelected,
                      today && styles.dayCellToday,
                      pressed && { opacity: 0.7 },
                    ] as any
                  }
                  accessibilityRole="button"
                  accessibilityLabel={`${new Date(day.dayStart).getDate()}${
                    day.count > 0 ? `, ${day.count} buổi` : ''
                  }`}
                >
                  <Text
                    style={[
                      styles.dayNumber,
                      !day.inMonth && styles.dayNumberMuted,
                      day.count > 0 && styles.dayNumberActive,
                    ]}
                  >
                    {new Date(day.dayStart).getDate()}
                  </Text>
                  {day.count > 0 ? <View style={styles.dayDot} /> : null}
                </Pressable>
              );
            })}
          </View>
        ))}

        <View style={styles.legend}>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.surfaceAlt }]} />
            <Text style={styles.legendText}>Không chạy</Text>
          </View>
          <View style={styles.legendItem}>
            <View style={[styles.legendDot, { backgroundColor: colors.accent }]} />
            <Text style={styles.legendText}>Có buổi chạy</Text>
          </View>
        </View>

        {selectedDay != null ? (
          <View style={styles.selectedSection}>
            <Eyebrow>{formatFullDate(selectedDay)}</Eyebrow>
            {runsOnSelectedDay.length === 0 ? (
              <Text style={styles.emptyDay}>Không có buổi chạy nào trong ngày này.</Text>
            ) : (
              runsOnSelectedDay.map((activity) => (
                <ActivityRow
                  key={activity.id}
                  activity={activity}
                  onPress={() =>
                    router.push({ pathname: '/activity/[id]', params: { id: activity.id } })
                  }
                />
              ))
            )}
          </View>
        ) : (
          <Text style={styles.hint}>Chạm vào một ngày có buổi chạy để xem chi tiết.</Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },
  content: { paddingHorizontal: 20, paddingBottom: 40 },
  monthBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  monthButton: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  monthInfo: { alignItems: 'center', gap: 2 },
  monthLabel: { fontSize: 16, fontWeight: '700', color: colors.text, letterSpacing: -0.3 },
  monthMeta: { fontSize: 11, color: colors.textFaint },
  weekdayHeader: {
    flexDirection: 'row',
    marginBottom: 6,
  },
  weekdayLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 10,
    fontWeight: '700',
    color: colors.textFaint,
    letterSpacing: 0.6,
  },
  weekRow: { flexDirection: 'row', gap: 6, marginBottom: 6 },
  dayCell: {
    flex: 1,
    aspectRatio: 1,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  dayCellSelected: {
    borderWidth: 1.5,
    borderColor: colors.accent,
  },
  dayCellToday: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.accentLine,
  },
  dayNumber: { fontSize: 12, fontWeight: '600', color: colors.textDim },
  dayNumberMuted: { color: colors.textFaint },
  dayNumberActive: { color: colors.text },
  dayDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.accent,
  },
  legend: { flexDirection: 'row', gap: 16, marginTop: 6, marginBottom: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 10, height: 10, borderRadius: 3 },
  legendText: { fontSize: 10, color: colors.textFaint },
  selectedSection: { marginTop: 16, gap: 4 },
  emptyDay: { fontSize: 12, color: colors.textFaint, marginTop: 10 },
  hint: { fontSize: 12, color: colors.textFaint, marginTop: 16, textAlign: 'center' },
});