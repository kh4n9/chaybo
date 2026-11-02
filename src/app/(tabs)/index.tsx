import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ActivityRow } from '@/components/ActivityRow';
import { Button, Eyebrow, IconButton } from '@/components/ui';
import { seedSampleData } from '@/db/sample';
import { useActivities } from '@/hooks/useActivities';
import { useSettings } from '@/hooks/useSettings';
import type { ActivitySummary, Feeling, RunType } from '@/lib/types';
import { formatMonthLabel, normalizeText, startOfMonth, startOfWeek, startOfYear } from '@/lib/format';
import { useUnit } from '@/hooks/useUnit';
import { activitiesBetween, EMPTY_TOTALS, totalsOf } from '@/lib/stats';
import { RUN_TYPES } from '@/lib/runType';
import { radius, type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';

type RangeKey = 'all' | 'week' | 'month' | 'year';

const RANGES: { key: RangeKey; label: string }[] = [
  { key: 'all', label: 'Tất cả' },
  { key: 'week', label: 'Tuần' },
  { key: 'month', label: 'Tháng' },
  { key: 'year', label: 'Năm' },
];

const DISTANCE_FILTERS = [0, 5, 10, 21] as const;

const FEELING_FILTERS: { value: Feeling | 'all'; label: string }[] = [
  { value: 'all', label: 'Mọi cảm giác' },
  { value: 1, label: 'Mệt' },
  { value: 2, label: 'Hơi mệt' },
  { value: 3, label: 'Ổn' },
  { value: 4, label: 'Tốt' },
  { value: 5, label: 'Tuyệt' },
];

export default function HistoryScreen() {
  const u = useUnit();
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const router = useRouter();
  const db = useSQLiteContext();
  const { activities, loading, refresh, fetchedAt } = useActivities();
  const { settings } = useSettings();
  const [refreshing, setRefreshing] = useState(false);
  const [seeding, setSeeding] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [range, setRange] = useState<RangeKey>('all');
  const [sort, setSort] = useState<'newest' | 'oldest' | 'longest' | 'fastest'>('newest');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [minKm, setMinKm] = useState(0);
  const [feeling, setFeeling] = useState<Feeling | 'all'>('all');
  const [runType, setRunType] = useState<RunType | 'all'>('all');

  const now = fetchedAt ?? 0;

  const week = useMemo(() => {
    if (!now) return EMPTY_TOTALS;
    return totalsOf(activitiesBetween(activities, startOfWeek(now), now + 1));
  }, [activities, now]);

  const weekPace = week.distanceM > 0 ? (week.durationS / week.distanceM) * 1000 : null;

  const goalM = settings.weeklyGoalKm * 1000;
  const goalPct = goalM > 0 ? Math.min(1, week.distanceM / goalM) : 0;
  const goalReached = goalM > 0 && week.distanceM >= goalM;

  const rangeStart = useMemo(() => {
    if (!now || range === 'all') return 0;
    if (range === 'week') return startOfWeek(now);
    if (range === 'month') return startOfMonth(now);
    return startOfYear(now);
  }, [now, range]);

  const filtered = useMemo(() => {
    const needle = normalizeText(query.trim());
    const list = activities.filter((activity) => {
      if (activity.startedAt < rangeStart) return false;
      if (minKm > 0 && activity.distanceM < minKm * 1000) return false;
      if (feeling !== 'all' && activity.feeling !== feeling) return false;
      if (runType !== 'all' && activity.runType !== runType) return false;
      if (!needle) return true;
      return (
        normalizeText(activity.title).includes(needle) ||
        normalizeText(activity.notes ?? '').includes(needle)
      );
    });

    const sorted = [...list].sort((a, b) => {
      if (sort === 'oldest') return a.startedAt - b.startedAt;
      if (sort === 'longest') return b.distanceM - a.distanceM;
      if (sort === 'fastest') {
        const ap = a.avgPaceS ?? Infinity;
        const bp = b.avgPaceS ?? Infinity;
        return ap - bp;
      }
      return b.startedAt - a.startedAt;
    });

    return sorted;
  }, [activities, query, rangeStart, sort, minKm, feeling, runType]);

  type Row =
    | { kind: 'header'; key: string; label: string; count: number; distanceM: number }
    | { kind: 'item'; key: string; activity: ActivitySummary };

  const rows = useMemo<Row[]>(() => {
    const grouped = (sort === 'newest' || sort === 'oldest') && range === 'all';
    if (!grouped) {
      return filtered.map((activity) => ({ kind: 'item', key: activity.id, activity }));
    }

    const out: Row[] = [];
    let currentMonth = -1;
    let bucket: ActivitySummary[] = [];
    const flush = () => {
      if (bucket.length === 0) return;
      const monthStart = startOfMonth(bucket[0].startedAt);
      out.push({
        kind: 'header',
        key: `month-${monthStart}`,
        label: formatMonthLabel(monthStart),
        count: bucket.length,
        distanceM: bucket.reduce((sum, item) => sum + item.distanceM, 0),
      });
      bucket.forEach((activity) => out.push({ kind: 'item', key: activity.id, activity }));
      bucket = [];
    };

    for (const activity of filtered) {
      const month = startOfMonth(activity.startedAt);
      if (currentMonth !== -1 && month !== currentMonth) flush();
      currentMonth = month;
      bucket.push(activity);
    }
    flush();
    return out;
  }, [filtered, sort, range]);

  const advancedCount =
    (minKm > 0 ? 1 : 0) + (feeling !== 'all' ? 1 : 0) + (runType !== 'all' ? 1 : 0);
  const filtering = query.trim().length > 0 || range !== 'all' || advancedCount > 0;

  const SORTS: { key: typeof sort; label: string }[] = [
    { key: 'newest', label: 'Mới nhất' },
    { key: 'oldest', label: 'Cũ nhất' },
    { key: 'longest', label: 'Xa nhất' },
    { key: 'fastest', label: 'Nhanh nhất' },
  ];

  const backupOverdue =
    activities.length > 0 &&
    !!now &&
    (settings.lastBackupAt === 0 || now - settings.lastBackupAt > 30 * 86400000);
  const lastBackupLabel = settings.lastBackupAt
    ? `${new Date(settings.lastBackupAt).getDate()}/${new Date(settings.lastBackupAt).getMonth() + 1}/${new Date(settings.lastBackupAt).getFullYear()}`
    : 'chưa sao lưu';

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const onSeed = async () => {
    setSeeding(true);
    await seedSampleData(db, settings.weightKg);
    await refresh();
    setSeeding(false);
  };

  const toggleSearch = () => {
    if (searchOpen) setQuery('');
    setSearchOpen(!searchOpen);
  };

  const clearFilters = () => {
    setQuery('');
    setRange('all');
    setMinKm(0);
    setFeeling('all');
    setRunType('all');
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.topBar}>
        <Text style={styles.brand}>
          chaybo<Text style={styles.brandDot}>.</Text>
        </Text>
        <View style={styles.brandRight}>
          <Text style={styles.brandDate}>
            {now ? `${new Date(now).getDate()}/${new Date(now).getMonth() + 1}` : ''}
          </Text>
          <IconButton
            icon={searchOpen ? 'close-outline' : 'search-outline'}
            onPress={toggleSearch}
            color={searchOpen ? palette.accent : palette.textDim}
            size={19}
            accessibilityLabel={searchOpen ? 'Đóng tìm kiếm' : 'Tìm kiếm buổi chạy'}
          />
          <IconButton
            icon="settings-outline"
            onPress={() => router.push('/settings')}
            color={palette.textDim}
            size={19}
            accessibilityLabel="Cài đặt"
          />
        </View>
      </View>

      {searchOpen ? (
        <View style={styles.searchWrap}>
          <Ionicons name="search" size={15} color={palette.textFaint} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Tìm theo tên hoặc ghi chú"
            placeholderTextColor={palette.textFaint}
            style={styles.searchInput}
            autoFocus
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            selectionColor={palette.accent}
          />
        </View>
      ) : null}

      <FlatList
        data={rows}
        keyExtractor={(item) => item.key}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={palette.textDim}
          />
        }
        ListHeaderComponent={
          <View>
            <View style={styles.hero}>
              <Eyebrow>Tuần này</Eyebrow>
              <View style={styles.heroNumberLine}>
                <Text style={styles.heroNumber}>{u.dist(week.distanceM, 1)}</Text>
                <Text style={styles.heroUnit}>{u.label}</Text>
              </View>
              <Text style={styles.heroSub}>
                {week.count} buổi{weekPace ? ` · ${u.pace(weekPace)}${u.paceLabel}` : ''}
              </Text>

              {goalM > 0 ? (
                <View style={styles.goal}>
                  <View style={styles.goalTrack}>
                    <View style={[styles.goalFill, { width: `${goalPct * 100}%` }]} />
                  </View>
                  <View style={styles.goalRow}>
                    <Text style={[styles.goalText, goalReached && { color: palette.accent }]}>
                      {goalReached
                        ? 'Đã đạt mục tiêu tuần'
                        : `Mục tiêu ${u.dist(settings.weeklyGoalKm * 1000, 1)} ${u.label}`}
                    </Text>
                    <Text style={styles.goalPct}>{Math.round(goalPct * 100)}%</Text>
                  </View>
                </View>
              ) : null}
            </View>

            <View style={styles.filters}>
              {RANGES.map((option) => {
                const active = range === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setRange(option.key)}
                    style={({ pressed }) => [
                      styles.chip,
                      active && styles.chipActive,
                      pressed && { opacity: 0.65 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.chipText, active && styles.chipTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}

              {filtering ? (
                <Pressable
                  onPress={clearFilters}
                  style={({ pressed }) => [styles.clear, pressed && { opacity: 0.6 }]}
                  accessibilityRole="button"
                  accessibilityLabel="Xoá bộ lọc"
                >
                  <Text style={styles.clearText}>Xoá lọc</Text>
                </Pressable>
              ) : null}
            </View>

            <Pressable
              onPress={() => setFiltersOpen((value) => !value)}
              style={({ pressed }) => [styles.advancedToggle, pressed && { opacity: 0.65 }]}
              accessibilityRole="button"
              accessibilityState={{ expanded: filtersOpen }}
              accessibilityLabel="Bộ lọc nâng cao"
            >
              <Ionicons name="options-outline" size={14} color={palette.textDim} />
              <Text style={styles.advancedToggleText}>
                Bộ lọc nâng cao{advancedCount > 0 ? ` · ${advancedCount}` : ''}
              </Text>
              <Ionicons
                name={filtersOpen ? 'chevron-up' : 'chevron-down'}
                size={13}
                color={palette.textFaint}
              />
            </Pressable>

            {filtersOpen ? (
              <View style={styles.advancedPanel}>
                <Text style={styles.advancedLabel}>Cự ly tối thiểu</Text>
                <View style={styles.advancedRow}>
                  {DISTANCE_FILTERS.map((km) => {
                    const active = minKm === km;
                    return (
                      <Pressable
                        key={km}
                        onPress={() => setMinKm(km)}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          pressed && { opacity: 0.65 },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {km === 0 ? 'Mọi cự ly' : `≥ ${u.dist(km * 1000, 0)} ${u.label}`}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.advancedLabel}>Cảm giác</Text>
                <View style={styles.advancedRow}>
                  {FEELING_FILTERS.map((option) => {
                    const active = feeling === option.value;
                    return (
                      <Pressable
                        key={String(option.value)}
                        onPress={() => setFeeling(option.value)}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          pressed && { opacity: 0.65 },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                <Text style={styles.advancedLabel}>Loại buổi</Text>
                <View style={styles.advancedRow}>
                  <Pressable
                    onPress={() => setRunType('all')}
                    style={({ pressed }) => [
                      styles.chip,
                      runType === 'all' && styles.chipActive,
                      pressed && { opacity: 0.65 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: runType === 'all' }}
                  >
                    <Text style={[styles.chipText, runType === 'all' && styles.chipTextActive]}>
                      Tất cả
                    </Text>
                  </Pressable>
                  {RUN_TYPES.map((option) => {
                    const active = runType === option.key;
                    return (
                      <Pressable
                        key={option.key}
                        onPress={() => setRunType(option.key)}
                        style={({ pressed }) => [
                          styles.chip,
                          active && styles.chipActive,
                          pressed && { opacity: 0.65 },
                        ]}
                        accessibilityRole="button"
                        accessibilityState={{ selected: active }}
                      >
                        <Text style={[styles.chipText, active && styles.chipTextActive]}>
                          {option.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
              </View>
            ) : null}

            <View style={styles.sortRow}>
              <Text style={styles.sortLabel}>Sắp xếp</Text>
              {SORTS.map((option) => {
                const active = sort === option.key;
                return (
                  <Pressable
                    key={option.key}
                    onPress={() => setSort(option.key)}
                    style={({ pressed }) => [
                      styles.sortChip,
                      active && styles.sortChipActive,
                      pressed && { opacity: 0.65 },
                    ]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={[styles.sortChipText, active && styles.sortChipTextActive]}>
                      {option.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {backupOverdue ? (
              <Pressable
                onPress={() => router.push('/settings')}
                style={({ pressed }) => [styles.backupBanner, pressed && { opacity: 0.7 }]}
                accessibilityRole="button"
                accessibilityLabel="Nhắc sao lưu dữ liệu"
              >
                <Ionicons name="cloud-upload-outline" size={16} color={palette.accent} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.backupTitle}>Nên sao lưu dữ liệu</Text>
                  <Text style={styles.backupHint}>Lần cuối: {lastBackupLabel}</Text>
                </View>
                <Ionicons name="chevron-forward" size={14} color={palette.textFaint} />
              </Pressable>
            ) : null}

            <View style={styles.sectionRow}>
              <Eyebrow>Hoạt động</Eyebrow>
              <Text style={styles.count}>
                {filtered.length === activities.length
                  ? activities.length
                  : `${filtered.length}/${activities.length}`}
              </Text>
            </View>
          </View>
        }
        renderItem={({ item }) => {
          if (item.kind === 'header') {
            return (
              <View style={styles.monthHeader}>
                <Text style={styles.monthHeaderLabel}>{item.label}</Text>
                <Text style={styles.monthHeaderMeta}>
                  {item.count} buổi · {u.dist(item.distanceM, 1)} {u.label}
                </Text>
              </View>
            );
          }
          return (
            <ActivityRow
              activity={item.activity}
              onPress={() =>
                router.push({ pathname: '/activity/[id]', params: { id: item.activity.id } })
              }
            />
          );
        }}
        ListEmptyComponent={
          loading ? (
            <View style={styles.empty}>
              <ActivityIndicator color={palette.accent} />
            </View>
          ) : activities.length > 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Không tìm thấy buổi chạy</Text>
              <Text style={styles.emptyBody}>
                Thử từ khoá khác, hoặc xoá bộ lọc để xem toàn bộ lịch sử.
              </Text>
              <Button
                label="Xoá bộ lọc"
                variant="ghost"
                onPress={clearFilters}
                style={styles.emptyButton}
              />
            </View>
          ) : (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Chưa có buổi chạy nào</Text>
              <Text style={styles.emptyBody}>
                Bấm nút bắt đầu ở thanh dưới để ghi buổi chạy đầu tiên của bạn.
              </Text>
              <Button
                label="Bắt đầu chạy"
                icon="play"
                onPress={() => router.push('/record')}
                style={styles.emptyButton}
              />
              <Button
                label={seeding ? 'Đang tạo...' : 'Xem thử với dữ liệu mẫu'}
                variant="ghost"
                onPress={onSeed}
                disabled={seeding}
                style={styles.seedButton}
              />
            </View>
          )
        }
      />
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
  },
  brand: {
    fontSize: 22,
    fontWeight: '800',
    letterSpacing: -1,
    color: c.text,
  },
  brandDot: { color: c.accent },
  brandRight: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  brandDate: {
    fontSize: 11,
    letterSpacing: 1.2,
    color: c.textFaint,
    fontVariant: ['tabular-nums'],
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginHorizontal: 20,
    marginBottom: 12,
    paddingHorizontal: 12,
    height: 40,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.borderStrong,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: c.text,
    paddingVertical: 0,
  },
  content: { paddingHorizontal: 20, paddingBottom: 28 },
  hero: { paddingTop: 6, paddingBottom: 20 },
  heroNumberLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginTop: 6 },
  heroNumber: {
    fontSize: 68,
    lineHeight: 74,
    fontWeight: '800',
    letterSpacing: -3.5,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  heroUnit: { fontSize: 18, fontWeight: '700', color: c.accent, letterSpacing: 0.4 },
  heroSub: { fontSize: 13, color: c.textDim, marginTop: 2 },
  goal: { marginTop: 16, gap: 8 },
  goalTrack: {
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    overflow: 'hidden',
  },
  goalFill: { height: '100%', borderRadius: radius.pill, backgroundColor: c.accent },
  goalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  goalText: { fontSize: 11, color: c.textDim, letterSpacing: 0.2 },
  goalPct: {
    fontSize: 11,
    fontWeight: '700',
    color: c.accent,
    fontVariant: ['tabular-nums'],
  },
  filters: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingBottom: 14 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  chipActive: { backgroundColor: c.accentSoft, borderColor: c.accentLine },
  chipText: { fontSize: 11, fontWeight: '600', color: c.textDim },
  chipTextActive: { color: c.accent },
  clear: { marginLeft: 'auto', paddingVertical: 6, paddingLeft: 6 },
  clearText: { fontSize: 11, fontWeight: '600', color: c.textFaint },
  advancedToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    marginBottom: 12,
  },
  advancedToggleText: { fontSize: 10, fontWeight: '600', color: c.textDim },
  advancedPanel: {
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 12,
    marginBottom: 14,
    gap: 8,
  },
  advancedLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: c.textFaint,
  },
  advancedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  monthHeader: {
    paddingTop: 14,
    paddingBottom: 6,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    marginTop: 6,
  },
  monthHeaderLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.2,
  },
  monthHeaderMeta: { fontSize: 10, color: c.textFaint },
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingBottom: 12,
    flexWrap: 'wrap',
  },
  sortLabel: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: c.textFaint,
    marginRight: 4,
  },
  sortChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  sortChipActive: { backgroundColor: c.accentSoft, borderColor: c.accentLine },
  sortChipText: { fontSize: 10, fontWeight: '600', color: c.textDim },
  sortChipTextActive: { color: c.accent },
  backupBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    padding: 12,
    marginBottom: 12,
    borderRadius: radius.md,
    backgroundColor: c.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.accentLine,
  },
  backupTitle: { fontSize: 12, fontWeight: '700', color: c.text },
  backupHint: { fontSize: 10, color: c.textFaint, marginTop: 2 },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 6,
    paddingBottom: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: c.border,
    marginTop: 4,
  },
  count: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textFaint,
    fontVariant: ['tabular-nums'],
  },
  empty: { paddingTop: 40, alignItems: 'flex-start' },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.4,
  },
  emptyBody: {
    fontSize: 14,
    lineHeight: 21,
    color: c.textDim,
    marginTop: 8,
    maxWidth: 300,
  },
  emptyButton: { marginTop: 22, alignSelf: 'stretch' },
  seedButton: { marginTop: 10, alignSelf: 'stretch' },
});
