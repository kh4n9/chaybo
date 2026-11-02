import { useMemo, useState } from 'react';
import { StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Path, Polyline, Text as SvgText } from 'react-native-svg';

import { type Palette } from '@/lib/theme';
import { useThemedStyles, useTheme } from '@/hooks/useTheme';
import type { TrackPoint } from '@/lib/types';

type Props = {
  route: TrackPoint[];
  height?: number;
};

const PADDING = 8;

export function ElevationProfile({ route, height = 110 }: Props) {
  const styles = useThemedStyles(createStyles);
  const palette = useTheme().colors;
  const [width, setWidth] = useState(0);

  const samples = useMemo(() => {
    const withAlt = route.filter((point) => point.alt != null && Number.isFinite(point.alt));
    if (withAlt.length < 2) return [];
    // Downsample to keep the SVG cheap on long routes.
    const target = Math.min(120, withAlt.length);
    const step = Math.max(1, Math.floor(withAlt.length / target));
    const out: { alt: number }[] = [];
    for (let i = 0; i < withAlt.length; i += step) {
      out.push({ alt: withAlt[i].alt as number });
    }
    if (out[out.length - 1] !== withAlt[withAlt.length - 1]) {
      out.push({ alt: withAlt[withAlt.length - 1].alt as number });
    }
    return out;
  }, [route]);

  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);

  if (samples.length < 2) {
    return (
      <View style={[styles.empty, { height }]}>
        <Text style={styles.emptyText}>Không có dữ liệu độ cao.</Text>
      </View>
    );
  }

  const min = Math.min(...samples.map((sample) => sample.alt));
  const max = Math.max(...samples.map((sample) => sample.alt));
  const span = Math.max(1, max - min);

  const chartWidth = Math.max(1, width - PADDING * 2);
  const chartHeight = Math.max(1, height - PADDING * 2);
  const points = samples.map((sample, index) => {
    const x = PADDING + (index / (samples.length - 1)) * chartWidth;
    const ratio = (sample.alt - min) / span;
    const y = PADDING + (1 - ratio) * chartHeight;
    return { x, y };
  });

  const line = points.map((point) => `${point.x},${point.y}`).join(' ');
  const area = `M ${points[0].x} ${PADDING + chartHeight} L ${points
    .map((point) => `${point.x} ${point.y}`)
    .join(' L ')} L ${points[points.length - 1].x} ${PADDING + chartHeight} Z`;

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          <Path d={area} fill={palette.accentSoft} />
          <Polyline points={line} fill="none" stroke={palette.accent} strokeWidth={1.6} />
          <SvgText x={PADDING} y={PADDING + 8} fontSize={9} fill={palette.textFaint}>
            {Math.round(max)} m
          </SvgText>
          <SvgText x={PADDING} y={height - 4} fontSize={9} fill={palette.textFaint}>
            {Math.round(min)} m
          </SvgText>
        </Svg>
      ) : null}
    </View>
  );
}

const createStyles = (c: Palette) =>
  StyleSheet.create({
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: c.surface,
    borderRadius: 12,
  },
  emptyText: { fontSize: 11, color: c.textFaint },
});