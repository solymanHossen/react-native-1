import { Text, View } from 'react-native';
import { useTranslation, type TranslationKey } from '../../i18n';
import { useTheme } from '../../theme/useTheme';
import { status, type StatusKey } from '../../theme/tokens';

const STATUS_LABEL_KEY: Record<StatusKey, TranslationKey> = {
  fasting: 'status.fasting',
  taken: 'status.taken',
  pending: 'status.pending',
  missed: 'status.missed',
  scheduled: 'status.scheduled',
};

export interface StatusPillProps {
  status: StatusKey;
  /** Overrides the translated default label (e.g. "Taken" -> "Taken at 8:02 AM"). Callers that build their own label are responsible for translating it themselves. */
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
  const { t } = useTranslation();
  const token = status[statusKey];
  // The vivid hue for THIS mode — `token.base` alone is always the light-mode
  // hue now that dark mode has its own `baseDark` (see theme/tokens.ts), so
  // every glow/border/dot here needs this resolved value, not the raw token.
  const hue = theme.mode === 'dark' ? (token.baseDark ?? token.base) : token.base;
  const textColor = theme.statusText(statusKey);
  const tint = theme.statusTint(statusKey);
  const displayLabel = label ?? t(STATUS_LABEL_KEY[statusKey]);

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${displayLabel} status`}
      className="flex-row items-center self-start rounded-full border px-3.5 py-1.5"
      style={{
        backgroundColor: tint,
        borderColor: `${hue}44`,
        shadowColor: hue,
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
        elevation: 3,
      }}
    >
      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: hue,
          marginRight: 6,
          shadowColor: hue,
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.8,
          shadowRadius: 4,
          elevation: 2,
        }}
      />
      <Text className="text-caption font-semibold" style={{ color: textColor, letterSpacing: 0.2 }} numberOfLines={1}>
        {displayLabel}
      </Text>
    </View>
  );
}
