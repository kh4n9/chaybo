import { Pressable, StyleSheet, Text, View } from 'react-native';

import { formatDayLabel, formatDuration, formatKmDecimal, formatPace, formatTime } from '@/lib/format';
import { feelingEmoji } from '@/lib/feeling';
import { runTypeShort } from '@/lib/runType';
import { colors } from '@/lib/theme';
import type { ActivitySummary } from '@/lib/types';
import { RouteShape } from './RouteShape';

type Props = {
  activity: ActivitySummary;
  onPress: () => void;
};

export function ActivityRow({ activity, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      accessibilityRole="button"
      accessibilityLabel={`${activity.title}, ${formatKmDecimal(activity.distanceM)} km`}
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
          <Text style={styles.distance}>{formatKmDecimal(activity.distanceM)}</Text>
          <Text style={styles.unit}>km</Text>
        </View>

        <Text style={styles.sub}>
          {formatDuration(activity.durationS)} · {formatPace(activity.avgPaceS)}/km
        </Text>
      </View>

      <View style={styles.thumb}>
        {activity.preview.length > 1 ? (
          <RouteShape
            points={activity.preview}
            width={78}
            height={52}
            strokeWidth={1.6}
            color={colors.textFaint}
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 18,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
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
    color: colors.textFaint,
  },
  feeling: { fontSize: 13 },
  runType: {
    fontSize: 9,
    fontWeight: '700',
    color: colors.accent,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: colors.accentSoft,
    overflow: 'hidden',
  },
  distanceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  distance: {
    fontSize: 30,
    fontWeight: '800',
    letterSpacing: -1.2,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 13, fontWeight: '600', color: colors.textDim },
  sub: {
    marginTop: 2,
    fontSize: 13,
    color: colors.textDim,
    fontVariant: ['tabular-nums'],
  },
  thumb: { width: 78, height: 52, alignItems: 'center', justifyContent: 'center' },
});
