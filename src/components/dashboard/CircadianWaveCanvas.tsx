import { Canvas, Circle, Group, Path, Skia } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Text, View } from 'react-native';
import { Easing, useDerivedValue, useSharedValue, withRepeat, withTiming, type SharedValue } from 'react-native-reanimated';
import type { DoseEntry } from '../../dashboard/types';
import { useTheme } from '../../theme/useTheme';

const WAVE_HOURS = 24;
/** The band starts at 05:00 so the whole night's sleep sits at the wrapped edges rather than splitting across the middle of the curve. */
const WAVE_START_HOUR = 5;
const WAVE_CYCLES = 2;
const MARKER_RADIUS = 9;
const PULSE_MAX_RADIUS = 17;
const LABEL_WIDTH = 88;
const LABEL_GAP = 16;
const LABEL_ROW_HEIGHT = 30;

/**
 * Anchors each label below the marker, but close-together zones (this
 * schedule's Dawn Fasting/Post-Breakfast and Post-Dinner/Bedtime are only
 * 2.5h apart) get stacked from a *shared* baseline — the lowest marker in
 * the cluster — rather than each offset from its own y. Offsetting from its
 * own y independently doesn't work: a trial with a flat per-marker stagger
 * still collided here, because the wave's height difference between two
 * close markers can roughly cancel a fixed offset delta.
 */
function computeLabelTops(markers: { x: number; y: number }[]): number[] {
  const tops: number[] = [];
  let clusterStart = 0;
  for (let i = 0; i < markers.length; i += 1) {
    if (i > 0 && markers[i].x - markers[i - 1].x >= LABEL_WIDTH) {
      clusterStart = i;
    }
    const clusterMaxY = Math.max(...markers.slice(clusterStart, i + 1).map((marker) => marker.y));
    tops[i] = clusterMaxY + LABEL_GAP + (i - clusterStart) * LABEL_ROW_HEIGHT;
  }
  return tops;
}

interface CircadianWaveCanvasProps {
  doses: DoseEntry[];
  width: number;
  height?: number;
}

function hourToProgress(hour: number): number {
  const relative = ((hour - WAVE_START_HOUR) % WAVE_HOURS + WAVE_HOURS) % WAVE_HOURS;
  return relative / WAVE_HOURS;
}

function waveY(progress: number, centerY: number, amplitude: number): number {
  return centerY - amplitude * Math.sin(progress * WAVE_CYCLES * 2 * Math.PI);
}

/**
 * Pending/"imminent" markers pulse on a single shared clock instead of one
 * animation per marker — in practice at most one or two zones are imminent
 * at once, but this keeps the cost flat even if that weren't true.
 */
function usePulse(): SharedValue<number> {
  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.ease) }), -1, true);
  }, [pulse]);
  return pulse;
}

function Marker({ x, y, color, pulsing, pulse }: { x: number; y: number; color: string; pulsing: boolean; pulse: SharedValue<number> }) {
  const pulseRadius = useDerivedValue(() => MARKER_RADIUS + pulse.value * (PULSE_MAX_RADIUS - MARKER_RADIUS));
  const pulseOpacity = useDerivedValue(() => 0.45 * (1 - pulse.value));

  return (
    <Group>
      {pulsing ? <Circle cx={x} cy={y} r={pulseRadius} color={color} opacity={pulseOpacity} /> : null}
      <Circle cx={x} cy={y} r={MARKER_RADIUS} color={color} />
      <Circle cx={x} cy={y} r={MARKER_RADIUS} style="stroke" strokeWidth={2.5} color="#FFFFFF" opacity={0.85} />
    </Group>
  );
}

/**
 * Decorative 24-hour sine wave (not a literal biological measurement) with
 * the day's dose zones anchored to it, color-coded by state. Zone labels are
 * plain RN <Text>, not Skia text: Skia needs an explicit typeface loaded to
 * draw glyphs, and the default one doesn't carry Bengali glyphs — overlaying
 * native text sidesteps that entirely and also means the labels respect the
 * OS's font-scale accessibility setting.
 */
export function CircadianWaveCanvas({ doses, width, height = 220 }: CircadianWaveCanvasProps) {
  const theme = useTheme();
  const pulse = usePulse();
  const centerY = height / 2;
  const amplitude = height * 0.28;

  const wavePath = useMemo(() => {
    const samples = 140;
    let svg = '';
    for (let i = 0; i <= samples; i += 1) {
      const progress = i / samples;
      const x = progress * width;
      const y = waveY(progress, centerY, amplitude);
      svg += i === 0 ? `M ${x} ${y}` : ` L ${x} ${y}`;
    }
    return Skia.Path.MakeFromSVGString(svg) ?? Skia.Path.Make();
  }, [width, centerY, amplitude]);

  const markerPositions = useMemo(
    () =>
      doses.map((dose) => {
        const progress = hourToProgress(dose.hour);
        return { dose, x: progress * width, y: waveY(progress, centerY, amplitude) };
      }),
    [doses, width, centerY, amplitude],
  );

  const labelTops = useMemo(() => computeLabelTops(markerPositions), [markerPositions]);

  if (width <= 0) return null;

  return (
    <View style={{ width, height: height + 84 }}>
      <Canvas style={{ width, height }}>
        <Path path={wavePath} style="stroke" strokeWidth={3.5} strokeCap="round" strokeJoin="round" color={theme.action.base} opacity={0.85} />
        {markerPositions.map(({ dose, x, y }) => (
          <Marker key={dose.id} x={x} y={y} color={theme.status[dose.state].base} pulsing={dose.state === 'pending'} pulse={pulse} />
        ))}
      </Canvas>
      {markerPositions.map(({ dose, x }, index) => (
        <View
          key={dose.id}
          pointerEvents="none"
          style={{ position: 'absolute', left: x - LABEL_WIDTH / 2, top: labelTops[index], width: LABEL_WIDTH }}
        >
          {/* `width` on the Text itself, not just its absolute-positioned
              parent: a parent sized to content (rather than clipping)
              lets a Bengali label wider than the box silently overflow into
              a neighbor's space instead of truncating. */}
          <Text numberOfLines={1} className="text-caption text-center" style={{ width: LABEL_WIDTH, color: theme.colors.inkSecondary, fontWeight: '600', fontSize: 12 }}>
            {dose.labelBn}
          </Text>
          <Text numberOfLines={1} className="text-caption text-center" style={{ width: LABEL_WIDTH, color: theme.colors.inkMuted, fontSize: 10 }}>
            {dose.label}
          </Text>
        </View>
      ))}
    </View>
  );
}
