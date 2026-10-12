import type { ComponentType } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../../theme/useTheme';

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
      style={[{ opacity: disabled ? 0.5 : 1 }, style]}
    >
      <View
        className="items-center justify-center rounded-xl"
        style={{
          width: 38,
          height: 38,
          backgroundColor: theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.14)' : `${theme.action.base}14`,
          borderWidth: theme.mode === 'dark' ? 1 : 0,
          borderColor: 'rgba(59, 130, 246, 0.25)',
        }}
      >
        <Icon color={theme.action.base} size={19} strokeWidth={2.2} />
      </View>
      <View className="flex-1">
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
  children: React.ReactNode;
}

/** The rounded-3xl card + hairline-divider chrome shared by every group of `ActionRow`s */
export function ActionRowGroup({ children }: ActionRowGroupProps) {
  const theme = useTheme();
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean);

  return (
    <View
      className="overflow-hidden rounded-3xl"
      style={{
        backgroundColor: theme.mode === 'dark' ? 'rgba(31, 41, 55, 0.75)' : theme.colors.elevated,
        borderWidth: 1,
        borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.08,
        shadowRadius: 16,
        elevation: 6,
      }}
    >
      {theme.mode === 'dark' ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 20,
            right: 20,
            height: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          }}
        />
      ) : null}
      {rows.map((row, index) => (
        <View key={index}>
          {index > 0 ? (
            <View
              style={{
                height: 1,
                backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : theme.colors.hairline,
                marginLeft: 16 + 38 + 14,
              }}
            />
          ) : null}
          {row}
        </View>
      ))}
    </View>
  );
}
