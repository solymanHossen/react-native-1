import { useCallback, type ComponentType } from 'react';
import { ActivityIndicator, Pressable, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { triggerHaptic, type HapticType } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

const PRESS_SCALE = 0.96;
const SPRING_CONFIG = { damping: 16, stiffness: 220, mass: 0.5 };

export type LargeTextButtonVariant = 'primary' | 'secondary';

export interface LargeTextButtonProps {
  label: string;
  onPress: () => void;
  variant?: LargeTextButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  accessibilityLabel?: string;
  accessibilityHint?: string;
  hapticType?: HapticType;
  testID?: string;
  /** Renders the dark-mode glassmorphism styling regardless of the live theme — for AlarmScreen, which deliberately always shows a fixed dark surface no matter the user's light/dark preference. Every other caller leaves this unset and follows the live theme as before. */
  forceDark?: boolean;
  style?: StyleProp<ViewStyle>;
  className?: string;
  /**
   * Optional Lucide icon rendered to the left of the label.
   * Pass e.g. `icon={CircleCheck}` — the component receives `color` and
   * `size` automatically from the button so callers don’t need to thread
   * them manually. The icon is hidden while `loading` is true (the spinner
   * takes its place).
   */
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

/**
 * 56dp is the enforced *floor* (min-h-hit/min-w-hit) — the actual rendered
 * button is taller than that by design (generous vertical padding), after
 * direct user feedback that the original floor-height, 16px-radius buttons
 * read as too small/cramped for an app meant to work equally well for
 * older, middle-aged, and younger users. A fully rounded (`rounded-full`)
 * pill shape at this height reads as a single, unambiguous tap target
 * rather than a rounded rectangle.
 *
 * Spring-physics scale-down feedback plus a haptic pulse on press.
 * `loading` swaps the label for a spinner without changing the button's
 * size or dimming it — only `disabled` dims the button, so an in-flight
 * async action doesn't look "turned off".
 */
export function LargeTextButton({
  label,
  onPress,
  variant = 'primary',
  loading = false,
  disabled = false,
  accessibilityLabel,
  accessibilityHint,
  hapticType = 'impactMedium',
  testID,
  forceDark = false,
  style,
  className,
  icon: Icon,
}: LargeTextButtonProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const isInteractive = !disabled && !loading;

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = useCallback(() => {
    if (!isInteractive) return;
    scale.value = withSpring(PRESS_SCALE, SPRING_CONFIG);
  }, [isInteractive, scale]);

  const handlePressOut = useCallback(() => {
    scale.value = withSpring(1, SPRING_CONFIG);
  }, [scale]);

  const handlePress = useCallback(() => {
    if (!isInteractive) return;
    triggerHaptic(hapticType);
    onPress();
  }, [isInteractive, hapticType, onPress]);

  const isDark = forceDark || theme.mode === 'dark';
  const isPrimary = variant === 'primary';
  const backgroundColor = isPrimary ? theme.action.base : isDark ? 'rgba(31, 41, 55, 0.75)' : theme.colors.elevated;
  // The secondary-variant branch has no live-dark-mode value to fall back to
  // the way background/border do (they hardcode the glass rgba literal
  // directly) — without this branch, `forceDark` on a live-light device would
  // pair a forced-dark background with light-theme (dark) ink text, which is
  // illegible. In live dark mode `theme.colors.ink` is already '#FFFFFF', so
  // this changes nothing there; it only matters when `forceDark` diverges
  // from the live theme.
  const textColor = isPrimary ? theme.action.ink : isDark ? '#FFFFFF' : theme.colors.ink;
  const borderColor = isPrimary
    ? isDark
      ? 'rgba(96, 165, 250, 0.45)'
      : theme.action.base
    : isDark
      ? 'rgba(255, 255, 255, 0.08)'
      : theme.colors.hairline;

  // Dark mode gets the glassmorphism glow treatment; light mode stays flat
  // (as it always was) — no shadow at all.
  const shadowStyle = !isDark
    ? null
    : isPrimary
      ? {
          shadowColor: theme.action.base,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.45,
          shadowRadius: 14,
          elevation: 8,
        }
      : {
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.25,
          shadowRadius: 10,
          elevation: 4,
        };

  return (
    <AnimatedPressable
      testID={testID}
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={!isInteractive}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      className={`min-h-hit min-w-hit flex-row items-center justify-center rounded-full border px-8 py-4 ${disabled ? 'opacity-40' : ''} ${className ?? ''}`}
      style={[{ backgroundColor, borderColor }, shadowStyle, animatedStyle, style]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        // Icon + label rendered as a centred inline row. `gap-2` keeps the
        // icon and text snug without manual margin math. When no icon is
        // provided the View still renders, but with a single child — no
        // visible change to the button's layout.
        <View className="flex-row items-center justify-center gap-2">
          {Icon ? (
            <Icon size={20} color={textColor} strokeWidth={2.5} />
          ) : null}
          {/* numberOfLines={2} — see comment in the original file header */}
          <Text className="text-body-lg text-center" style={{ color: textColor, fontWeight: '600' }} numberOfLines={2}>
            {label}
          </Text>
        </View>
      )}
    </AnimatedPressable>
  );
}
