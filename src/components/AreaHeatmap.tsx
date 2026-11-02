import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';

import { buildAreaHeatmap } from '@/lib/heatmap';
import { radius, type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';
import type { ActivitySummary } from '@/lib/types';

type Props = {
  activities: ActivitySummary[];
  height?: number;
};

const PADDING = 10;

/**
 * “Khu vực hay chạy”: every stored route projected into one box, with a density
 * grid painted behind the lines. Purely local — no map tiles or network.
 */
export function AreaHeatmap({ activities, height = 220 }: Props) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const [width, setWidth] = useState(0);

  const onLayout = (event: LayoutChangeEvent) => {
    setWidth(event.nativeEvent.layout.width);
  };

  const heat = useMemo(() => buildAreaHeatmap(activities, 28, 28), [activities]);

  const cells = useMemo(() => {
    if (width <= 0) return [];
    const innerW = width - PADDING * 2;
    const innerH = height - PADDING * 2;
    const cellW = innerW / heat.cols;
    const cellH = innerH / heat.rows;
    const out: { x: number; y: number; w: number; h: number; alpha: number; key: string }[] = [];

    for (let row = 0; row < heat.rows; row++) {
      for (let col = 0; col < heat.cols; col++) {
        const value = heat.grid[row * heat.cols + col];
        if (value <= 0 || heat.max <= 0) continue;
        const ratio = value / heat.max;
        out.push({
          key: `${row}-${col}`,
          x: PADDING + col * cellW,
          y: PADDING + row * cellH,
          w: cellW + 0.5,
          h: cellH + 0.5,
          alpha: 0.1 + ratio * 0.55,
        });
      }
    }
    return out;
  }, [heat, width, height]);

  const lines = useMemo(() => {
    if (width <= 0) return [];
    const innerW = width - PADDING * 2;
    const innerH = height - PADDING * 2;
    return heat.lines.map((line) => ({
      id: line.id,
      d: line.points
        .map((point, index) => {
          const x = PADDING + point.x * innerW;
          const y = PADDING + point.y * innerH;
          return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`;
        })
        .join(' '),
    }));
  }, [heat, width, height]);

  return (
    <View onLayout={onLayout} style={[styles.root, { height }]}>
      {width > 0 && heat.count > 0 ? (
        <Svg width={width} height={height}>
          {cells.map((cell) => (
            <Rect
              key={cell.key}
              x={cell.x}
              y={cell.y}
              width={cell.w}
              height={cell.h}
              fill={palette.accent}
              fillOpacity={cell.alpha}
              rx={2}
            />
          ))}
          {lines.map((line) => (
            <Path
              key={line.id}
              d={line.d}
              stroke={palette.accent}
              strokeOpacity={0.4}
              strokeWidth={1.2}
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </Svg>
      ) : null}
      {heat.count === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyText}>Chưa có đủ dữ liệu GPS để vẽ bản đồ nhiệt.</Text>
        </View>
      ) : null}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  root: {
    width: '100%',
    backgroundColor: c.surfaceAlt,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: c.border,
    overflow: 'hidden',
  },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 },
  emptyText: { fontSize: 12, color: c.textFaint, textAlign: 'center' },
});
