import { Canvas, Circle, Line, Path, Skia } from '@shopify/react-native-skia';
import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { useTranslation } from '../../i18n';
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

const AXIS_LABEL_WIDTH = 34;
const TOP_PADDING = 28; // room for the latest-value callout above the line
const BOTTOM_PADDING = 8;
const DATE_ROW_HEIGHT = 16;
const MAX_DATE_LABELS = 6;

/** Rounds a (min, max) data range outward to "nice" axis tick values (0/50/100 style), not the raw data bounds. */
function niceTicks(min: number, max: number, targetCount: number): number[] {
  if (min === max) return [min];
  const rawStep = (max - min) / targetCount;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const step = (residual > 5 ? 10 : residual > 2 ? 5 : residual > 1 ? 2 : 1) * magnitude;
  const niceMin = Math.floor(min / step) * step;
  const niceMax = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let value = niceMin; value <= niceMax + step * 0.001; value += step) {
    ticks.push(Math.round(value * 100) / 100);
  }
  return ticks;
}

/**
 * A small trend chart: line + fill, Y-axis gridlines with value labels, a
 * dot per reading, X-axis date labels (thinned out past ~6 points so a
 * 30-day range doesn't collide), and a callout bubble on the latest value —
 * enough to read trend *and* specific values at a glance, short of a full
 * pan/zoom charting library this app has no other use for.
 */
export function Sparkline({ points, width, height = 110, color, unit = '' }: SparklineProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const lineColor = color ?? theme.action.base;
  const chartWidth = Math.max(0, width - AXIS_LABEL_WIDTH);

  const chart = useMemo(() => {
    if (points.length === 0) return null;
    const values = points.map((point) => point.value);
    const dataMin = Math.min(...values);
    const dataMax = Math.max(...values);
    // Flat/no-variance data (e.g. every reading identical): nice-ticking a
    // zero-width range collapses to a single tick and pins the line to the
    // bottom of the chart. Pad it into a tiny synthetic range instead, so a
    // flat line still reads as "flat, centered" rather than "empty, at zero".
    const ticks = dataMin === dataMax ? niceTicks(dataMin - 1, dataMax + 1, 4) : niceTicks(dataMin, dataMax, 4);
    const min = ticks[0];
    const max = ticks[ticks.length - 1];
    const range = max - min || 1;
    const usableHeight = height - TOP_PADDING - BOTTOM_PADDING;
    const yForValue = (value: number) => TOP_PADDING + usableHeight - ((value - min) / range) * usableHeight;

    const coords = points.map((point, index) => ({
      x: points.length === 1 ? chartWidth / 2 : (index / (points.length - 1)) * chartWidth,
      y: yForValue(point.value),
      value: point.value,
      timestamp: point.timestamp,
    }));

    let lineSvg = '';
    coords.forEach((coord, index) => {
      lineSvg += index === 0 ? `M ${coord.x} ${coord.y}` : ` L ${coord.x} ${coord.y}`;
    });
    const fillSvg = `${lineSvg} L ${coords[coords.length - 1].x} ${height} L ${coords[0].x} ${height} Z`;

    return {
      linePath: Skia.Path.MakeFromSVGString(lineSvg),
      fillPath: Skia.Path.MakeFromSVGString(fillSvg),
      coords,
      ticks,
      yForValue,
    };
  }, [points, chartWidth, height]);

  if (points.length === 0 || !chart || !chart.linePath || !chart.fillPath) {
    return (
      <View style={{ width, height }} className="items-center justify-center">
        <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
          {t('vitals.noReadingsYet')}
        </Text>
      </View>
    );
  }

  const { linePath, fillPath, coords, ticks, yForValue } = chart;
  const lastPoint = coords[coords.length - 1];
  const labelStep = Math.max(1, Math.ceil(coords.length / MAX_DATE_LABELS));
  const calloutLeft = Math.min(Math.max(0, lastPoint.x - 34), Math.max(0, chartWidth - 68));

  return (
    <View style={{ width }}>
      <View className="flex-row">
        <View style={{ width: AXIS_LABEL_WIDTH, height }}>
          {ticks.map((tick) => (
            <Text
              key={tick}
              numberOfLines={1}
              style={{
                position: 'absolute',
                top: yForValue(tick) - 7,
                right: 6,
                fontSize: 10,
                color: theme.colors.inkMuted,
              }}
            >
              {tick}
            </Text>
          ))}
        </View>
        <View>
          <Canvas style={{ width: chartWidth, height }}>
            {ticks.map((tick) => (
              <Line
                key={tick}
                p1={{ x: 0, y: yForValue(tick) }}
                p2={{ x: chartWidth, y: yForValue(tick) }}
                color={theme.colors.hairline}
                strokeWidth={1}
              />
            ))}
            <Path path={fillPath} color={lineColor} opacity={0.12} />
            <Path path={linePath} style="stroke" strokeWidth={3} strokeCap="round" strokeJoin="round" color={lineColor} />
            {coords.map((coord, index) => (
              <Circle key={`dot-fill-${index}`} cx={coord.x} cy={coord.y} r={4} color={theme.colors.elevated} />
            ))}
            {coords.map((coord, index) => (
              <Circle key={`dot-ring-${index}`} cx={coord.x} cy={coord.y} r={4} style="stroke" strokeWidth={2} color={lineColor} />
            ))}
          </Canvas>

          {/* Latest-value callout, anchored above the most recent point */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              top: Math.max(0, lastPoint.y - TOP_PADDING),
              left: calloutLeft,
              paddingHorizontal: 8,
              paddingVertical: 3,
              borderRadius: 10,
              backgroundColor: theme.colors.elevated,
              borderWidth: 1,
              borderColor: theme.colors.hairline,
            }}
          >
            <Text numberOfLines={1} style={{ fontSize: 11, fontWeight: '700', color: theme.colors.ink }}>
              {lastPoint.value.toFixed(1)} {unit}
            </Text>
          </View>

          <View style={{ height: DATE_ROW_HEIGHT, marginTop: 2 }}>
            {coords.map((coord, index) =>
              index % labelStep === 0 || index === coords.length - 1 ? (
                <Text
                  key={index}
                  numberOfLines={1}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: Math.min(Math.max(0, coord.x - 20), Math.max(0, chartWidth - 40)),
                    width: 40,
                    textAlign: 'center',
                    fontSize: 9,
                    color: theme.colors.inkMuted,
                  }}
                >
                  {new Date(coord.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                </Text>
              ) : null,
            )}
          </View>
        </View>
      </View>
    </View>
  );
}
