import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useActivities } from '@/hooks/useActivities';
import { useUnit } from '@/hooks/useUnit';
import { formatDuration, formatDayLabel } from '@/lib/format';
import { radius, type Palette } from '@/lib/theme';
import { useThemedStyles } from '@/hooks/useTheme';

export default function CompareScreen() {
  const router = useRouter();
  const u = useUnit();
  const styles = useThemedStyles(createStyles);
  const { activities } = useActivities();
  const [selected, setSelected] = useState<string[]>([]);

  const a = useMemo(() => activities.find((x) => x.id === selected[0]) ?? null, [activities, selected]);
  const b = useMemo(() => activities.find((x) => x.id === selected[1]) ?? null, [activities, selected]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id];
      return [...prev, id];
    });
  };

  const rows: { label: string; va: string; vb: string }[] =
    a && b
      ? [
          { label: 'Ngày', va: formatDayLabel(a.startedAt), vb: formatDayLabel(b.startedAt) },
          { label: 'Quãng đường', va: `${u.dist(a.distanceM, 2)} ${u.label}`, vb: `${u.dist(b.distanceM, 2)} ${u.label}` },
          { label: 'Thời gian', va: formatDuration(a.durationS), vb: formatDuration(b.durationS) },
          { label: 'Pace TB', va: `${u.pace(a.avgPaceS)}${u.paceLabel}`, vb: `${u.pace(b.avgPaceS)}${u.paceLabel}` },
          { label: 'Độ cao', va: `${Math.round(a.elevGainM)} m`, vb: `${Math.round(b.elevGainM)} m` },
        ]
      : [];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.back}>
          <Text style={styles.backLabel}>← Quay lại</Text>
        </Pressable>
        <Text style={styles.title}>So sánh buổi chạy</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {selected.length < 2 ? (
          <Text style={styles.hint}>Chọn 2 buổi chạy trong danh sách bên dưới để so sánh.</Text>
        ) : (
          <View style={styles.table}>
            <View style={styles.tableHeader}>
              <Text style={styles.tableHead}>Chỉ số</Text>
              <Text style={styles.tableHead}>Buổi A</Text>
              <Text style={styles.tableHead}>Buổi B</Text>
            </View>
            {rows.map((r) => (
              <View key={r.label} style={styles.tableRow}>
                <Text style={styles.tableLabel}>{r.label}</Text>
                <Text style={styles.tableVal}>{r.va}</Text>
                <Text style={styles.tableVal}>{r.vb}</Text>
              </View>
            ))}
          </View>
        )}

        <Text style={styles.listTitle}>Chọn buổi chạy</Text>
        {activities.slice(0, 40).map((act) => {
          const isSel = selected.includes(act.id);
          return (
            <Pressable
              key={act.id}
              onPress={() => toggle(act.id)}
              style={({ pressed }) => [
                styles.item,
                isSel && styles.itemSelected,
                pressed && { opacity: 0.7 },
              ]}
            >
              <View style={[styles.checkbox, isSel && styles.checkboxOn]}>
                {isSel ? <Text style={styles.check}>✓</Text> : null}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {act.title}
                </Text>
                <Text style={styles.itemMeta}>
                  {formatDayLabel(act.startedAt)} · {u.dist(act.distanceM, 2)} {u.label}
                </Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
    safe: { flex: 1, backgroundColor: c.bg },
    header: { paddingHorizontal: 20, paddingTop: 10, paddingBottom: 8, gap: 4 },
    back: { paddingVertical: 4 },
    backLabel: { color: c.accent, fontSize: 13, fontWeight: '600' },
    title: { fontSize: 22, fontWeight: '800', color: c.text },
    content: { paddingHorizontal: 20, paddingBottom: 40, gap: 12 },
    hint: { fontSize: 13, color: c.textDim },
    listTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', color: c.textFaint, marginTop: 8 },
    table: { backgroundColor: c.surface, borderRadius: radius.md, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, overflow: 'hidden' },
    tableHeader: { flexDirection: 'row', backgroundColor: c.bgElevated, paddingVertical: 8, paddingHorizontal: 12 },
    tableHead: { flex: 1, fontSize: 11, fontWeight: '700', color: c.textFaint },
    tableRow: { flexDirection: 'row', paddingVertical: 8, paddingHorizontal: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: c.border },
    tableLabel: { flex: 1, fontSize: 12, color: c.textDim },
    tableVal: { flex: 1, fontSize: 12, fontWeight: '600', color: c.text },
    item: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      padding: 10,
      borderRadius: radius.md,
      backgroundColor: c.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: c.border,
    },
    itemSelected: { borderColor: c.accentLine, backgroundColor: c.accentSoft },
    checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' },
    checkboxOn: { backgroundColor: c.accentFill, borderColor: c.accentFill },
    check: { color: c.onAccent, fontSize: 13, fontWeight: '800' },
    itemTitle: { fontSize: 13, fontWeight: '600', color: c.text },
    itemMeta: { fontSize: 11, color: c.textDim, marginTop: 2 },
  });