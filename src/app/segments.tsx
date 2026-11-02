import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, IconButton } from '@/components/ui';
import { useActivities } from '@/hooks/useActivities';
import { formatDayLabel, formatDuration, formatKmDecimal, formatPace } from '@/lib/format';
import { findSegments, type PersonalSegment } from '@/lib/segments';
import { colors, radius } from '@/lib/theme';

export default function SegmentsScreen() {
  const router = useRouter();
  const { activities } = useActivities();
  const [openId, setOpenId] = useState<string | null>(null);

  const segments = useMemo(() => findSegments(activities), [activities]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Quay lại" />
        <Text style={styles.headerTitle}>Đoạn chạy quen</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Eyebrow>{`${segments.length} đoạn · dựa trên điểm đầu và cuối`}</Eyebrow>
        <Text style={styles.subtitle}>
          Những cung đường bạn chạy lặp lại. Điểm đầu và điểm cuối cách nhau dưới 200 m được
          xem là cùng một đoạn.
        </Text>

        {segments.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="git-compare-outline" size={30} color={colors.textFaint} />
            <Text style={styles.emptyTitle}>Chưa tìm thấy đoạn nào</Text>
            <Text style={styles.emptyBody}>
              Chạy lặp lại cùng một cung đường ít nhất 2 lần để xem so sánh thời gian tại đây.
            </Text>
          </View>
        ) : (
          segments.map((segment) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              open={openId === segment.id}
              onToggle={() => setOpenId(openId === segment.id ? null : segment.id)}
            />
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SegmentCard({
  segment,
  open,
  onToggle,
}: {
  segment: PersonalSegment;
  open: boolean;
  onToggle: () => void;
}) {
  const worst = segment.runs[segment.runs.length - 1];

  return (
    <View style={styles.card}>
      <Pressable
        onPress={onToggle}
        style={({ pressed }) => [styles.cardHead, pressed && { opacity: 0.75 }]}
        accessibilityRole="button"
        accessibilityLabel="Xem chi tiết đoạn chạy"
      >
        <View style={styles.iconWrap}>
          <Ionicons name="git-compare" size={18} color={colors.accent} />
        </View>
        <View style={styles.cardHeadBody}>
          <Text style={styles.cardTitle}>{formatKmDecimal(segment.distanceM, 1)} km</Text>
          <Text style={styles.cardSub}>{segment.runs.length} lần chạy</Text>
        </View>
        <View style={styles.bestBlock}>
          <Text style={styles.bestLabel}>TỐT NHẤT</Text>
          <Text style={styles.bestValue}>{formatDuration(segment.best.durationS)}</Text>
        </View>
        <Ionicons
          name={open ? 'chevron-up' : 'chevron-down'}
          size={16}
          color={colors.textFaint}
        />
      </Pressable>

      <View style={styles.metaRow}>
        <Meta label="Pace tốt nhất" value={`${formatPace(segment.best.paceSPerKm)}/km`} />
        <Meta
          label="Lần gần nhất"
          value={
            segment.latestGapS == null
              ? '--'
              : segment.latestGapS <= 0
                ? 'Nhanh nhất'
                : `+${formatDuration(segment.latestGapS)}`
          }
        />
        <Meta label="Chênh lệch" value={`+${formatDuration(worst.durationS - segment.best.durationS)}`} />
      </View>

      {open ? (
        <View style={styles.runList}>
          {segment.runs.map((run, index) => {
            const gap = run.durationS - segment.best.durationS;
            return (
              <View key={run.activityId} style={styles.runRow}>
                <Text style={styles.runRank}>{index + 1}</Text>
                <View style={styles.runBody}>
                  <Text style={styles.runTitle} numberOfLines={1}>
                    {run.title}
                  </Text>
                  <Text style={styles.runDate}>{formatDayLabel(run.startedAt)}</Text>
                </View>
                <View style={styles.runRight}>
                  <Text style={styles.runTime}>{formatDuration(run.durationS)}</Text>
                  <Text style={styles.runGap}>
                    {gap <= 0 ? 'PB' : `+${formatDuration(gap)}`}
                  </Text>
                </View>
              </View>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.meta}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6 },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    letterSpacing: -0.2,
  },
  headerSpacer: { width: 36 },
  content: { paddingHorizontal: 20, paddingBottom: 44 },
  subtitle: { fontSize: 11, color: colors.textFaint, lineHeight: 17, marginTop: 8, marginBottom: 4 },
  empty: {
    alignItems: 'center',
    gap: 8,
    marginTop: 40,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 28,
  },
  emptyTitle: { fontSize: 14, fontWeight: '700', color: colors.text },
  emptyBody: { fontSize: 11, color: colors.textFaint, textAlign: 'center', lineHeight: 17 },
  card: {
    marginTop: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: radius.sm,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardHeadBody: { flex: 1, gap: 2 },
  cardTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    letterSpacing: -0.5,
    fontVariant: ['tabular-nums'],
  },
  cardSub: { fontSize: 10, color: colors.textFaint },
  bestBlock: { alignItems: 'flex-end', gap: 1 },
  bestLabel: { fontSize: 8, fontWeight: '700', letterSpacing: 1, color: colors.textFaint },
  bestValue: {
    fontSize: 16,
    fontWeight: '800',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
    letterSpacing: -0.5,
  },
  metaRow: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  meta: { flex: 1, gap: 3 },
  metaLabel: { fontSize: 9, color: colors.textFaint },
  metaValue: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  runList: { marginTop: 10 },
  runRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 9,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  runRank: {
    width: 18,
    fontSize: 11,
    fontWeight: '700',
    color: colors.textFaint,
    fontVariant: ['tabular-nums'],
  },
  runBody: { flex: 1, gap: 1 },
  runTitle: { fontSize: 12, fontWeight: '600', color: colors.text },
  runDate: { fontSize: 9, color: colors.textFaint },
  runRight: { alignItems: 'flex-end', gap: 1 },
  runTime: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  runGap: { fontSize: 9, color: colors.textFaint, fontVariant: ['tabular-nums'] },
});
