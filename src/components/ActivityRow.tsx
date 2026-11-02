import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDayLabel, formatDuration, formatTime } from '@/lib/format';
import { useUnit } from '@/hooks/useUnit';
import { feelingEmoji } from '@/lib/feeling';
import { runTypeShort } from '@/lib/runType';
import { type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';
import type { ActivitySummary } from '@/lib/types';
import { RouteShape } from './RouteShape';

type Props = {
  activity: ActivitySummary;
  onPress: () => void;
};

export function ActivityRow({ activity, onPress }: Props) {
  const u = useUnit();
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}, ${u.dist(activity.distanceM)} ${u.label}`}
    >
      <View style={styles.left}>
        <View style={styles.metaRow}>
          <Text style={styles.meta}>
            {formatDayLabel(activity.startedAt)} · {formatTime(activity.startedAt)}
          </Text>
          {feelingEmoji(activity.feeling) ? (
            <Text style={styles.feeling}>{feelingEmoji(activity.feeling)}</Text>
          ) : null}
          {activity.runType ? (
            <Text style={styles.runType}>{runTypeShort(activity.runType)}</Text>
          ) : null}
        </View>

        <View style={styles.distanceLine}>
          <Text style={styles.distance}>{u.dist(activity.distanceM)}</Text>
          <Text style={styles.unit}>{u.label}</Text>
        </View>

        <Text style={styles.sub}>
          {formatDuration(activity.durationS)} · {u.pace(activity.avgPaceS)}{u.paceLabel}
        </Text>
      </View>

      <View style={styles.thumb}>
        {activity.preview.length > 1 ? (
          <RouteShape
            points={activity.preview}
            width={78}
            height={52}
            strokeWidth={1.6}
            color={palette.textFaint}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    gap: 12,
  },
  pressed: { opacity: 0.6 },
  left: { flex: 1 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  meta: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: c.textFaint,
  },
  feeling: { fontSize: 13 },
  runType: {
    fontSize: 9,
    fontWeight: '700',
    color: c.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: c.accentSoft,
    overflow: 'hidden',
  },
  distanceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  distance: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1.2,
    color: c.text,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 13, fontWeight: '600', color: c.textDim },
  sub: {
    marginTop: 2,
    fontSize: 13,
    color: c.textDim,
    fontVariant: ['tabular-nums'],
  },
  thumb: { width: 78, height: 52, alignItems: 'center', justifyContent: 'center' },
});
