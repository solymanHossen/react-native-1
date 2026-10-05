import { Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { status, type StatusKey } from '../../theme/tokens';

export interface StatusPillProps {
  status: StatusKey;
  /** Overrides the token's default label (e.g. "Taken" -> "Taken at 8:02 AM"). */
  label?: string;
  testID?: string;
}

/**
 * Glowing translucent badge for the five clinical states (fasting, taken,
 * pending, missed, scheduled). Not a touch target, so the 56dp hitbox rule
 * doesn't apply here — see LargeTextButton for that.
 *
 * Text/icon color comes from `theme.statusText()`, which resolves to a
 * darkened (light theme) or brightened (dark theme, Scheduled only) variant
 * of the status hue — the raw vivid hue reads fine on dark surfaces but
 * fails contrast against a near-white tint. The tint itself always uses the
 * vivid base hue at ~8% alpha, verified to hold >= 4.5:1 text contrast
 * against the tint for every status/theme/surface combination.
 */
export function StatusPill({ status: statusKey, label, testID }: StatusPillProps) {
  const theme = useTheme();
  const token = status[statusKey];
  const textColor = theme.statusText(statusKey);
  const tint = theme.statusTint(statusKey);
  const displayLabel = label ?? token.label;

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${displayLabel} status`}
      className="flex-row items-center self-start rounded-full border px-4 py-2"
      style={{
        backgroundColor: tint,
        borderColor: `${token.base}33`,
        boxShadow: [
          { offsetX: 0, offsetY: 0, color: `${token.base}73`, blurRadius: 10, spreadDistance: 1 },
        ],
      }}
    >
      <View className="mr-2 h-2.5 w-2.5 rounded-full" style={{ backgroundColor: token.base }} />
      <Text className="text-caption" style={{ color: textColor }} numberOfLines={1}>
        {displayLabel}
      </Text>
    </View>
  );
}
