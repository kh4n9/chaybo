import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BadgeGrid } from '@/components/BadgeGrid';
import { AreaHeatmap } from '@/components/AreaHeatmap';
import { BarChart } from '@/components/BarChart';
import { TrainingHeatmap } from '@/components/TrainingHeatmap';
import { Eyebrow } from '@/components/ui';
import { useActivities } from '@/hooks/useActivities';
import { useSettings } from '@/hooks/useSettings';
import { buildBadges, earnedCount } from '@/lib/badges';
import { longestStreak, trainingWeeks } from '@/lib/calendar';
import { formatDayLabel, formatDuration, startOfWeek } from '@/lib/format';
import { useUnit } from '@/hooks/useUnit';
import { currentStreakWithFreeze, freezesUsed, monthProgress, yearProgress } from '@/lib/goals';
import { favouriteTimeBucket, favouriteWeekday, timeOfDayStats, weekdayStats } from '@/lib/rhythm';
import { trainingLoad, trainingLoadLabel } from '@/lib/trainingLoad';
import { bestVo2max } from '@/lib/vo2max';
import {
  activitiesBetween,
  recordsOf,
  totalsOf,
  weeklyBuckets,
} from '@/lib/stats';
import { radius, type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';

const BADGE_PREVIEW = 6;

export default function StatsScreen() {
  const u = useUnit();
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const router = useRouter();
  const { activities, fetchedAt } = useActivities();
  const { settings } = useSettings();
  const [showAllBadges, setShowAllBadges] = useState(false);
  const now = fetchedAt ?? 0;

  const data = useMemo(() => {
    const thisWeekStart = startOfWeek(now);
    const lastWeekStart = thisWeekStart - 7 * 86400000;

    return {
      all: totalsOf(activities),
      thisWeek: totalsOf(activitiesBetween(activities, thisWeekStart, now + 1)),
      lastWeek: totalsOf(activitiesBetween(activities, lastWeekStart, thisWeekStart)),
      buckets: now ? weeklyBuckets(activities, 8, now) : [],
      records: recordsOf(activities),
      streakNow: now ? currentStreakWithFreeze(activities, now, settings.streakFreezes) : 0,
      freezes: now ? freezesUsed(activities, now, settings.streakFreezes) : 0,
      streakBest: longestStreak(activities),
      heatmap: now ? trainingWeeks(activities, 16, now) : [],
      badges: now ? buildBadges(activities, settings.weeklyGoalKm, now) : [],
      monthGoal: now ? monthProgress(activities, now, settings.monthlyGoalKm) : null,
      yearGoal: now ? yearProgress(activities, now, settings.yearlyGoalKm) : null,
      vo2: bestVo2max(activities),
       weekdays: weekdayStats(activities),
       timeBuckets: timeOfDayStats(activities),
    };
  }, [
    activities,
    now,
    settings.weeklyGoalKm,
    settings.monthlyGoalKm,
    settings.yearlyGoalKm,
    settings.streakFreezes,
  ]);

  const {
    all,
    thisWeek,
    lastWeek,
    buckets,
    records,
    streakNow,
    freezes,
    streakBest,
    heatmap,
    badges,
    monthGoal,
    yearGoal,
    vo2,
    weekdays,
    timeBuckets,
  } = data;

  const avgPace = all.distanceM > 0 ? (all.durationS / all.distanceM) * 1000 : null;
  const load = now ? trainingLoad(activities, now) : null;
  const weekDelta = deltaPct(thisWeek.distanceM, lastWeek.distanceM);
  const earned = earnedCount(badges);
  const visibleBadges = showAllBadges ? badges : badges.slice(0, BADGE_PREVIEW);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.title}>Thống kê</Text>
          <Text style={styles.subtitle}>Toàn bộ thời gian</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroNumberLine}>
            <Text style={styles.heroNumber}>{u.dist(all.distanceM, 1)}</Text>
            <Text style={styles.heroUnit}>{u.label}</Text>
          </View>
          <Text style={styles.heroSub}>{all.count} buổi chạy đã ghi lại</Text>
        </View>

        <View style={styles.grid}>
          <Tile label="Thời gian" value={formatDuration(all.durationS)} />
          <Tile label="Pace trung bình" value={u.pace(avgPace)} suffix={u.paceLabel} />
          <Tile label="Độ cao" value={u.elev(all.elevGainM)} suffix={u.elevLabel} />
          <Tile
            label="Trung bình / buổi"
            value={all.count > 0 ? u.dist(all.distanceM / all.count, 1) : '0'}
            suffix={u.label}
          />
        </View>

        <Section title="Chuỗi ngày">
          <View style={styles.streakCard}>
            <View style={styles.streakFlame}>
              <Ionicons name="flame" size={22} color={palette.accent} />
            </View>
            <View style={styles.streakMain}>
              <Text style={styles.streakNumber}>{streakNow}</Text>
              <Text style={styles.streakUnit}>ngày liên tiếp</Text>
              <Text style={styles.streakFreeze}>
                Bảo lưu {freezes}/{settings.streakFreezes} ngày
              </Text>
            </View>
            <View style={styles.streakDivider} />
            <View style={styles.streakSide}>
              <Text style={styles.streakSideLabel}>DÀI NHẤT</Text>
              <Text style={styles.streakSideValue}>{streakBest} ngày</Text>
            </View>
          </View>
        </Section>

        <Section title="Tuần này">
          <View style={styles.compareRow}>
            <View style={styles.compareCol}>
              <Text style={styles.compareValue}>{u.dist(thisWeek.distanceM, 1)}</Text>
              <Text style={styles.compareLabel}>km · {thisWeek.count} buổi</Text>
            </View>
            <View style={styles.compareCol}>
              <Text style={styles.compareValueDim}>{u.dist(lastWeek.distanceM, 1)}</Text>
              <Text style={styles.compareLabel}>tuần trước</Text>
            </View>
            <View style={[styles.deltaPill, weekDelta >= 0 ? styles.deltaUp : styles.deltaDown]}>
              <Text
                style={[
                  styles.deltaText,
                  { color: weekDelta >= 0 ? palette.accent : palette.danger },
                ]}
              >
                {weekDelta >= 0 ? '+' : ''}
                {Math.round(weekDelta)}%
              </Text>
            </View>
          </View>
        </Section>

        {monthGoal || yearGoal ? (
          <Section title="Mục tiêu">
            {monthGoal ? (
              <GoalBar
                label="Tháng này"
                doneM={monthGoal.doneM}
                targetM={monthGoal.targetM}
                daysLeft={monthGoal.daysLeft}
                onPress={() => router.push('/settings')}
              />
            ) : null}
            {yearGoal ? (
              <GoalBar
                label="Năm nay"
                doneM={yearGoal.doneM}
                targetM={yearGoal.targetM}
                daysLeft={yearGoal.daysLeft}
                onPress={() => router.push('/settings')}
              />
            ) : null}
          </Section>
        ) : null}

        {heatmap.length > 0 ? (
          <Section title="Lịch tập 16 tuần">
            <TrainingHeatmap weeks={heatmap} />
            <Text style={styles.chartFootnote}>
              Mỗi ô là một ngày · càng sáng càng nhiều {u.label} · cột cuối là tuần này
            </Text>
          </Section>
        ) : null}

        <Section title="8 tuần gần nhất">
          {buckets.length > 0 ? (
            <BarChart
              values={buckets.map((b) => b.distanceM)}
              labels={buckets.map((b) => b.label)}
              height={128}
            />
          ) : null}
          <Text style={styles.chartFootnote}>
            Cột sáng là tuần hiện tại · đơn vị {u.label}
          </Text>
        </Section>

        <Section title="Nhịp chạy theo thứ">
          <BarChart
            values={weekdays.map((day) => day.distanceM)}
            labels={weekdays.map((day) => day.label)}
            height={110}
            highlightIndex={weekdays.reduce(
              (best, day, index) =>
                day.distanceM > weekdays[best].distanceM ? index : best,
              0,
            )}
          />
          <Text style={styles.chartFootnote}>
            {(() => {
              const fav = favouriteWeekday(weekdays);
              return fav && fav.count > 0
                ? `Hay chạy nhất: ${fav.label} · ${fav.count} buổi`
                : 'Chưa đủ dữ liệu';
            })()}
          </Text>
        </Section>

        <Section title="Khung giờ quen thuộc">
          <View style={styles.timeBucketRow}>
            {timeBuckets.map((bucket) => (
              <View key={bucket.key} style={styles.timeBucketCard}>
                <Text style={styles.timeBucketLabel}>{bucket.label}</Text>
                <Text style={styles.timeBucketValue}>{bucket.count}</Text>
                <Text style={styles.timeBucketHint}>{u.dist(bucket.distanceM, 1)} {u.label}</Text>
              </View>
            ))}
          </View>
          <Text style={styles.chartFootnote}>
            {(() => {
              const fav = favouriteTimeBucket(timeBuckets);
              return fav && fav.count > 0
                ? `Khung giờ vàng: ${fav.label}`
                : 'Chưa đủ dữ liệu';
            })()}
          </Text>
        </Section>

        <Pressable
          onPress={() => router.push('/calendar')}
          style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
          accessibilityRole="button"
          accessibilityLabel="Mở lịch tháng"
        >
          <View style={styles.linkIcon}>
            <Ionicons name="calendar-outline" size={17} color={palette.accent} />
          </View>
          <View style={styles.linkText}>
            <Text style={styles.linkTitle}>Lịch chạy theo tháng</Text>
            <Text style={styles.linkHint}>Xem từng ngày đã chạy và chọn ngày xem buổi</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
        </Pressable>

        {load ? (
          <Section title="Tải tập luyện (7/28 ngày)">
            <View style={styles.loadCard}>
              <View style={styles.loadRow}>
                <View style={styles.loadCol}>
                  <Text style={styles.loadValue}>{load.acute.toFixed(1)}</Text>
                  <Text style={styles.loadLabel}>km / 7 ngày</Text>
                </View>
                <View style={styles.loadCol}>
                  <Text style={styles.loadValue}>{load.chronic.toFixed(1)}</Text>
                  <Text style={styles.loadLabel}>km / tuần TB (28 ngày)</Text>
                </View>
                <View style={[styles.loadPill, load.status === 'overreaching' && styles.loadPillDanger]}>
                  <Text style={styles.loadPillText}>{trainingLoadLabel(load.status)}</Text>
                </View>
              </View>
              <Text style={styles.chartFootnote}>
                Tỉ lệ tải {load.ratio.toFixed(2)} · &lt;0.8 nghỉ nhiều · 0.8–1.1 tối ưu · &gt;1.3 quá tải
              </Text>
            </View>
          </Section>
        ) : null}

        {vo2 ? (
          <Section title="VO2max ước tính">
            <View style={styles.vo2Card}>
              <Text style={styles.vo2Value}>{vo2.value.toFixed(1)}</Text>
              <View style={styles.vo2Body}>
                <Text style={styles.vo2Label}>{vo2.label}</Text>
                <Text style={styles.vo2Hint}>
                  Từ {u.dist(vo2.sourceDistanceM)} {u.label} trong {formatDuration(vo2.sourceTimeS)}
                </Text>
              </View>
            </View>
            <Text style={styles.chartFootnote}>
              Ước tính theo mô hình Daniels/Gilbert từ buổi chạy nhanh nhất · không thay thế xét
              nghiệm y tế
            </Text>
          </Section>
        ) : null}

        <Section title="Kỷ lục cá nhân">
          <RecordRow
            label="Chạy xa nhất"
            value={records.longest ? `${u.dist(records.longest.distanceM)} ${u.label}` : '--'}
            detail={records.longest ? formatDayLabel(records.longest.startedAt) : undefined}
          />
          <RecordRow
            label="Pace tốt nhất"
            value={records.fastest ? `${u.pace(records.fastest.avgPaceS)}${u.paceLabel}` : '--'}
            detail={records.fastest ? formatDayLabel(records.fastest.startedAt) : undefined}
          />
          <RecordRow
            label="Leo nhiều nhất"
            value={records.biggestClimb ? `${u.elev(records.biggestClimb.elevGainM)} ${u.elevLabel}` : '--'}
            detail={records.biggestClimb ? formatDayLabel(records.biggestClimb.startedAt) : undefined}
            last
          />

          <Pressable
            onPress={() => router.push('/records')}
            style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
            accessibilityRole="button"
            accessibilityLabel="Xem kỷ lục theo cự ly"
          >
            <View style={styles.linkIcon}>
              <Ionicons name="stopwatch-outline" size={17} color={palette.accent} />
            </View>
            <View style={styles.linkText}>
              <Text style={styles.linkTitle}>Best effort 400 m → 10 km</Text>
              <Text style={styles.linkHint}>Nhanh nhất ở từng cự ly, kèm buổi chạy tương ứng</Text>
            </View>
            <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
          </Pressable>
        </Section>

        {activities.length > 0 ? (
          <Section title="Khu vực hay chạy">
            <AreaHeatmap activities={activities} />
            <Text style={styles.chartFootnote}>
              Bản đồ nhiệt cục bộ từ {activities.length} buổi · không tải bản đồ trực tuyến
            </Text>
          </Section>
        ) : null}

        <Section title="Công cụ">
          <NavRow
            icon="calendar-outline"
            title="Kế hoạch tập luyện"
            hint="Giáo án 8–16 tuần theo mục tiêu và trình độ"
            onPress={() => router.push('/plan')}
          />
          <NavRow
            icon="timer-outline"
            title="Đồng hồ biến tốc"
            hint="Bài mẫu 400 m, 800 m, 1 km, kim tự tháp, fartlek"
            onPress={() => router.push('/interval')}
          />
          <NavRow
            icon="git-compare-outline"
            title="Đoạn chạy quen"
            hint="So sánh thời gian trên cùng một cung đường"
            onPress={() => router.push('/segments')}
          />
          <NavRow
            icon="medkit-outline"
            title="Nhật ký hồi phục"
            hint="Ghi nhận đau và nhận gợi ý giảm tải"
            onPress={() => router.push('/recovery')}
          />
        </Section>

        {badges.length > 0 ? (
          <Section title={`Huy hiệu · ${earned}/${badges.length}`}>
            <BadgeGrid badges={visibleBadges} />

            {badges.length > BADGE_PREVIEW ? (
              <Pressable
                onPress={() => setShowAllBadges((value) => !value)}
                style={({ pressed }) => [styles.toggle, pressed && { opacity: 0.6 }]}
                accessibilityRole="button"
              >
                <Text style={styles.toggleText}>
                  {showAllBadges
                    ? 'Thu gọn'
                    : `Xem tất cả ${badges.length} huy hiệu`}
                </Text>
                <Ionicons
                  name={showAllBadges ? 'chevron-up' : 'chevron-down'}
                  size={14}
                  color={palette.accent}
                />
              </Pressable>
            ) : null}
          </Section>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function deltaPct(current: number, previous: number): number {
  if (previous <= 0) return current > 0 ? 100 : 0;
  return ((current - previous) / previous) * 100;
}

function Tile({ label, value, suffix }: { label: string; value: string; suffix?: string }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.tile}>
      <Text style={styles.tileLabel}>{label.toUpperCase()}</Text>
      <View style={styles.tileValueLine}>
        <Text style={styles.tileValue}>{value}</Text>
        {suffix ? <Text style={styles.tileSuffix}>{suffix}</Text> : null}
      </View>
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={styles.section}>
      <Eyebrow style={styles.sectionTitle}>{title}</Eyebrow>
      {children}
    </View>
  );
}

function RecordRow({
  label,
  value,
  detail,
  last,
}: {
  label: string;
  value: string;
  detail?: string;
  last?: boolean;
}) {
  const styles = useThemedStyles(createStyles);
  return (
    <View style={[styles.recordRow, last && { borderBottomWidth: 0 }]}>
      <View>
        <Text style={styles.recordLabel}>{label}</Text>
        {detail ? <Text style={styles.recordDetail}>{detail}</Text> : null}
      </View>
      <Text style={styles.recordValue}>{value}</Text>
    </View>
  );
}

function NavRow({
  icon,
  title,
  hint,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  hint: string;
  onPress: () => void;
}) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.linkRow, pressed && { opacity: 0.6 }]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.linkIcon}>
        <Ionicons name={icon} size={17} color={palette.accent} />
      </View>
      <View style={styles.linkText}>
        <Text style={styles.linkTitle}>{title}</Text>
        <Text style={styles.linkHint}>{hint}</Text>
      </View>
      <Ionicons name="chevron-forward" size={16} color={palette.textFaint} />
    </Pressable>
  );
}

function GoalBar({
  label,
  doneM,
  targetM,
  daysLeft,
  onPress,
}: {
  label: string;
  doneM: number;
  targetM: number;
  daysLeft: number;
  onPress: () => void;
}) {
  const u = useUnit();
  const styles = useThemedStyles(createStyles);
  const pct = targetM > 0 ? Math.min(1, doneM / targetM) : 0;

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.goalCard, pressed && { opacity: 0.75 }]}
      accessibilityRole="button"
      accessibilityLabel={`${label}, mở cài đặt mục tiêu`}
    >
      <View style={styles.goalHead}>
        <Text style={styles.goalLabel}>{label}</Text>
        <Text style={styles.goalPct}>{targetM > 0 ? `${Math.round(pct * 100)}%` : 'Chưa đặt'}</Text>
      </View>
      <View style={styles.goalBar}>
        <View style={[styles.goalFill, { width: `${Math.round(pct * 100)}%` }]} />
      </View>
      <View style={styles.goalFoot}>
        <Text style={styles.goalNumbers}>
          {u.dist(doneM, 1)} / {targetM > 0 ? u.dist(targetM, 0) : '--'} {u.label}
        </Text>
        <Text style={styles.goalDays}>
          {targetM > 0 ? `${daysLeft} ngày còn lại` : 'Nhấn để đặt'}
        </Text>
      </View>
    </Pressable>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  content: { paddingHorizontal: 20, paddingBottom: 32 },
  header: { paddingTop: 8, paddingBottom: 20 },
  title: { fontSize: 30, fontWeight: '800', letterSpacing: -1.2, color: c.text },
  subtitle: { fontSize: 12, color: c.textFaint, marginTop: 2 },
  hero: { paddingBottom: 22 },
  heroNumberLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  heroNumber: {
    fontSize: 56,
    lineHeight: 62,
    fontWeight: '800',
    letterSpacing: -3,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: { fontSize: 17, fontWeight: '700', color: c.accent },
  heroSub: { fontSize: 13, color: c.textDim, marginTop: 2 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  tile: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 14,
  },
  tileLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: c.textFaint,
    marginBottom: 6,
  },
  tileValueLine: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  tileValue: {
    fontSize: 21,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  tileSuffix: { fontSize: 10, color: c.textFaint },
  section: { marginTop: 30 },
  sectionTitle: { marginBottom: 14 },
  streakCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 16,
  },
  streakFlame: {
    width: 42,
    height: 42,
    borderRadius: radius.pill,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakMain: { flex: 1 },
  streakNumber: {
    fontSize: 30,
    lineHeight: 34,
    fontWeight: '800',
    letterSpacing: -1.2,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  streakUnit: { fontSize: 11, color: c.textDim, marginTop: 1 },
  streakFreeze: { fontSize: 9, color: c.textFaint, marginTop: 3 },
  streakDivider: {
    width: StyleSheet.hairlineWidth,
    height: 34,
    backgroundColor: c.border,
  },
  streakSide: { alignItems: 'flex-end', gap: 4 },
  streakSideLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: c.textFaint,
  },
  streakSideValue: {
    fontSize: 15,
    fontWeight: '700',
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  compareRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 18 },
  compareCol: { gap: 2 },
  compareValue: {
    fontSize: 26,
    fontWeight: '800',
    color: c.text,
    letterSpacing: -1,
    fontVariant: ['tabular-nums'],
  },
  compareValueDim: {
    fontSize: 20,
    fontWeight: '700',
    color: c.textFaint,
    letterSpacing: -0.6,
    fontVariant: ['tabular-nums'],
  },
  compareLabel: { fontSize: 11, color: c.textFaint },
  deltaPill: {
    marginLeft: 'auto',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  deltaUp: { backgroundColor: c.accentSoft },
  deltaDown: { backgroundColor: c.dangerSoft },
  deltaText: { fontSize: 12, fontWeight: '700', fontVariant: ['tabular-nums'] },
  chartFootnote: { fontSize: 10, color: c.textFaint, marginTop: 10 },
  recordRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
  },
  recordLabel: { fontSize: 14, color: c.text, fontWeight: '600' },
  recordDetail: { fontSize: 11, color: c.textFaint, marginTop: 2 },
  recordValue: {
    fontSize: 16,
    fontWeight: '700',
    color: c.accent,
    fontVariant: ['tabular-nums'],
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 16,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 14,
  },
  linkIcon: {
    width: 34,
    height: 34,
    borderRadius: radius.sm,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  linkText: { flex: 1 },
  linkTitle: { fontSize: 13, fontWeight: '700', color: c.text },
  linkHint: { fontSize: 10, color: c.textFaint, marginTop: 3 },
  toggle: {
    marginTop: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
  },
  toggleText: { fontSize: 12, fontWeight: '600', color: c.accent },
  timeBucketRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timeBucketCard: {
    width: '47.5%',
    flexGrow: 1,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 14,
    gap: 2,
  },
  timeBucketLabel: { fontSize: 10, fontWeight: '700', color: c.textFaint, letterSpacing: 0.4 },
  timeBucketValue: {
    fontSize: 22,
    fontWeight: '800',
    color: c.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
  },
  timeBucketHint: { fontSize: 10, color: c.textDim },
  loadCard: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 16,
    gap: 10,
  },
  loadRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  loadCol: { flex: 1, gap: 2 },
  loadValue: {
    fontSize: 22,
    fontWeight: '800',
    color: c.text,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.6,
  },
  loadLabel: { fontSize: 10, color: c.textFaint },
  loadPill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: c.accentSoft,
  },
  loadPillDanger: { backgroundColor: c.dangerSoft },
  loadPillText: { fontSize: 11, fontWeight: '700', color: c.accent },
  goalCard: {
    marginTop: 10,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 14,
    gap: 9,
  },
  goalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalLabel: { fontSize: 12, fontWeight: '700', color: c.text },
  goalPct: {
    fontSize: 13,
    fontWeight: '800',
    color: c.accent,
    fontVariant: ['tabular-nums'],
  },
  goalBar: {
    height: 6,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    overflow: 'hidden',
  },
  goalFill: { height: '100%', borderRadius: radius.pill, backgroundColor: c.accent },
  goalFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalNumbers: {
    fontSize: 10,
    color: c.textDim,
    fontVariant: ['tabular-nums'],
  },
  goalDays: { fontSize: 10, color: c.textFaint },
  vo2Card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 18,
  },
  vo2Value: {
    fontSize: 40,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -2,
    color: c.accent,
    fontVariant: ['tabular-nums'],
  },
  vo2Body: { flex: 1, gap: 3 },
  vo2Label: { fontSize: 14, fontWeight: '700', color: c.text },
  vo2Hint: { fontSize: 10, color: c.textFaint },
});
