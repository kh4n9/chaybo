import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Eyebrow, IconButton } from '@/components/ui';
import { useActivities } from '@/hooks/useActivities';
import { useSettings } from '@/hooks/useSettings';
import { formatDayLabel, startOfWeek } from '@/lib/format';
import { useUnit } from '@/hooks/useUnit';
import { radius, type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';
import {
  PLAN_GOALS,
  PLAN_LEVELS,
  buildTrainingPlan,
  completedSessionKeys,
  planProgress,
  sessionKindLabel,
  type PlanGoal,
  type PlanLevel,
  type PlanSession,
} from '@/lib/trainingPlan';

const WEEKDAYS = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'];

export default function PlanScreen() {
  const u = useUnit();
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const router = useRouter();
  const { activities, fetchedAt } = useActivities();
  const { settings, update } = useSettings();
  const [expandedWeek, setExpandedWeek] = useState<number | null>(null);

  const now = fetchedAt ?? 0;
  const configured = settings.planStartAt > 0;

  const plan = useMemo(() => {
    if (!now) return null;
    const startAt = configured ? settings.planStartAt : startOfWeek(now);
    return buildTrainingPlan(settings.planGoal, settings.planLevel, startAt);
  }, [now, configured, settings.planStartAt, settings.planGoal, settings.planLevel]);

  const progress = useMemo(
    () => (plan && now ? planProgress(plan, activities, now) : null),
    [plan, activities, now],
  );

  const done = useMemo(
    () => (plan ? completedSessionKeys(plan, activities) : new Set<string>()),
    [plan, activities],
  );

  const startPlan = () => {
    if (!now) return;
    void update({ planStartAt: startOfWeek(now) });
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Quay lại" />
        <Text style={styles.headerTitle}>Kế hoạch tập</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {!plan || !progress ? (
          <View style={styles.loading}>
            <ActivityIndicator color={palette.accent} />
          </View>
        ) : (
          <>
            <Eyebrow>Chọn mục tiêu</Eyebrow>
            <View style={styles.chipRow}>
              {PLAN_GOALS.map((goal) => (
                <Chip
                  key={goal.key}
                  label={goal.short}
                  active={settings.planGoal === goal.key}
                  onPress={() => update({ planGoal: goal.key as PlanGoal })}
                />
              ))}
            </View>
            <Text style={styles.hint}>
              {PLAN_GOALS.find((goal) => goal.key === settings.planGoal)?.weeks} tuần ·{' '}
              {PLAN_GOALS.find((goal) => goal.key === settings.planGoal)?.label}
            </Text>

            <Eyebrow style={styles.spaced}>Trình độ</Eyebrow>
            <View style={styles.chipRow}>
              {PLAN_LEVELS.map((level) => (
                <Chip
                  key={level.key}
                  label={level.label}
                  hint={level.hint}
                  active={settings.planLevel === level.key}
                  onPress={() => update({ planLevel: level.key as PlanLevel })}
                />
              ))}
            </View>

            <View style={styles.startCard}>
              <View style={styles.startInfo}>
                <Text style={styles.startLabel}>Bắt đầu</Text>
                <Text style={styles.startValue}>
                  {configured ? formatDayLabel(settings.planStartAt) : 'Chưa đặt lịch'}
                </Text>
                <Text style={styles.startHint}>
                  {configured
                    ? `${plan.weeks} tuần · tổng ${u.dist(plan.totalKm * 1000, 0)} ${u.label}`
                    : 'Mọi buổi sẽ rơi vào các ngày trong tuần, bắt đầu từ thứ Hai.'}
                </Text>
              </View>
              <Button
                label={configured ? 'Đặt lại' : 'Bắt đầu'}
                variant={configured ? 'ghost' : 'primary'}
                onPress={startPlan}
                style={styles.startButton}
              />
            </View>

            <View style={styles.progressCard}>
              <View style={styles.progressHead}>
                <View>
                  <Text style={styles.progressEyebrow}>TUẦN HIỆN TẠI</Text>
                  <Text style={styles.progressNumber}>
                    {progress.currentWeek}
                    <Text style={styles.progressTotal}>/{plan.weeks}</Text>
                  </Text>
                </View>
                <View style={styles.progressRight}>
                  <Text style={styles.progressDone}>
                    {progress.completedSessions}/{progress.totalSessions}
                  </Text>
                  <Text style={styles.progressDoneLabel}>buổi hoàn thành</Text>
                </View>
              </View>
              <View style={styles.bar}>
                <View
                  style={[
                    styles.barFill,
                    {
                      width: `${Math.round(
                        (progress.completedSessions / Math.max(1, progress.totalSessions)) * 100,
                      )}%`,
                    },
                  ]}
                />
              </View>
              <Text style={styles.progressFootnote}>
                Đã chạy {u.dist(progress.completedKm, 1)} /{' '}
                {u.dist(progress.plannedKm, 0)} {u.label} theo kế hoạch
              </Text>
            </View>

            {progress.nextSession ? (
              <View style={styles.nextCard}>
                <View style={styles.nextIcon}>
                  <Ionicons name="flash" size={18} color={palette.bg} />
                </View>
                <View style={styles.nextBody}>
                  <Text style={styles.nextEyebrow}>BUỔI TIẾP THEO</Text>
                  <Text style={styles.nextTitle}>
                    {progress.nextSession.title} ·{' '}
                    {u.dist(progress.nextSession.distanceKm * 1000, 1)} {u.label}
                  </Text>
                  <Text style={styles.nextHint}>
                    {WEEKDAYS[progress.nextSession.day]} ·{' '}
                    {formatDayLabel(progress.nextSession.dateMs)} — {progress.nextSession.detail}
                  </Text>
                </View>
              </View>
            ) : (
              <View style={styles.nextCard}>
                <View style={styles.nextIcon}>
                  <Ionicons name="trophy" size={18} color={palette.bg} />
                </View>
                <View style={styles.nextBody}>
                  <Text style={styles.nextEyebrow}>KẾ HOẠCH ĐÃ XONG</Text>
                  <Text style={styles.nextTitle}>Chúc mừng, bạn đã hoàn thành toàn bộ giáo án!</Text>
                  <Text style={styles.nextHint}>Tạo kế hoạch mới với mục tiêu xa hơn.</Text>
                </View>
              </View>
            )}

            <Eyebrow style={styles.spaced}>Lịch từng tuần</Eyebrow>
            {Array.from({ length: plan.weeks }, (_, index) => index + 1).map((week) => {
              const sessions = plan.sessions.filter((session) => session.week === week);
              const isCurrent = week === progress.currentWeek;
              const open = expandedWeek === week || isCurrent;
              const weekKm = plan.weeklyKm[week - 1] ?? 0;
              const completed = sessions.filter((session) => done.has(session.key)).length;

              return (
                <View key={week} style={[styles.weekCard, isCurrent && styles.weekCardCurrent]}>
                  <Pressable
                    onPress={() => setExpandedWeek(open && !isCurrent ? null : week)}
                    style={({ pressed }) => [styles.weekHead, pressed && { opacity: 0.7 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Tuần ${week}`}
                  >
                    <View style={styles.weekBadge}>
                      <Text style={styles.weekBadgeText}>{week}</Text>
                    </View>
                    <View style={styles.weekInfo}>
                      <Text style={styles.weekTitle}>Tuần {week}</Text>
                      <Text style={styles.weekHint}>
                        {weekKm > 0 ? `${u.dist(weekKm * 1000, 1)} ${u.label}` : 'Tuần thi đấu'} ·{' '}
                        {completed}/{sessions.length} buổi
                      </Text>
                    </View>
                    {isCurrent ? <Text style={styles.currentTag}>HIỆN TẠI</Text> : null}
                    <Ionicons
                      name={open ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={palette.textFaint}
                    />
                  </Pressable>

                  {open ? (
                    <View style={styles.sessionList}>
                      {sessions.map((session) => (
                        <SessionRow
                          key={session.key}
                          session={session}
                          done={done.has(session.key)}
                        />
                      ))}
                    </View>
                  ) : null}
                </View>
              );
            })}

            <Text style={styles.footnote}>
              Buổi chạy được tính hoàn thành khi có một buổi cùng ngày dài tối thiểu 60% cự ly
              kế hoạch. Kế hoạch chỉ là gợi ý, hãy lắng nghe cơ thể.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Chip({
  label,
  hint,
  active,
  onPress,
}: {
  label: string;
  hint?: string;
  active: boolean;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      style={({ pressed }) => [
        styles.chip,
        active && styles.chipActive,
        pressed && { opacity: 0.75 },
      ]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
      {hint ? <Text style={[styles.chipHint, active && styles.chipHintActive]}>{hint}</Text> : null}
    </Pressable>
  );
}

function SessionRow({ session, done }: { session: PlanSession; done: boolean }) {
  const u = useUnit();
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  return (
    <View style={styles.sessionRow}>
      <Ionicons
        name={done ? 'checkmark-circle' : 'ellipse-outline'}
        size={18}
        color={done ? palette.accent : palette.textFaint}
      />
      <View style={styles.sessionBody}>
        <View style={styles.sessionTitleLine}>
          <Text style={[styles.sessionTitle, done && styles.sessionTitleDone]} numberOfLines={1}>
            {session.title}
          </Text>
          <Text style={styles.sessionKind}>{sessionKindLabel(session.kind)}</Text>
        </View>
        <Text style={styles.sessionDetail} numberOfLines={2}>
          {session.detail}
        </Text>
      </View>
      <View style={styles.sessionRight}>
        <Text style={styles.sessionKm}>
          {u.dist(session.distanceKm * 1000, 1)} {u.label}
        </Text>
        <Text style={styles.sessionDay}>{WEEKDAYS[session.day]}</Text>
      </View>
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },
  content: { paddingHorizontal: 20, paddingBottom: 44 },
  loading: { paddingVertical: 80, alignItems: 'center' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    alignItems: 'center',
  },
  chipActive: { backgroundColor: c.accentSoft, borderColor: c.accentLine },
  chipLabel: { fontSize: 13, fontWeight: '700', color: c.textDim },
  chipLabelActive: { color: c.accent },
  chipHint: { fontSize: 9, color: c.textFaint, marginTop: 1 },
  chipHintActive: { color: c.accentLine },
  hint: { fontSize: 11, color: c.textFaint, marginTop: 8 },
  spaced: { marginTop: 26 },
  startCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 22,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 16,
  },
  startInfo: { flex: 1, gap: 2 },
  startLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1, color: c.textFaint },
  startValue: { fontSize: 17, fontWeight: '700', color: c.text, letterSpacing: -0.4 },
  startHint: { fontSize: 10, color: c.textDim, lineHeight: 15, marginTop: 2 },
  startButton: { paddingHorizontal: 16, paddingVertical: 11 },
  progressCard: {
    marginTop: 16,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 18,
    gap: 12,
  },
  progressHead: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  progressEyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.2, color: c.textFaint },
  progressNumber: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -2,
    color: c.text,
    fontVariant: ['tabular-nums'],
    marginTop: 2,
  },
  progressTotal: { fontSize: 18, color: c.textFaint, letterSpacing: -0.5 },
  progressRight: { alignItems: 'flex-end', gap: 2 },
  progressDone: {
    fontSize: 20,
    fontWeight: '800',
    color: c.accent,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
  },
  progressDoneLabel: { fontSize: 10, color: c.textFaint },
  bar: { height: 6, borderRadius: radius.pill, backgroundColor: c.surfaceAlt, overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: radius.pill, backgroundColor: c.accent },
  progressFootnote: { fontSize: 10, color: c.textFaint },
  nextCard: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 16,
    backgroundColor: c.bgElevated,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.accentLine,
    padding: 16,
  },
  nextIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    backgroundColor: c.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextBody: { flex: 1, gap: 2 },
  nextEyebrow: { fontSize: 9, fontWeight: '700', letterSpacing: 1.1, color: c.accent },
  nextTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginTop: 1 },
  nextHint: { fontSize: 11, color: c.textDim, lineHeight: 16, marginTop: 2 },
  weekCard: {
    marginTop: 10,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  weekCardCurrent: { borderColor: c.accentLine },
  weekHead: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  weekBadge: {
    width: 30,
    height: 30,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekBadgeText: {
    fontSize: 13,
    fontWeight: '800',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  weekInfo: { flex: 1, gap: 2 },
  weekTitle: { fontSize: 13, fontWeight: '700', color: c.text },
  weekHint: { fontSize: 10, color: c.textFaint },
  currentTag: {
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: c.accent,
    backgroundColor: c.accentSoft,
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  sessionList: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  sessionRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10 },
  sessionBody: { flex: 1, gap: 2 },
  sessionTitleLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  sessionTitle: { fontSize: 12, fontWeight: '600', color: c.text, flexShrink: 1 },
  sessionTitleDone: { color: c.textDim, textDecorationLine: 'line-through' },
  sessionKind: {
    fontSize: 8,
    fontWeight: '700',
    color: c.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  sessionDetail: { fontSize: 10, color: c.textFaint, lineHeight: 14 },
  sessionRight: { alignItems: 'flex-end', gap: 1 },
  sessionKm: {
    fontSize: 12,
    fontWeight: '700',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  sessionDay: { fontSize: 9, color: c.textFaint },
  footnote: { fontSize: 10, color: c.textFaint, lineHeight: 16, marginTop: 20 },
});
