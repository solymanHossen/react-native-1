import { Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

interface VitalStepperCardProps {
  label: string;
  value: number;
  unit: string;
  step: number;
  min?: number;
  max?: number;
  decimals?: number;
  onChange: (value: number) => void;
}

/**
 * "Large, single-tap" input, taken literally: the +/- buttons are the
 * primary entry mechanism (56dp hitboxes, one tap per step), not a keyboard
 * — a free-text numeric field would ask for more precision and more typing
 * than logging a daily reading needs.
 */
export function VitalStepperCard({ label, value, unit, step, min = 0, max = 999, decimals = 0, onChange }: VitalStepperCardProps) {
  const theme = useTheme();

  const adjust = (delta: number) => {
    const next = Math.min(max, Math.max(min, Number((value + delta).toFixed(2))));
    triggerHaptic('selection');
    onChange(next);
  };

  return (
    <View className="gap-4 rounded-3xl border p-6" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
      <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
        {label}
      </Text>
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={() => adjust(-step)}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${label}`}
          className="min-h-hit min-w-hit items-center justify-center rounded-full border"
          style={{ width: 56, height: 56, borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface }}
        >
          <Minus color={theme.colors.ink} size={24} />
        </Pressable>
        <View className="flex-row items-baseline gap-1">
          <Text className="text-display-lg" style={{ color: theme.colors.ink }}>
            {value.toFixed(decimals)}
          </Text>
          <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
            {unit}
          </Text>
        </View>
        <Pressable
          onPress={() => adjust(step)}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${label}`}
          className="min-h-hit min-w-hit items-center justify-center rounded-full border"
          style={{ width: 56, height: 56, borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface }}
        >
          <Plus color={theme.colors.ink} size={24} />
        </Pressable>
      </View>
    </View>
  );
}
