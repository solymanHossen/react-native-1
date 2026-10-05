import { useCallback } from 'react';
import { ActivityIndicator, Pressable, Text } from 'react-native';
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

  const isPrimary = variant === 'primary';
  const backgroundColor = isPrimary ? theme.action.base : theme.colors.elevated;
  const textColor = isPrimary ? theme.action.ink : theme.colors.ink;
  const borderColor = isPrimary ? theme.action.base : theme.colors.hairline;

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
      className={`min-h-hit min-w-hit flex-row items-center justify-center rounded-full border px-8 py-5 ${disabled ? 'opacity-40' : ''}`}
      style={[{ backgroundColor, borderColor }, animatedStyle]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <Text className="text-body-lg" style={{ color: textColor, fontWeight: '600' }} numberOfLines={1}>
          {label}
        </Text>
      )}
    </AnimatedPressable>
  );
}
