import { Canvas, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export interface SparklinePoint {
  timestamp: string;
  value: number;
}

interface SparklineProps {
  points: SparklinePoint[];
  width: number;
  height?: number;
  color?: string;
  unit?: string;
}

/**
 * A minimal trend line, not a full chart — no axes/gridlines/tooltips, just
 * "is this going up or down" at a glance, which is what a sparkline is for.
 * Built from an SVG path string via `Skia.Path.MakeFromSVGString` rather
 * than the old mutable `path.moveTo()/.lineTo()` builder API — this Skia
 * version's `SkPath` is immutable/query-only (see CircadianWaveCanvas for
 * the same lesson learned there).
 */
export function Sparkline({ points, width, height = 100, color, unit = '' }: SparklineProps) {
  const theme = useTheme();
  const lineColor = color ?? theme.action.base;

  const { linePath, fillPath, minValue, maxValue } = useMemo(() => {
    if (points.length === 0) {
      return { linePath: null, fillPath: null, minValue: 0, maxValue: 0 };
    }
    const values = points.map((point) => point.value);
    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const padding = 10;
    const usableHeight = height - padding * 2;

    const coords = points.map((point, index) => ({
      x: points.length === 1 ? width / 2 : (index / (points.length - 1)) * width,
      y: padding + usableHeight - ((point.value - min) / range) * usableHeight,
    }));

    let lineSvg = '';
    coords.forEach((coord, index) => {
      lineSvg += index === 0 ? `M ${coord.x} ${coord.y}` : ` L ${coord.x} ${coord.y}`;
    });
    const fillSvg = `${lineSvg} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

    return {
      linePath: Skia.Path.MakeFromSVGString(lineSvg),
      fillPath: Skia.Path.MakeFromSVGString(fillSvg),
      minValue: min,
      maxValue: max,
    };
  }, [points, width, height]);

  if (points.length === 0 || !linePath || !fillPath) {
    return (
      <View style={{ width, height }} className="items-center justify-center">
        <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
          No readings yet
        </Text>
      </View>
    );
  }

  return (
    <View style={{ width }}>
      <Canvas style={{ width, height }}>
        <Path path={fillPath} color={lineColor} opacity={0.12} />
        <Path path={linePath} style="stroke" strokeWidth={3} strokeCap="round" strokeJoin="round" color={lineColor} />
      </Canvas>
      <View className="mt-1 flex-row justify-between">
        <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
          {minValue.toFixed(1)} {unit}
        </Text>
        <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
          {maxValue.toFixed(1)} {unit}
        </Text>
      </View>
    </View>
  );
}
