import { StyleSheet, Text, View } from 'react-native';

import { formatDuration } from '@/lib/format';
import { useUnit } from '@/hooks/useUnit';
import { type Palette } from '@/lib/theme';
import { useThemedStyles } from '@/hooks/useTheme';
import type { Split } from '@/lib/types';

type Props = {
  splits: Split[];
};

export function SplitsList({ splits }: Props) {
  const u = useUnit();
  const styles = useThemedStyles(createStyles);

  if (splits.length === 0) {
    return <Text style={styles.empty}>Chưa đủ dữ liệu để chia {u.label}.</Text>;
  }

  const paces = splits.map((s) => s.paceSPerKm);
  const fastest = Math.min(...paces);
  const slowest = Math.max(...paces);
  const span = Math.max(1, slowest - fastest);

  return (
    <View>
      <View style={styles.headerRow}>
        <Text style={[styles.headerCell, styles.kmCell]}>{u.label.toUpperCase()}</Text>
        <Text style={[styles.headerCell, styles.barCell]}>NHỊP ĐỘ</Text>
        <Text style={[styles.headerCell, styles.timeCell]}>THỜI GIAN</Text>
        <Text style={[styles.headerCell, styles.paceCell]}>PACE</Text>
      </View>

      {splits.map((split) => {
        const ratio = (slowest - split.paceSPerKm) / span;
        const width = 18 + ratio * 82;
        const isFastest = split.paceSPerKm === fastest && splits.length > 1;

        return (
          <View key={split.km} style={styles.row}>
            <Text style={[styles.cell, styles.kmCell, isFastest && styles.fastest]}>{split.km}</Text>

            <View style={styles.barCell}>
              <View style={styles.track}>
                <View
                  style={[
                    styles.fill,
                    { width: `${width}%` },
                    isFastest && styles.fillFastest,
                  ]}
                />
              </View>
            </View>

            <Text style={[styles.cell, styles.timeCell]}>{formatDuration(split.durationS)}</Text>
            <Text style={[styles.cell, styles.paceCell, isFastest && styles.fastest]}>
              {u.pace(split.paceSPerKm)}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingBottom: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    gap: 10,
  },
  headerCell: {
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1.1,
    color: c.textFaint,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 11,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: c.border,
    gap: 10,
  },
  cell: {
    fontSize: 13,
    color: c.textDim,
    fontVariant: ['tabular-nums'],
  },
  kmCell: { width: 26, textAlign: 'left' },
  barCell: { flex: 1 },
  timeCell: { width: 52, textAlign: 'right' },
  paceCell: { width: 52, textAlign: 'right', fontWeight: '600', color: c.text },
  track: {
    height: 6,
    borderRadius: 3,
    backgroundColor: c.surfaceAlt,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: 3, backgroundColor: c.accentLine },
  fillFastest: { backgroundColor: c.accent },
  fastest: { color: c.accent },
  empty: { color: c.textFaint, fontSize: 13, paddingVertical: 12 },
});
