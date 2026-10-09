import { Canvas, Circle, Group, Path, Skia, type SkPath } from '@shopify/react-native-skia';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Easing, runOnJS, useAnimatedReaction, useDerivedValue, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { triggerHapticCascade } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

interface LiquidProgressRingProps {
  /** 0–1 daily adherence ratio. */
  ratio: number;
  size?: number;
  label?: string;
}

function makeWavePath(width: number, height: number, amplitude: number, wavelength: number): SkPath {
  let svg = `M ${-wavelength} ${amplitude}`;
  for (let x = -wavelength; x <= width + wavelength; x += wavelength / 24) {
    svg += ` L ${x} ${amplitude * Math.sin((x / wavelength) * 2 * Math.PI)}`;
  }
  svg += ` L ${width + wavelength} ${height} L ${-wavelength} ${height} Z`;
  return Skia.Path.MakeFromSVGString(svg) ?? Skia.Path.Make();
}

/**
 * Circular adherence gauge with a continuously-scrolling wavy fill line
 * (two layered waves at different speeds/opacities for a sense of depth),
 * clipped to a circle whose fill level tracks `ratio`. Fires a haptic
 * cascade exactly once per session the moment adherence reaches 100% —
 * guarded by a ref rather than re-firing every time `ratio` happens to
 * still be 1 on a later render (e.g. a parent re-render for an unrelated
 * reason shouldn't re-trigger the celebration).
 */
export function LiquidProgressRing({ ratio, size = 180, label }: LiquidProgressRingProps) {
  const theme = useTheme();
  const radius = size / 2;
  const amplitude = size * 0.045;
  const wavelength = size * 0.9;

  const fillLevel = useSharedValue(0);
  const phaseA = useSharedValue(0);
  const phaseB = useSharedValue(0);
  const hasCelebrated = useRef(false);

  useEffect(() => {
    fillLevel.value = withTiming(ratio, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [ratio, fillLevel]);

  useEffect(() => {
    phaseA.value = withRepeat(withTiming(wavelength, { duration: 2600, easing: Easing.linear }), -1, false);
    phaseB.value = withRepeat(withTiming(-wavelength, { duration: 3400, easing: Easing.linear }), -1, false);
  }, [phaseA, phaseB, wavelength]);

  useEffect(() => {
    if (ratio >= 1 && !hasCelebrated.current) {
      hasCelebrated.current = true;
      triggerHapticCascade();
    } else if (ratio < 1) {
      hasCelebrated.current = false;
    }
  }, [ratio]);

  const wavePath = useMemo(() => makeWavePath(size, size * 1.2, amplitude, wavelength), [size, amplitude, wavelength]);
  const clipPath = useMemo(() => Skia.Path.Circle(radius, radius, radius), [radius]);

  const liquidTransform = useDerivedValue(() => [{ translateY: (1 - fillLevel.value) * size }]);
  const waveATransform = useDerivedValue(() => [{ translateX: phaseA.value }]);
  const waveBTransform = useDerivedValue(() => [{ translateX: phaseB.value }]);

  // Counts up/down in lockstep with the liquid fill (both driven by the same
  // `fillLevel` tween) instead of the percentage digits jumping straight to
  // their final value while only the visual fill animates underneath them.
  const [displayPercent, setDisplayPercent] = useState(() => Math.round(ratio * 100));
  useAnimatedReaction(
    () => Math.round(fillLevel.value * 100),
    (current, previous) => {
      if (current !== previous) runOnJS(setDisplayPercent)(current);
    },
  );

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Canvas style={{ width: size, height: size }}>
        <Circle cx={radius} cy={radius} r={radius} color={theme.colors.elevated} />
        <Group clip={clipPath}>
          <Group transform={liquidTransform}>
            <Group transform={waveBTransform}>
              <Path path={wavePath} color={theme.action.base} opacity={0.35} />
            </Group>
            <Group transform={waveATransform}>
              <Path path={wavePath} color={theme.action.base} opacity={0.85} />
            </Group>
          </Group>
        </Group>
        <Circle cx={radius} cy={radius} r={radius - 2} style="stroke" strokeWidth={3} color={theme.colors.hairline} />
      </Canvas>
      <View pointerEvents="none" style={{ position: 'absolute', alignItems: 'center' }}>
        <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
          {displayPercent}%
        </Text>
        {label ? (
          <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}
