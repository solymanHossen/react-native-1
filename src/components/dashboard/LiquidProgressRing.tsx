import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Easing, runOnJS, useAnimatedReaction, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { triggerHapticCascade } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

export interface LiquidProgressRingProps {
  /** 0–1 daily adherence ratio. */
  ratio: number;
  size?: number;
  strokeWidth?: number;
  label?: string;
  testID?: string;
}

/**
 * Clean circular progress ring with rounded caps, smooth gradient fill,
 * and bold centered percentage matching the reference design.
 *
 * Adherence thresholds match existing project color tokens:
 *  - >= 0.75: Emerald gradient (#34D399 -> #10B981)
 *  - >= 0.40: Brand blue gradient (#3B82F6 -> #1D4ED8) — matches the 60% in reference
 *  - <  0.40: Coral red gradient (#F87171 -> #EF4444)
 */
export function LiquidProgressRing({
  ratio,
  size = 118,
  strokeWidth: customStrokeWidth,
  label,
  testID,
}: LiquidProgressRingProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';

  // Enforce clamped 0..1 ratio
  const safeRatio = Math.max(0, Math.min(1, isNaN(ratio) ? 0 : ratio));

  // Determine gradient colors based on adherence:
  const [gradientStart, gradientEnd] =
    safeRatio >= 0.75
      ? ['#34D399', '#10B981'] // emerald green
      : safeRatio >= 0.4
        ? ['#3B82F6', '#1D4ED8'] // brand blue -> rich royal blue (exact reference match at 60%)
        : ['#F87171', '#EF4444']; // coral red

  // Responsive stroke width
  const strokeWidth = customStrokeWidth ?? Math.max(9, Math.round(size * 0.095));
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  // Animated shared value for smooth transition
  const fillLevel = useSharedValue(0);
  const [animatedRatio, setAnimatedRatio] = useState(safeRatio);
  const [displayPercent, setDisplayPercent] = useState(() => Math.round(safeRatio * 100));
  const hasCelebrated = useRef(false);

  useEffect(() => {
    fillLevel.value = withTiming(safeRatio, {
      duration: 700,
      easing: Easing.out(Easing.cubic),
    });
  }, [safeRatio, fillLevel]);

  useAnimatedReaction(
    () => fillLevel.value,
    (current, previous) => {
      if (previous === null || Math.abs(current - previous) > 0.003) {
        runOnJS(setAnimatedRatio)(current);
        runOnJS(setDisplayPercent)(Math.round(current * 100));
      }
    },
  );

  useEffect(() => {
    if (safeRatio >= 1 && !hasCelebrated.current) {
      hasCelebrated.current = true;
      triggerHapticCascade();
    } else if (safeRatio < 1) {
      hasCelebrated.current = false;
    }
  }, [safeRatio]);

  // Track stroke color: very pale, translucent tint matching reference design
  const trackColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(57, 88, 134, 0.10)';

  // Calculate dash offset for SVG circle
  const clampedAnimRatio = Math.max(0, Math.min(1, animatedRatio));
  const strokeDashoffset = circumference * (1 - clampedAnimRatio);

  const gradientId = `ring-grad-${size}-${Math.round(safeRatio * 10)}`;

  return (
    <View
      testID={testID}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Svg width={size} height={size}>
        <Defs>
          <LinearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <Stop offset="0%" stopColor={gradientStart} />
            <Stop offset="100%" stopColor={gradientEnd} />
          </LinearGradient>
        </Defs>

        {/* Background track circle */}
        <Circle
          cx={center}
          cy={center}
          r={radius}
          stroke={trackColor}
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Foreground progress arc with rounded caps */}
        {clampedAnimRatio > 0.005 ? (
          <Circle
            cx={center}
            cy={center}
            r={radius}
            stroke={`url(#${gradientId})`}
            strokeWidth={strokeWidth}
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="none"
            transform={`rotate(-90 ${center} ${center})`}
          />
        ) : null}
      </Svg>

      {/* Center content: clean bold percentage without any box or border, matching reference */}
      <View
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
        className="items-center justify-center"
      >
        <Text
          style={{
            fontSize: Math.round(size * 0.24),
            fontWeight: '800',
            color: theme.colors.ink,
            letterSpacing: -0.5,
          }}
        >
          {displayPercent}%
        </Text>
        {label ? (
          <Text
            numberOfLines={1}
            style={{
              fontSize: Math.round(size * 0.1),
              fontWeight: '600',
              color: theme.colors.inkSecondary,
              marginTop: 2,
            }}
          >
            {label}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export const CircularProgressRing = LiquidProgressRing;

