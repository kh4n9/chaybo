import { useMemo } from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { projectRoute } from '@/lib/routePath';
import { colors } from '@/lib/theme';
import type { TrackPoint } from '@/lib/types';

type Props = {
  points: TrackPoint[];
  width: number;
  height: number;
  color?: string;
  strokeWidth?: number;
  showEndpoints?: boolean;
  glow?: boolean;
};

/** Compact SVG drawing of a GPS route — used in lists, charts and the share card. */
export function RouteShape({
  points,
  width,
  height,
  color = colors.accent,
  strokeWidth = 2,
  showEndpoints = false,
  glow = false,
}: Props) {
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
          stroke={color}
          strokeOpacity={0.22}
          strokeWidth={strokeWidth * 3}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      ) : null}
      <Path
        d={projected.d}
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      {showEndpoints && projected.start && projected.end ? (
        <>
          <Circle cx={projected.start.x} cy={projected.start.y} r={strokeWidth * 1.4} fill={colors.bg} stroke={color} strokeWidth={1.5} />
          <Circle cx={projected.end.x} cy={projected.end.y} r={strokeWidth * 1.6} fill={color} />
        </>
      ) : null}
    </Svg>
  );
}
