import { useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';

import type { DayCell } from '@/lib/calendar';

import { withAlpha, type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';
import { useUnit } from '@/hooks/useUnit';

type Props = {
  /** Columns of 7 days, Monday first, oldest first. */
  weeks: DayCell[][];
};

const WEEKDAY_LABELS = ['T2', '', 'T4', '', 'T6', '', 'CN'];
const GAP = 3;
const LABEL_WIDTH = 18;

/** GitHub-style training calendar: one column per week, one cell per day. */
export function TrainingHeatmap({ weeks }: Props) {
  const u = useUnit();
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const max = weeks.reduce(
    (acc, column) => Math.max(acc, ...column.map((day) => day.distanceM)),
    0,
  );

  const available = Math.max(0, width - LABEL_WIDTH - GAP * weeks.length);
  const cell = width > 0 ? Math.max(7, Math.min(16, Math.floor(available / Math.max(1, weeks.length)))) : 12;

  return (
    <View onLayout={onLayout} style={styles.root}>
      <View style={styles.monthRow}>
        {weeks.map((column, index) => {
          const first = new Date(column[0].dayStart);
          const show = index === 0 || first.getDate() <= 7;
          return (
            <View key={column[0].dayStart} style={{ width: cell, marginRight: GAP }}>
              <Text style={styles.monthLabel}>{show ? first.getMonth() + 1 : ''}</Text>
            </View>
          );
        })}
      </View>

      {WEEKDAY_LABELS.map((label, row) => (
        <View key={label || `row-${row}`} style={styles.row}>
          <Text style={styles.weekday}>{label}</Text>
          {weeks.map((column) => {
            const day = column[row];
            const ratio = max > 0 ? day.distanceM / max : 0;
            const alpha = day.distanceM > 0 ? 0.16 + ratio * 0.84 : 0;
            const background = day.future
              ? 'transparent'
              : day.distanceM > 0
                ? withAlpha(palette.accentFill, alpha)
                : palette.surfaceAlt;

            return (
              <View
                key={day.dayStart}
                accessibilityLabel={
                  day.future
                    ? 'Ngày chưa tới'
                    : day.count > 0
                      ? `${u.dist(day.distanceM)} ${u.label}, ${day.count} buổi`
                      : 'Không chạy'
                }
                style={[
                  styles.cell,
                  {
                    width: cell,
                    height: cell,
                    marginRight: GAP,
                    backgroundColor: background,
                    borderWidth: day.future ? StyleSheet.hairlineWidth : 0,
                    borderColor: palette.border,
                  },
                ]}
              />
            );
          })}
        </View>
      ))}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  root: { gap: 3 },
  monthRow: { flexDirection: 'row', paddingLeft: LABEL_WIDTH + GAP, height: 12 },
  monthLabel: {
    fontSize: 8,
    fontWeight: '600',
    color: c.textFaint,
    fontVariant: ['tabular-nums'],
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  weekday: {
    width: LABEL_WIDTH,
    fontSize: 8,
    fontWeight: '600',
    color: c.textFaint,
  },
  cell: { borderRadius: 3 },
});
