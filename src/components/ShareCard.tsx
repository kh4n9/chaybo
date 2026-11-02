import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, Text, View } from 'react-native';

import { formatDuration, formatFullDate } from '@/lib/format';
import { useUnit } from '@/hooks/useUnit';
import { darkColors as colors, monoFont } from '@/lib/theme';
import type { Activity } from '@/lib/types';
import { RouteShape } from './RouteShape';

export type ShareCardVariant = 'classic' | 'minimal' | 'poster' | 'neon';

type Props = {
  activity: Activity;
  width?: number;
  cardRef?: React.Ref<React.ComponentRef<typeof View>>;
  variant?: ShareCardVariant;
};

const ASPECT = 1.25;

/** 4:5 card designed to be screenshotted and shared. */
export function ShareCard({ activity, width = 320, cardRef, variant = 'classic' }: Props) {
  const height = Math.round(width * ASPECT);

  return (
    <View ref={cardRef} collapsable={false} style={[styles.card, { width, height }]}>
      {variant === 'classic' ? (
        <ClassicCard activity={activity} width={width} height={height} />
      ) : null}
      {variant === 'minimal' ? (
        <MinimalCard activity={activity} width={width} height={height} />
      ) : null}
      {variant === 'poster' ? (
        <PosterCard activity={activity} width={width} height={height} />
      ) : null}
      {variant === 'neon' ? (
        <NeonCard activity={activity} width={width} height={height} />
      ) : null}
    </View>
  );
}

function ClassicCard({
  activity,
  width,
  height,
}: {
  activity: Activity;
  width: number;
  height: number;
}) {
  const u = useUnit();
  const routeWidth = width - 56;
  const routeHeight = Math.round(height * 0.42);

  return (
    <View style={styles.fill}>
      <LinearGradient
        colors={['#171A1D', '#0A0B0C', '#08090A']}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.topRow}>
        <Wordmark />
        <Text style={styles.date}>{formatFullDate(activity.startedAt)}</Text>
      </View>

      <View style={[styles.routeArea, { height: routeHeight }]}>
        <RouteShape
          points={activity.route}
          width={routeWidth}
          height={routeHeight}
          strokeWidth={2.6}
          glow
          showEndpoints
          endpointFill={colors.bg}
        />
      </View>

      <View style={styles.bottom}>
        <View style={styles.distanceLine}>
          <Text style={styles.distance}>{u.dist(activity.distanceM)}</Text>
          <Text style={styles.unit}>{u.label}</Text>
        </View>

        <Text style={styles.title}>{activity.title}</Text>

        <View style={styles.statsRow}>
          <Stat label="THỜI GIAN" value={formatDuration(activity.durationS)} />
          <View style={styles.divider} />
          <Stat label="PACE" value={`${u.pace(activity.avgPaceS)}${u.paceLabel}`} />
          <View style={styles.divider} />
          <Stat label="ĐỘ CAO" value={`${u.elev(activity.elevGainM)} ${u.elevLabel}`} />
        </View>
      </View>

      <Text style={styles.tagline}>CHẠY BỘ MỖI NGÀY</Text>
    </View>
  );
}

function MinimalCard({
  activity,
  width,
  height,
}: {
  activity: Activity;
  width: number;
  height: number;
}) {
  const u = useUnit();
  const routeWidth = width - 64;
  const routeHeight = Math.round(height * 0.44);

  return (
    <View style={[styles.fill, styles.minimalBg]}>
      <View style={styles.topRow}>
        <Wordmark />
        <Text style={styles.date}>{formatFullDate(activity.startedAt)}</Text>
      </View>

      <View style={[styles.routeArea, { height: routeHeight }]}>
        <RouteShape
          points={activity.route}
          width={routeWidth}
          height={routeHeight}
          strokeWidth={1.8}
          glow
          showEndpoints
          endpointFill={colors.bg}
        />
      </View>

      <View style={styles.bottom}>
        <Text style={styles.minimalTitle} numberOfLines={1}>
          {activity.title}
        </Text>
        <View style={styles.distanceLine}>
          <Text style={[styles.distance, styles.minimalDistance]}>
            {u.dist(activity.distanceM)}
          </Text>
          <Text style={styles.unit}>{u.label}</Text>
        </View>
        <Text style={styles.minimalStats}>
          {formatDuration(activity.durationS)} · {u.pace(activity.avgPaceS)}{u.paceLabel} ·{' '}
          {u.elev(activity.elevGainM)} {u.elevLabel}
        </Text>
      </View>

      <View style={styles.minimalFooter}>
        <Text style={styles.tagline}>CHẠY BỘ MỖI NGÀY</Text>
        <Text style={styles.minimalMark}>CB</Text>
      </View>
    </View>
  );
}

function PosterCard({
  activity,
  width,
  height,
}: {
  activity: Activity;
  width: number;
  height: number;
}) {
  const u = useUnit();
  const routeWidth = width - 56;
  const routeHeight = Math.round(height * 0.38);

  return (
    <View style={[styles.fill, styles.posterBg]}>
      <View style={styles.topRow}>
        <Text style={[styles.wordmark, styles.posterInk]}>
          chaybo<Text style={styles.posterDot}>.</Text>
        </Text>
        <Text style={[styles.date, styles.posterInkFaint]}>
          {formatFullDate(activity.startedAt)}
        </Text>
      </View>

      <View style={[styles.routeArea, { height: routeHeight }]}>
        <RouteShape
          points={activity.route}
          width={routeWidth}
          height={routeHeight}
          color={colors.bg}
          strokeWidth={2.4}
          showEndpoints
          endpointFill={colors.accent}
        />
      </View>

      <View style={styles.bottom}>
        <Text style={[styles.posterTitle, styles.posterInk]} numberOfLines={1}>
          {activity.title}
        </Text>
        <View style={styles.distanceLine}>
          <Text style={[styles.distance, styles.posterDistance, styles.posterInk]}>
            {u.dist(activity.distanceM)}
          </Text>
          <Text style={[styles.unit, styles.posterInk]}>{u.label}</Text>
        </View>

        <View style={[styles.statsRow, styles.posterStatsRow]}>
          <PosterStat label="THỜI GIAN" value={formatDuration(activity.durationS)} />
          <View style={[styles.divider, styles.posterDivider]} />
          <PosterStat label="PACE" value={`${u.pace(activity.avgPaceS)}${u.paceLabel}`} />
          <View style={[styles.divider, styles.posterDivider]} />
          <PosterStat label="ĐỘ CAO" value={`${u.elev(activity.elevGainM)} ${u.elevLabel}`} />
        </View>
      </View>

      <Text style={[styles.tagline, styles.posterInk]}>CHẠY BỘ MỖI NGÀY</Text>
    </View>
  );
}

function NeonCard({
  activity,
  width,
  height,
}: {
  activity: Activity;
  width: number;
  height: number;
}) {
  const u = useUnit();
  const routeWidth = width - 56;
  const routeHeight = Math.round(height * 0.4);

  return (
    <View style={[styles.fill, { backgroundColor: '#0A0B0C' }]}>
      <LinearGradient
        colors={['rgba(216,255,62,0.18)', 'transparent']}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.topRow}>
        <Wordmark />
        <Text style={styles.date}>{formatFullDate(activity.startedAt)}</Text>
      </View>

      <View style={[styles.routeArea, { height: routeHeight }]}>
        <RouteShape
          points={activity.route}
          width={routeWidth}
          height={routeHeight}
          color={colors.accent}
          strokeWidth={2.6}
          glow
          showEndpoints
          endpointFill={colors.bg}
        />
      </View>

      <View style={styles.bottom}>
        <Text style={[styles.title, { color: colors.accent }]} numberOfLines={1}>
          {activity.title}
        </Text>
        <View style={styles.distanceLine}>
          <Text style={[styles.distance, { color: colors.text }]}>
            {u.dist(activity.distanceM)}
          </Text>
          <Text style={[styles.unit, { color: colors.accent }]}>{u.label}</Text>
        </View>
        <Text style={styles.minimalStats}>
          {formatDuration(activity.durationS)} · {u.pace(activity.avgPaceS)}{u.paceLabel} ·{' '}
          {u.elev(activity.elevGainM)} {u.elevLabel}
        </Text>
      </View>
    </View>
  );
}

function Wordmark() {
  return (
    <Text style={styles.wordmark}>
      chaybo<Text style={styles.dot}>.</Text>
    </Text>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function PosterStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={[styles.statLabel, styles.posterInkFaint]}>{label}</Text>
      <Text style={[styles.statValue, styles.posterInk]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    overflow: 'hidden',
    borderRadius: 0,
    backgroundColor: colors.bg,
  },
  fill: {
    flex: 1,
    paddingHorizontal: 28,
    paddingTop: 26,
    paddingBottom: 22,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  wordmark: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: colors.text,
  },
  dot: { color: colors.accent },
  date: {
    fontSize: 10,
    fontWeight: '600',
    letterSpacing: 1,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  routeArea: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  bottom: { gap: 2 },
  distanceLine: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  distance: {
    fontSize: 64,
    lineHeight: 68,
    fontWeight: '800',
    letterSpacing: -3,
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  unit: { fontSize: 20, fontWeight: '700', color: colors.accent },
  title: { fontSize: 13, color: colors.textDim, marginTop: 2 },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  stat: { flex: 1 },
  statLabel: {
    fontSize: 8,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: colors.textFaint,
    marginBottom: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '700',
    color: colors.text,
    fontVariant: ['tabular-nums'],
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 22,
    backgroundColor: colors.border,
    marginHorizontal: 10,
  },
  tagline: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 2.4,
    color: colors.textFaint,
    textAlign: 'center',
    marginTop: 14,
    fontFamily: monoFont,
  },

  minimalBg: { backgroundColor: colors.bgElevated },
  minimalTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    color: colors.textFaint,
  },
  minimalDistance: { fontSize: 58, lineHeight: 62 },
  minimalStats: {
    fontSize: 12,
    color: colors.textDim,
    marginTop: 2,
    fontVariant: ['tabular-nums'],
  },
  minimalFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  minimalMark: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.4,
    color: colors.accent,
    fontFamily: monoFont,
  },

  posterBg: { backgroundColor: colors.accent },
  posterInk: { color: colors.bg },
  posterInkFaint: { color: 'rgba(8,9,10,0.52)' },
  posterDot: { color: colors.bg },
  posterTitle: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    opacity: 0.62,
  },
  posterDistance: { fontSize: 72, lineHeight: 76, letterSpacing: -3.6 },
  posterStatsRow: { borderTopColor: 'rgba(8,9,10,0.22)' },
  posterDivider: { backgroundColor: 'rgba(8,9,10,0.22)' },
});
