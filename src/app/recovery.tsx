import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSQLiteContext } from 'expo-sqlite';
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Eyebrow, IconButton } from '@/components/ui';
import { addRecoveryLog, deleteRecoveryLog, listRecoveryLogs } from '@/db/recovery';
import { useActivities } from '@/hooks/useActivities';
import { formatDayLabel } from '@/lib/format';
import {
  PAIN_AREAS,
  daysSinceLastRun,
  painAreaLabel,
  painLabel,
  recoveryAdvice,
  type PainArea,
  type RecoveryLog,
} from '@/lib/recovery';
import { radius, type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';

export default function RecoveryScreen() {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const router = useRouter();
  const db = useSQLiteContext();
  const { activities, fetchedAt } = useActivities();
  const now = fetchedAt ?? 0;

  const [logs, setLogs] = useState<RecoveryLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [area, setArea] = useState<PainArea>('knee');
  const [pain, setPain] = useState(2);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const rows = await listRecoveryLogs(db);
    setLogs(rows);
    setLoading(false);
  }, [db]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const rows = await listRecoveryLogs(db);
      if (!cancelled) {
        setLogs(rows);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [db]);

  const advice = now ? recoveryAdvice(logs, now) : null;
  const lastRunAt = activities.length > 0 ? Math.max(...activities.map((a) => a.startedAt)) : null;
  const restDays = now ? daysSinceLastRun(lastRunAt, now) : null;

  const save = async () => {
    if (!now || saving) return;
    setSaving(true);
    try {
      await addRecoveryLog(db, { at: now, area, pain, note });
      setNote('');
      await load();
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (log: RecoveryLog) => {
    Alert.alert('Xoá ghi chú?', `${painAreaLabel(log.area)} · ${formatDayLabel(log.at)}`, [
      { text: 'Huỷ', style: 'cancel' },
      {
        text: 'Xoá',
        style: 'destructive',
        onPress: () => {
          void (async () => {
            await deleteRecoveryLog(db, log.id);
            await load();
          })();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Quay lại" />
        <Text style={styles.headerTitle}>Hồi phục</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Eyebrow>Nhật ký đau &amp; hồi phục</Eyebrow>
        <Text style={styles.subtitle}>
          Ghi lại cảm giác đau sau khi chạy để phát hiện chấn thương sớm và điều chỉnh khối lượng.
        </Text>

        {advice ? (
          <View
            style={[
              styles.adviceCard,
              advice.level === 'rest' && styles.adviceCardDanger,
              advice.level === 'watch' && styles.adviceCardWatch,
            ]}
          >
            <View
              style={[
                styles.adviceIcon,
                advice.level === 'rest' && { backgroundColor: palette.dangerSoft },
                advice.level === 'watch' && { backgroundColor: palette.accentSoft },
              ]}
            >
              <Ionicons
                name={
                  advice.level === 'rest'
                    ? 'bed-outline'
                    : advice.level === 'watch'
                      ? 'alert-circle-outline'
                      : 'shield-checkmark-outline'
                }
                size={18}
                color={advice.level === 'rest' ? palette.danger : palette.accent}
              />
            </View>
            <View style={styles.adviceBody}>
              <Text
                style={[
                  styles.adviceTitle,
                  advice.level === 'rest' && { color: palette.danger },
                ]}
              >
                {advice.title}
              </Text>
              <Text style={styles.adviceText}>{advice.body}</Text>
            </View>
          </View>
        ) : null}

        {restDays != null ? (
          <View style={styles.restRow}>
            <Ionicons name="walk-outline" size={15} color={palette.textDim} />
            <Text style={styles.restText}>
              {restDays === 0
                ? 'Hôm nay bạn đã chạy.'
                : `Đã ${restDays} ngày kể từ buổi chạy gần nhất.`}
            </Text>
          </View>
        ) : null}

        <View style={styles.formCard}>
          <Text style={styles.formTitle}>Ghi nhận hôm nay</Text>

          <Text style={styles.fieldLabel}>Vị trí đau</Text>
          <View style={styles.areaWrap}>
            {PAIN_AREAS.map((item) => {
              const active = area === item.key;
              return (
                <Pressable
                  key={item.key}
                  onPress={() => setArea(item.key)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [
                    styles.areaChip,
                    active && styles.areaChipActive,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text style={[styles.areaChipText, active && styles.areaChipTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Mức độ · {painLabel(pain)}</Text>
          <View style={styles.painRow}>
            {[1, 2, 3, 4, 5].map((level) => {
              const active = pain === level;
              return (
                <Pressable
                  key={level}
                  onPress={() => setPain(level)}
                  accessibilityRole="button"
                  accessibilityLabel={`Mức đau ${level}`}
                  style={({ pressed }) => [
                    styles.painDot,
                    active && styles.painDotActive,
                    level >= 4 && active && styles.painDotDanger,
                    pressed && { opacity: 0.7 },
                  ]}
                >
                  <Text
                    style={[
                      styles.painDotText,
                      active && styles.painDotTextActive,
                      level >= 4 && active && { color: palette.danger },
                    ]}
                  >
                    {level}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          <Text style={styles.fieldLabel}>Ghi chú</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Ví dụ: đau khi xuống dốc, nhức sau buổi tempo…"
            placeholderTextColor={palette.textFaint}
            style={styles.input}
            multiline
            maxLength={400}
          />

          <Button
            label={saving ? 'Đang lưu…' : 'Lưu ghi chú'}
            icon="add-circle-outline"
            onPress={() => void save()}
            disabled={!now || saving}
            style={styles.saveButton}
          />
        </View>

        <Eyebrow style={styles.spaced}>Lịch sử</Eyebrow>
        {loading ? (
          <ActivityIndicator color={palette.accent} style={styles.loading} />
        ) : logs.length === 0 ? (
          <Text style={styles.emptyText}>Chưa có ghi chú nào. Hãy bắt đầu từ hôm nay.</Text>
        ) : (
          logs.map((log) => (
            <View key={log.id} style={styles.logCard}>
              <View style={styles.logHead}>
                <View
                  style={[
                    styles.logBadge,
                    log.pain >= 4 ? { backgroundColor: palette.dangerSoft } : null,
                  ]}
                >
                  <Text
                    style={[
                      styles.logBadgeText,
                      log.pain >= 4 && { color: palette.danger },
                    ]}
                  >
                    {log.pain}
                  </Text>
                </View>
                <View style={styles.logBody}>
                  <Text style={styles.logTitle}>
                    {painAreaLabel(log.area)} · {painLabel(log.pain)}
                  </Text>
                  <Text style={styles.logDate}>{formatDayLabel(log.at)}</Text>
                </View>
                <Pressable
                  onPress={() => confirmDelete(log)}
                  hitSlop={10}
                  accessibilityRole="button"
                  accessibilityLabel="Xoá ghi chú"
                  style={({ pressed }) => pressed && { opacity: 0.5 }}
                >
                  <Ionicons name="trash-outline" size={16} color={palette.textFaint} />
                </Pressable>
              </View>
              {log.note ? <Text style={styles.logNote}>{log.note}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
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
  subtitle: { fontSize: 11, color: c.textFaint, lineHeight: 17, marginTop: 8, marginBottom: 16 },
  adviceCard: {
    flexDirection: 'row',
    gap: 12,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.accentLine,
    padding: 16,
  },
  adviceCardWatch: { borderColor: c.borderStrong },
  adviceCardDanger: { borderColor: c.danger, backgroundColor: c.bgElevated },
  adviceIcon: {
    width: 36,
    height: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  adviceBody: { flex: 1, gap: 3 },
  adviceTitle: { fontSize: 13, fontWeight: '700', color: c.accent },
  adviceText: { fontSize: 11, color: c.textDim, lineHeight: 17 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  restText: { fontSize: 11, color: c.textDim },
  formCard: {
    marginTop: 18,
    backgroundColor: c.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 16,
  },
  formTitle: { fontSize: 14, fontWeight: '700', color: c.text, marginBottom: 4 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: c.textFaint,
    marginTop: 14,
    marginBottom: 8,
  },
  areaWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  areaChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
  },
  areaChipActive: { backgroundColor: c.accentSoft, borderColor: c.accentLine },
  areaChipText: { fontSize: 11, fontWeight: '600', color: c.textDim },
  areaChipTextActive: { color: c.accent },
  painRow: { flexDirection: 'row', gap: 8 },
  painDot: {
    flex: 1,
    height: 38,
    borderRadius: radius.sm,
    backgroundColor: c.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  painDotActive: { backgroundColor: c.accentSoft, borderWidth: 1, borderColor: c.accentLine },
  painDotDanger: { backgroundColor: c.dangerSoft, borderColor: c.danger },
  painDotText: {
    fontSize: 14,
    fontWeight: '700',
    color: c.textDim,
    fontVariant: ['tabular-nums'],
  },
  painDotTextActive: { color: c.accent },
  input: {
    backgroundColor: c.bgElevated,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    minHeight: 74,
    fontSize: 12,
    lineHeight: 18,
    color: c.text,
    textAlignVertical: 'top',
  },
  saveButton: { marginTop: 16 },
  spaced: { marginTop: 28 },
  loading: { marginTop: 16 },
  emptyText: { fontSize: 11, color: c.textFaint, marginTop: 12 },
  logCard: {
    marginTop: 10,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 14,
    gap: 8,
  },
  logHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  logBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    backgroundColor: c.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    color: c.accent,
    fontVariant: ['tabular-nums'],
  },
  logBody: { flex: 1, gap: 1 },
  logTitle: { fontSize: 12, fontWeight: '700', color: c.text },
  logDate: { fontSize: 10, color: c.textFaint },
  logNote: { fontSize: 11, color: c.textDim, lineHeight: 17 },
});
