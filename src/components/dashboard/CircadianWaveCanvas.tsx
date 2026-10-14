import { Canvas, Circle, Group, LinearGradient, Path, Skia } from '@shopify/react-native-skia';
import { Clock, Moon, Sun, Sunrise, Sunset, type LucideIcon } from 'lucide-react-native';
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
const LABEL_WIDTH = 104;
const LABEL_GAP = 14;
const LABEL_MIN_SPACING = 8;
const ICON_SIZE = 17;
const CONNECTOR_WIDTH = 1.5;
/** Clearance kept on each end so the connector touches neither the dot's white ring nor the icon above the label. */
const CONNECTOR_INSET = 5;

/**
 * Same icon-per-zone mapping already established in AlarmScheduleCard/
 * AlarmsScreen (sunrise → sun → sunset → moon, fasting gets a clock) — reused
 * here rather than invented, so a zone reads the same whether it's in the
 * alarms list or on this wave. Keyed by the English label because `DoseEntry`
 * only carries the resolved label strings, not the raw `TimeNode` enum.
 */
const ZONE_ICON: Record<string, LucideIcon> = {
  'Dawn Fasting': Clock,
  'Post-Breakfast': Sunrise,
  'Post-Lunch': Sun,
  'Post-Dinner': Sunset,
  'Bedtime Recovery': Moon,
};

const STATE_URGENCY: Record<DoseEntry['state'], number> = { missed: 0, pending: 1, scheduled: 2, taken: 3 };

/**
 * How far apart (in hours) two doses in the *same* zone can be before they
 * count as separate times rather than one merged marker. Fixed-width
 * rounding buckets (e.g. "round to the nearest 20 minutes") don't work here:
 * doses staggered exactly on that grid — 8:00, 8:20, 8:40 — each round to
 * themselves and land in three different buckets instead of merging, which
 * is exactly the staircase manually-added reminders produce (each medicine
 * keeps its own picked time, not a shared zone time). Chaining by gap
 * instead (sort by hour, start a new group whenever the step to the next
 * dose exceeds this threshold) merges any run of doses that are each close
 * to a neighbor, while still splitting a genuinely early vs. late dose in
 * the same zone (an early vs. a late Bedtime, say) that are hours apart.
 */
const GROUP_GAP_HOURS = 2 / 3;

function groupDoses(doses: DoseEntry[], width: number, centerY: number, amplitude: number) {
  const byLabel = new Map<string, DoseEntry[]>();
  for (const dose of doses) {
    const bucket = byLabel.get(dose.label);
    if (bucket) bucket.push(dose);
    else byLabel.set(dose.label, [dose]);
  }

  const groups: DoseEntry[][] = [];
  for (const sameLabel of byLabel.values()) {
    const sorted = [...sameLabel].sort((a, b) => a.hour - b.hour);
    let current: DoseEntry[] = [];
    for (const dose of sorted) {
      const previous = current[current.length - 1];
      if (previous && dose.hour - previous.hour > GROUP_GAP_HOURS) {
        groups.push(current);
        current = [];
      }
      current.push(dose);
    }
    if (current.length > 0) groups.push(current);
  }

  return groups.map((group) => {
    const representative = [...group].sort((a, b) => STATE_URGENCY[a.state] - STATE_URGENCY[b.state])[0];
    const avgHour = group.reduce((sum, d) => sum + d.hour, 0) / group.length;
    const progress = hourToProgress(avgHour);
    return {
      key: group.map((d) => d.id).join('+'),
      x: progress * width,
      y: waveY(progress, centerY, amplitude),
      label: representative.label,
      labelBn: representative.labelBn,
      state: representative.state,
      time: formatHour(representative.hour),
      count: group.length,
    };
  });
}

/**
 * One tidy row along the bottom, like the reference design — not stacked at
 * each marker's own wave height. Labels tied to wave height read as scattered
 * and uneven (a trough marker's label sits far below a peak marker's), so
 * every label shares the same fixed row instead; only its *x* follows the
 * marker above it. Left-to-right, each label is nudged just far enough right
 * of its neighbor to not overlap — markers must already be sorted by x.
 */
function computeLabelLefts(xs: number[], width: number): number[] {
  const lefts: number[] = [];
  let prevRight = -Infinity;
  for (const x of xs) {
    const left = Math.max(x - LABEL_WIDTH / 2, prevRight + LABEL_MIN_SPACING);
    lefts.push(left);
    prevRight = left + LABEL_WIDTH;
  }
  return lefts.map((left) => Math.min(Math.max(left, 4), width - LABEL_WIDTH - 4));
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

function formatHour(hour: number): string {
  const totalMinutes = Math.round(hour * 60 + 24 * 60) % (24 * 60);
  const hour24 = Math.floor(totalMinutes / 60);
  const minute = totalMinutes % 60;
  const period = hour24 >= 12 ? 'PM' : 'AM';
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, '0')} ${period}`;
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

  // Same curve, closed down to the canvas floor, filled with a top-to-bottom
  // fade — a plain stroke read as a line chart; the fade under it is what
  // makes it read as a wave/tide instead.
  const fillPath = useMemo(() => {
    const samples = 140;
    let svg = `M 0 ${height}`;
    for (let i = 0; i <= samples; i += 1) {
      const progress = i / samples;
      const x = progress * width;
      const y = waveY(progress, centerY, amplitude);
      svg += ` L ${x} ${y}`;
    }
    svg += ` L ${width} ${height} Z`;
    return Skia.Path.MakeFromSVGString(svg) ?? Skia.Path.Make();
  }, [width, height, centerY, amplitude]);

  const groupedMarkers = useMemo(
    () => groupDoses(doses, width, centerY, amplitude).sort((a, b) => a.x - b.x),
    [doses, width, centerY, amplitude],
  );

  const labelLefts = useMemo(() => computeLabelLefts(groupedMarkers.map((marker) => marker.x), width), [groupedMarkers, width]);
  const labelTop = height + LABEL_GAP;

  if (width <= 0) return null;

  return (
    <View style={{ width, height: labelTop + 70 }}>
      <Canvas style={{ width, height }}>
        <Path path={fillPath}>
          <LinearGradient start={{ x: 0, y: 0 }} end={{ x: 0, y: height }} colors={[`${theme.action.base}40`, `${theme.action.base}00`]} />
        </Path>
        <Path path={wavePath} style="stroke" strokeWidth={3.5} strokeCap="round" strokeJoin="round" color={theme.action.base} opacity={0.85} />
        {groupedMarkers.map((marker) => (
          <Marker key={marker.key} x={marker.x} y={marker.y} color={theme.status[marker.state].base} pulsing={marker.count === 1 && marker.state === 'pending'} pulse={pulse} />
        ))}
      </Canvas>
      {/* A pointer line from each dot down to its label: the label row sits
          at one fixed height (see computeLabelLefts above) while the dots
          themselves sit at very different heights on the wave, so without
          this a peak marker's label reads as floating, disconnected from
          the dot it belongs to. */}
      {groupedMarkers.map((marker) => (
        <View
          key={`pointer-${marker.key}`}
          pointerEvents="none"
          style={{
            position: 'absolute',
            left: marker.x - CONNECTOR_WIDTH / 2,
            top: marker.y + MARKER_RADIUS + CONNECTOR_INSET,
            width: CONNECTOR_WIDTH,
            height: Math.max(0, labelTop - CONNECTOR_INSET - (marker.y + MARKER_RADIUS + CONNECTOR_INSET)),
            backgroundColor: theme.colors.inkMuted,
            opacity: 0.4,
          }}
        />
      ))}
      {groupedMarkers.map((marker, index) => {
        const Icon = ZONE_ICON[marker.label] ?? Sun;
        return (
          <View
            key={marker.key}
            pointerEvents="none"
            style={{ position: 'absolute', left: labelLefts[index], top: labelTop, width: LABEL_WIDTH, alignItems: 'center' }}
          >
            <Icon color={theme.colors.inkMuted} size={ICON_SIZE} strokeWidth={2} />
            {/* `width` on the Text itself, not just its absolute-positioned
                parent: a parent sized to content (rather than clipping)
                lets a Bengali label wider than the box silently overflow into
                a neighbor's space instead of truncating. */}
            <Text numberOfLines={1} className="text-caption text-center" style={{ width: LABEL_WIDTH, marginTop: 4, color: theme.colors.inkMuted, fontSize: 11 }}>
              {marker.labelBn}
            </Text>
            <Text numberOfLines={1} className="text-caption text-center" style={{ width: LABEL_WIDTH, marginTop: 1, color: theme.colors.ink, fontWeight: '700', fontSize: 13 }}>
              {marker.time}
              {marker.count > 1 ? ` +${marker.count - 1}` : ''}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
