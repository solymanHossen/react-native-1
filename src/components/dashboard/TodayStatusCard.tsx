import { Text, View } from 'react-native';
import { status, type StatusKey } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

export interface TodayStatusCardProps {
  status: StatusKey;
  label: string;
  count: number;
  testID?: string;
}

/**
 * Modern Status Card for Today's Progress.
 *
 * Renders an elevated, clinical status badge card with:
 * - Glowing status dot indicator
 * - Bold translated status label (e.g. Taken, Missed, Pending)
 * - Harmonious tinted count badge (seamless with the card's status hue, never white)
 * - Responsive flex sizing: 100% full width for single card, 50% side-by-side for pairs.
 */
export function TodayStatusCard({
  status: statusKey,
  label,
  count,
  testID,
}: TodayStatusCardProps) {
  const theme = useTheme();
  const token = status[statusKey];
  const hue = theme.mode === 'dark' ? (token.baseDark ?? token.base) : token.base;
  const textColor = theme.statusText(statusKey);
  const tint = theme.statusTint(statusKey);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${label}: ${count} doses`}
      className="flex-1 flex-row items-center justify-between rounded-2xl border px-3.5 py-2.5"
      style={{
        backgroundColor: tint,
        borderColor: theme.mode === 'dark' ? `${hue}38` : `${hue}28`,
        overflow: 'hidden',
      }}
    >
      {/* Left indicator + status label */}
      <View className="flex-row items-center gap-2 flex-1 mr-2" style={{ backgroundColor: 'transparent' }}>
        <View
          style={{
            width: 7,
            height: 7,
            borderRadius: 3.5,
            backgroundColor: hue,
          }}
        />
        <Text
          numberOfLines={1}
          style={{
            color: textColor,
            fontSize: 14,
            fontWeight: '700',
            letterSpacing: 0.2,
            backgroundColor: 'transparent',
          }}
        >
          {label}
        </Text>
      </View>

      {/* Right count badge (harmonious tinted chip, never opaque white) */}
      <View
        className="items-center justify-center rounded-full px-2.5 py-0.5"
        style={{
          backgroundColor: theme.mode === 'dark' ? `${hue}25` : `${hue}18`,
          borderWidth: 1,
          borderColor: theme.mode === 'dark' ? `${hue}40` : `${hue}28`,
        }}
      >
        <Text
          style={{
            color: textColor,
            fontSize: 13,
            fontWeight: '800',
            backgroundColor: 'transparent',
          }}
        >
          {count}
        </Text>
      </View>
    </View>
  );
}
