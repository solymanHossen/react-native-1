import type { ReactNode } from 'react';
import { Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { useTheme } from '../../theme/useTheme';
import { status as statusTokens, type StatusKey } from '../../theme/tokens';
import { StatusPill } from './StatusPill';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
/** Same spring used by LargeTextButton/ActionRow — one consistent press feel across every tappable surface. */
const PRESS_SPRING = { damping: 16, stiffness: 220, mass: 0.5 };

export interface MetricCardProps {
  /** Eyebrow label, e.g. "Blood Glucose". */
  label: string;
  /** The headline metric, e.g. "126". Pre-formatted by the caller. */
  value: string;
  /** Unit suffix rendered next to the value, e.g. "mg/dL". */
  unit?: string;
  /** Secondary line under the value, e.g. "Last reading 2h ago". */
  caption?: string;
  status?: StatusKey;
  icon?: ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  testID?: string;
  /** Smaller padding and a Title-Large (not Display-Large) value, for a card in a horizontal carousel rather than a full-width/2-up grid slot. */
  compact?: boolean;
}

/**
 * 24dp-rounded elevated container (`rounded-3xl` = 24px, matching Tailwind's
 * default scale exactly — no custom radius token needed).
 *
 * "Contrast slot isolation": each slot gets a color tier appropriate to its
 * weight — the headline value uses full-contrast `ink`, while the label and
 * caption use `inkSecondary` rather than the even-lower-contrast `inkMuted`,
 * because both are classed as AAA body text (>= 7:1, verified against the
 * elevated surface in both themes) rather than decorative chrome.
 */
export function MetricCard({ label, value, unit, caption, status, icon, onPress, testID, compact = false }: MetricCardProps) {
  const theme = useTheme();
  const isInteractive = Boolean(onPress);
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  // The container is a single `accessible` node, so VoiceOver/TalkBack never
  // sees the caption or StatusPill as separate elements — everything a
  // screen reader needs has to be folded into this one label.
  const accessibilityLabel = [
    `${label}: ${value}${unit ? ` ${unit}` : ''}`,
    caption,
    status ? `Status: ${statusTokens[status].label}` : undefined,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <AnimatedPressable
      testID={testID}
      onPress={onPress}
      onPressIn={() => {
        if (isInteractive) scale.value = withSpring(0.98, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      disabled={!isInteractive}
      accessible
      accessibilityRole={isInteractive ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      className={`min-h-hit rounded-3xl ${compact ? 'px-4 pt-4 pb-5' : 'px-6 pt-6 pb-7'}`}
      style={[
        {
          // Fixed (not minimum) height in compact mode: these cards sit
          // side-by-side in HomeScreen's horizontal Vitals strip, where one
          // card's optional status pill or a caption that wraps to a second
          // line (e.g. "High Blood Pressure Stage 2") used to make it taller
          // than its neighbors, breaking the row's bottom alignment. Fixing
          // the height makes every card the same size regardless of which
          // optional content it has; shorter content just leaves empty
          // space below rather than the whole card shrinking. Bumped +8 over
          // the old 190 to match the extra bottom padding above (bottom >
          // top, since a trailing StatusPill's solid fill reads as touching
          // the edge at equal padding) without tightening the margin below
          // it in the no-pill, two-line-caption case.
          height: compact ? 198 : undefined,
          // Translucent (not flat opaque) in light mode too, matching
          // GlassCard — this is the same floating-glass system as Home's
          // hero cards, so the ambient background behind it shows through.
          backgroundColor: theme.mode === 'dark' ? 'rgba(31, 41, 55, 0.75)' : 'rgba(255, 255, 255, 0.70)',
          borderWidth: 1,
          borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
          // Cross-platform `boxShadow` (Fabric) replaces the old shadow*/elevation
          // combo — on Android, `elevation` alone renders a crude, flat Material
          // drop shadow that ignores shadowColor/Radius entirely, which read as
          // muddy/harsh next to iOS's soft shadow. A layered contact + ambient
          // shadow (tinted with brand ink, not flat black) looks soft and
          // consistent on both platforms.
          boxShadow:
            theme.mode === 'dark'
              ? [
                  { offsetX: 0, offsetY: 2, blurRadius: 4, color: 'rgba(0, 0, 0, 0.3)' },
                  { offsetX: 0, offsetY: 12, blurRadius: 28, spreadDistance: -4, color: 'rgba(0, 0, 0, 0.35)' },
                ]
              : [
                  { offsetX: 0, offsetY: 1, blurRadius: 3, color: 'rgba(57, 88, 134, 0.08)' },
                  { offsetX: 0, offsetY: 10, blurRadius: 24, spreadDistance: -4, color: 'rgba(57, 88, 134, 0.12)' },
                ],
        },
        pressStyle,
      ]}
    >
      {theme.mode === 'dark' ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 16,
            right: 16,
            height: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          }}
        />
      ) : null}
      <View className="flex-row items-start justify-between">
        <Text
          className="text-caption font-semibold uppercase tracking-wider"
          style={{ color: theme.colors.inkSecondary }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {icon}
      </View>

      <View className="mt-2 flex-row items-baseline">
        <Text className={compact ? 'text-title-lg' : 'text-display-lg'} style={{ color: theme.colors.ink, fontWeight: '800' }} numberOfLines={1}>
          {value}
        </Text>
        {unit ? (
          <Text className="ml-1 text-body-lg font-medium" style={{ color: theme.colors.inkSecondary }}>
            {unit}
          </Text>
        ) : null}
      </View>

      {caption ? (
        <Text
          className="mt-3 text-caption"
          numberOfLines={2}
          style={{ color: theme.colors.inkSecondary, minHeight: compact ? 38 : undefined }}
        >
          {caption}
        </Text>
      ) : null}
      {status ? (
        <View className="mt-2">
          <StatusPill status={status} />
        </View>
      ) : null}
    </AnimatedPressable>
  );
}
