import { useState } from 'react';
import { View, type LayoutChangeEvent } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';

type Props = {
  /** Bar heights, oldest first. */
  values: number[];
  labels?: string[];
  height?: number;
  color?: string;
  /** Index drawn in full colour; the rest are dimmed. Defaults to the last one. */
  highlightIndex?: number;
  gap?: number;
};

export function BarChart({
  values,
  labels,
  height = 96,
  color,
  highlightIndex,
  gap = 6,
}: Props) {
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  const barColor = color ?? colors.accentFill;
  const count = Math.max(values.length, 1);
  const max = Math.max(...values, 1);
  const activeIndex = highlightIndex ?? values.length - 1;
  const barWidth = width > 0 ? Math.max(2, (width - gap * (count - 1)) / count) : 0;
  const labelHeight = labels ? 16 : 0;
  const chartHeight = Math.max(8, height - labelHeight);

  return (
    <View onLayout={onLayout} style={{ width: '100%', height }}>
      {width > 0 ? (
        <Svg width={width} height={height}>
          {values.map((value, index) => {
            const ratio = value > 0 ? Math.max(0.04, value / max) : 0.02;
            const h = Math.max(2, chartHeight * ratio);
            const x = index * (barWidth + gap);
            const isActive = index === activeIndex;
            return (
              <Rect
                key={index}
                x={x}
                y={chartHeight - h}
                width={barWidth}
                height={h}
                rx={Math.min(4, barWidth / 2)}
                fill={isActive ? barColor : colors.surfaceAlt}
                opacity={value > 0 ? 1 : 0.55}
              />
            );
          })}

          {labels?.map((label, index) => (
            <SvgText
              key={`${label}-${index}`}
              x={index * (barWidth + gap) + barWidth / 2}
              y={height - 2}
              fontSize={9}
              fill={index === activeIndex ? colors.textDim : colors.textFaint}
              textAnchor="middle"
            >
              {label}
            </SvgText>
          ))}
        </Svg>
      ) : null}
    </View>
  );
}
