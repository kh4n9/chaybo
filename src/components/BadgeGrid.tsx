import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';

import type { Badge } from '@/lib/badges';
import { radius, type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';

type Props = {
  badges: Badge[];
};

const ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  first_run: 'flag-outline',
  runs_10: 'repeat-outline',
  runs_50: 'fitness-outline',
  runs_100: 'trophy-outline',
  dist_50: 'walk-outline',
  dist_100: 'speedometer-outline',
  dist_500: 'map-outline',
  dist_1000: 'earth-outline',
  long_5: 'trail-sign-outline',
  long_10: 'navigate-outline',
  long_half: 'medal-outline',
  streak_3: 'flame-outline',
  streak_7: 'flame-outline',
  streak_30: 'flame-outline',
  climb_1000: 'trending-up-outline',
  climb_5000: 'triangle-outline',
  early_bird: 'sunny-outline',
  night_owl: 'moon-outline',
  goal_week: 'checkmark-done-outline',
  month_100: 'calendar-outline',
};

function formatNumber(value: number): string {
  if (value >= 100) {
    return Math.round(value)
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }
  if (Number.isInteger(value)) return String(value);
  return value.toFixed(1).replace('.', ',');
}

/** Two-column achievement grid; locked badges show their progress. */
export function BadgeGrid({ badges }: Props) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  return (
    <View style={styles.grid}>
      {badges.map((badge) => {
        const icon = ICONS[badge.id] ?? 'ribbon-outline';
        const ratio = Math.min(1, badge.target > 0 ? badge.current / badge.target : 0);

        return (
          <View
            key={badge.id}
            style={[styles.card, badge.earned && styles.cardEarned]}
            accessibilityLabel={`${badge.title}. ${badge.earned ? 'Đã đạt' : `${formatNumber(badge.current)} trên ${formatNumber(badge.target)} ${badge.unit}`}`}
          >
            <View style={styles.head}>
              <View style={[styles.iconWrap, badge.earned && styles.iconWrapEarned]}>
                <Ionicons
                  name={badge.earned ? icon : 'lock-closed-outline'}
                  size={16}
                  color={badge.earned ? palette.accent : palette.textFaint}
                />
              </View>
              {badge.earned ? (
                <Ionicons name="checkmark-circle" size={15} color={palette.accent} />
              ) : null}
            </View>

            <Text style={[styles.title, !badge.earned && styles.titleLocked]} numberOfLines={1}>
              {badge.title}
            </Text>
            <Text style={styles.description} numberOfLines={2}>
              {badge.description}
            </Text>

            {badge.earned ? (
              <Text style={styles.earned}>Đã đạt</Text>
            ) : (
              <View style={styles.progressWrap}>
                <View style={styles.progressTrack}>
                  <View style={[styles.progressFill, { width: `${ratio * 100}%` }]} />
                </View>
                <Text style={styles.progressText}>
                  {formatNumber(badge.current)}/{formatNumber(badge.target)} {badge.unit}
                </Text>
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: {
    width: '47.5%',
    flexGrow: 1,
    minHeight: 132,
    backgroundColor: c.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    padding: 12,
  },
  cardEarned: { borderColor: c.accentLine, backgroundColor: c.accentSoft },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surfaceAlt,
  },
  iconWrapEarned: { backgroundColor: c.accentSoft },
  title: {
    marginTop: 9,
    fontSize: 13,
    fontWeight: '700',
    color: c.text,
    letterSpacing: -0.2,
  },
  titleLocked: { color: c.textDim },
  description: { marginTop: 3, fontSize: 10, lineHeight: 14, color: c.textFaint },
  earned: {
    marginTop: 8,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: c.accent,
  },
  progressWrap: { marginTop: 8, gap: 5 },
  progressTrack: {
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: c.surfaceAlt,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', borderRadius: radius.pill, backgroundColor: c.textFaint },
  progressText: {
    fontSize: 9,
    color: c.textFaint,
    fontVariant: ['tabular-nums'],
  },
});
