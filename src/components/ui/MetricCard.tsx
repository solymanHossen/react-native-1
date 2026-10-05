import type { ReactNode } from 'react';
import { Pressable, Text, View, type GestureResponderEvent } from 'react-native';
import { useTheme } from '../../theme/useTheme';
import { status as statusTokens, type StatusKey } from '../../theme/tokens';
import { StatusPill } from './StatusPill';

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
export function MetricCard({ label, value, unit, caption, status, icon, onPress, testID }: MetricCardProps) {
  const theme = useTheme();
  const Container = onPress ? Pressable : View;

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
    <Container
      testID={testID}
      onPress={onPress}
      accessible
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={accessibilityLabel}
      className="min-h-hit rounded-3xl border p-5 shadow-md"
      style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
    >
      <View className="flex-row items-start justify-between">
        <Text
          className="text-caption uppercase tracking-wider"
          style={{ color: theme.colors.inkSecondary }}
          numberOfLines={1}
        >
          {label}
        </Text>
        {icon}
      </View>

      <View className="mt-2 flex-row items-baseline">
        <Text className="text-display-lg" style={{ color: theme.colors.ink }} numberOfLines={1}>
          {value}
        </Text>
        {unit ? (
          <Text className="ml-1 text-body-lg" style={{ color: theme.colors.inkSecondary }}>
            {unit}
          </Text>
        ) : null}
      </View>

      {/* Stacked, not side-by-side: a pill's fixed width next to a long
          caption left too little room for either to read fully on a narrow
          (e.g. 2-up grid) card. */}
      {caption ? (
        <Text className="mt-3 text-caption" style={{ color: theme.colors.inkSecondary }}>
          {caption}
        </Text>
      ) : null}
      {status ? (
        <View className="mt-2">
          <StatusPill status={status} />
        </View>
      ) : null}
    </Container>
  );
}
