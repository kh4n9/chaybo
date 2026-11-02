import { useMemo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { useTheme } from '@/hooks/useTheme';
import { projectRoute } from '@/lib/routePath';
import type { TrackPoint } from '@/lib/types';

type Props = {
  points: TrackPoint[];
  width: number;
  height: number;
  color?: string;
  /** Fill behind the start marker. Defaults to the screen background. */
  endpointFill?: string;
  strokeWidth?: number;
  showEndpoints?: boolean;
  glow?: boolean;
};

/** Compact SVG drawing of a GPS route — used in lists, charts and the share card. */
export function RouteShape({
  points,
  width,
  height,
  color,
  endpointFill,
  strokeWidth = 2,
  showEndpoints = false,
  glow = false,
}: Props) {
  const { colors } = useTheme();
  const stroke = color ?? colors.accent;
  const fill = endpointFill ?? colors.bg;

  const projected = useMemo(
    () => projectRoute(points, width, height, strokeWidth + 2),
    [points, width, height, strokeWidth],
  );

  if (!projected.d) return null;

  return (
    <Svg width={width} height={height}>
      {glow && !projected.degenerate ? (
        <Path
          d={projected.d}
          stroke={stroke}
          strokeOpacity={0.22}
          strokeWidth={strokeWidth * 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : null}
      <Path
        d={projected.d}
        stroke={stroke}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {showEndpoints && projected.start && projected.end ? (
        <>
          <Circle
            cx={projected.start.x}
            cy={projected.start.y}
            r={strokeWidth * 1.4}
            fill={fill}
            stroke={stroke}
            strokeWidth={1.5}
          />
          <Circle cx={projected.end.x} cy={projected.end.y} r={strokeWidth * 1.6} fill={stroke} />
        </>
      ) : null}
    </Svg>
  );
}
