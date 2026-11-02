import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Eyebrow, IconButton } from '@/components/ui';
import { listAllActivities } from '@/db/activities';
import { personalBests } from '@/lib/efforts';
import { formatDayLabel, formatDuration, formatKmDecimal, formatPace } from '@/lib/format';
import { predictRaces } from '@/lib/racePredictor';
import { colors, radius } from '@/lib/theme';
import type { Activity } from '@/lib/types';

export default function RecordsScreen() {
  const router = useRouter();
  const db = useSQLiteContext();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const rows = await listAllActivities(db);
      if (!cancelled) {
        setActivities(rows);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [db]);

  const bests = useMemo(() => personalBests(activities), [activities]);
  const bestCount = bests.filter((row) => row.effort).length;

  const predictions = useMemo(() => {
    const reference =
      bests.find((row) => row.key === '5k' && row.effort) ??
      bests.find((row) => row.key === '10k' && row.effort) ??
      bests.find((row) => row.key === '1k' && row.effort);
    if (!reference?.effort) return [];
    return predictRaces(reference.meters, reference.effort.durationS);
  }, [bests]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Quay lại" />
        <Text style={styles.headerTitle}>Kỷ lục cá nhân</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Eyebrow>Best efforts</Eyebrow>
          <Text style={styles.heroTitle}>Nhanh nhất ở mỗi cự ly</Text>
          <Text style={styles.heroBody}>
            Quãng đường chạy liên tục nhanh nhất của bạn, tính trên toàn bộ lộ trình GPS đã lưu.
          </Text>
        </View>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator color={colors.accent} />
          </View>
        ) : (
          <View style={styles.list}>
            {bests.map((row) => {
              const effort = row.effort;
              const activity = row.activity;

              return (
                <Pressable
                  key={row.key}
                  disabled={!activity}
                  onPress={() => {
                    if (!activity) return;
                    router.push({ pathname: '/activity/[id]', params: { id: activity.id } });
                  }}
                  style={({ pressed }) => [
                    styles.card,
                    effort && styles.cardActive,
                    pressed && { opacity: 0.65 },
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    effort
                      ? `${row.label}: ${formatDuration(effort.durationS)}`
                      : `${row.label}: chưa có dữ liệu`
                  }
                >
                  <View style={styles.cardHead}>
                    <Text style={styles.distanceLabel}>{row.label}</Text>
                    {effort ? (
                      <View style={styles.pacePill}>
                        <Text style={styles.pacePillText}>{formatPace(effort.paceSPerKm)}/km</Text>
                      </View>
                    ) : null}
                  </View>

                  {effort && activity ? (
                    <>
                      <Text style={styles.time}>{formatDuration(effort.durationS)}</Text>
                      <View style={styles.metaRow}>
                        <Text style={styles.metaText} numberOfLines={1}>
                          {activity.title}
                        </Text>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaText}>{formatDayLabel(activity.startedAt)}</Text>
                        <Text style={styles.metaDot}>·</Text>
                        <Text style={styles.metaText}>
                          {formatKmDecimal(activity.distanceM, 1)} km
                        </Text>
                      </View>
                    </>
                  ) : (
                    <Text style={styles.emptyText}>
                      Cần một buổi chạy dài ít nhất {row.label} để có kỷ lục này.
                    </Text>
                  )}
                </Pressable>
              );
            })}
          </View>
        )}

        {predictions.length > 0 ? (
          <View style={styles.predictionCard}>
            <Eyebrow>Dự đoán thành tích</Eyebrow>
            <Text style={styles.predictionHint}>
              Dựa trên kỷ lục tốt nhất (Riegel). Chỉ mang tính tham khảo.
            </Text>
            {predictions.map((prediction) => (
              <View key={prediction.label} style={styles.predictionRow}>
                <Text style={styles.predictionLabel}>{prediction.label}</Text>
                <Text style={styles.predictionValue}>
                  {formatDuration(prediction.seconds)}
                </Text>
              </View>
            ))}
          </View>
        ) : null}

        <Text style={styles.footnote}>
          {bestCount}/{bests.length} cự ly đã có kỷ lục. Best effort dùng cửa sổ trượt trên
          lộ trình nên không phụ thuộc vào việc chia km.
        </Text>
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
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 40 },
  hero: { paddingBottom: 22 },
  heroTitle: {
    marginTop: 6,
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: -1.1,
    color: colors.text,
  },
  heroBody: { marginTop: 8, fontSize: 13, lineHeight: 20, color: colors.textDim, maxWidth: 320 },
  loading: { paddingVertical: 40, alignItems: 'center' },
  list: { gap: 10 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
  },
  cardActive: { borderColor: colors.accentLine },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  distanceLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
    color: colors.textDim,
  },
  pacePill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.accentSoft,
  },
  pacePillText: {
    fontSize: 10,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
  time: {
    marginTop: 6,
    fontSize: 38,
    lineHeight: 44,
    fontWeight: '800',
    letterSpacing: -1.8,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  metaText: { fontSize: 11, color: colors.textFaint, flexShrink: 1 },
  metaDot: { fontSize: 11, color: colors.textFaint },
  emptyText: { marginTop: 8, fontSize: 12, lineHeight: 18, color: colors.textFaint },
  footnote: { marginTop: 18, fontSize: 10, lineHeight: 16, color: colors.textFaint },
  predictionCard: {
    marginTop: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 16,
    gap: 6,
  },
  predictionHint: { fontSize: 11, color: colors.textFaint, marginBottom: 4 },
  predictionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  predictionLabel: { fontSize: 13, color: colors.textDim, fontWeight: '600' },
  predictionValue: {
    fontSize: 13,
    fontWeight: '700',
    color: colors.accent,
    fontVariant: ['tabular-nums'],
  },
});
