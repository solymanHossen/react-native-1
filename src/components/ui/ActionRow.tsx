import type { ComponentType, ReactNode } from 'react';
import { ActivityIndicator, Pressable, type StyleProp, Text, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/useTheme';
import { GlassCard } from './GlassCard';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
const PRESS_SPRING = { damping: 16, stiffness: 220, mass: 0.5 };

export interface ActionRowProps {
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  label: string;
  /** Secondary line under the label, e.g. what the action does or why it's unavailable. */
  caption?: string;
  onPress?: () => void;
  loading?: boolean;
  disabled?: boolean;
  /** Hides the trailing chevron for a row that doesn't navigate anywhere (e.g. a disabled/informational row). */
  showChevron?: boolean;
  testID?: string;
}

/**
 * A single tappable menu row — icon chip, label (+ optional caption), trailing
 * chevron or spinner — meant to be stacked inside a `ActionRowGroup` card.
 *
 * This replaces using `LargeTextButton` (a committing, one-off-action pill)
 * for things that are actually just navigation ("open Settings", "open
 * Health Records"): a full-width colored pill repeated five times in a row
 * gives every entry equal, maximum visual weight regardless of how
 * significant it is, and takes far more vertical space than a menu list
 * needs to. `LargeTextButton` stays reserved for the one or two things on a
 * screen that genuinely commit something (Mark as Taken, Confirm) — this is
 * for "go look at/open X".
 */
export function ActionRow({ icon: Icon, label, caption, onPress, loading = false, disabled = false, showChevron = true, testID }: ActionRowProps) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const isInteractive = Boolean(onPress) && !disabled && !loading;

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      testID={testID}
      onPress={isInteractive ? onPress : undefined}
      onPressIn={() => {
        if (isInteractive) scale.value = withSpring(0.98, PRESS_SPRING);
      }}
      onPressOut={() => {
        scale.value = withSpring(1, PRESS_SPRING);
      }}
      disabled={!isInteractive}
      accessibilityRole={isInteractive ? 'button' : undefined}
      accessibilityLabel={caption ? `${label}. ${caption}` : label}
      accessibilityState={{ disabled: !isInteractive, busy: loading }}
      className="min-h-hit flex-row items-center gap-3.5 px-4 py-3.5"
      style={[{ opacity: disabled ? 0.5 : 1, backgroundColor: 'transparent' }, style]}
    >
      <View
        className="items-center justify-center rounded-2xl"
        style={{
          width: 40,
          height: 40,
          backgroundColor: theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.14)' : `${theme.action.base}12`,
          borderWidth: 1,
          borderColor: theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.25)' : `${theme.action.base}18`,
        }}
      >
        <Icon color={theme.action.base} size={19} strokeWidth={2.2} />
      </View>
      <View className="flex-1" style={{ backgroundColor: 'transparent' }}>
        <Text className="text-body-lg font-semibold" numberOfLines={1} style={{ color: theme.colors.ink }}>
          {label}
        </Text>
        {caption ? (
          <Text className="mt-0.5 text-caption font-medium" numberOfLines={1} style={{ color: theme.colors.inkSecondary }}>
            {caption}
          </Text>
        ) : null}
      </View>
      {loading ? (
        <ActivityIndicator color={theme.action.base} />
      ) : showChevron && onPress ? (
        <ChevronRight color={theme.colors.inkMuted} size={18} strokeWidth={2.2} />
      ) : null}
    </AnimatedPressable>
  );
}

export interface ActionRowGroupProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  glowColor?: string;
  hasGlow?: boolean;
}

/** The glassmorphism card + hairline-divider chrome shared by every group of `ActionRow`s */
export function ActionRowGroup({
  children,
  style,
  className = '',
  glowColor,
  hasGlow,
}: ActionRowGroupProps) {
  const theme = useTheme();
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean);

  return (
    <GlassCard className={`rounded-3xl ${className}`} style={style} glowColor={glowColor} hasGlow={hasGlow}>
      {rows.map((row, index) => (
        <View key={index} style={{ backgroundColor: 'transparent' }}>
          {index > 0 ? (
            <View
              style={{
                height: 1,
                backgroundColor:
                  theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : 'rgba(57, 88, 134, 0.08)',
                marginLeft: 16 + 40 + 14,
              }}
            />
          ) : null}
          {row}
        </View>
      ))}
    </GlassCard>
  );
}
