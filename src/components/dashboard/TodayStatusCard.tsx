import { Ban, Check, ChevronRight, Clock, Minus, X, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { status, type StatusKey } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * Per-status Lucide icon map matching the reference design:
 * Solid circular chip with clean white glyph inside:
 *
 *  taken     → Check   ✓  crisp white checkmark
 *  missed    → X       ✗  crisp white cross
 *  pending   → Clock   ·  imminent / upcoming time
 *  scheduled → Minus   —  neutral / scheduled
 *  fasting   → Ban     ⊘  hold / dietary fasting
 */
const STATUS_ICON: Record<StatusKey, LucideIcon> = {
  taken: Check,
  missed: X,
  pending: Clock,
  scheduled: Minus,
  fasting: Ban,
};

/**
 * Background tint alpha per mode:
 * Light mode uses ~10% (1A) so the card reads as a soft, luminous pastel pill
 * matching the reference design.
 * Dark mode keeps a subtle ~9% (18) translucent medical tint on glass.
 */
const TINT_ALPHA_LIGHT = '1A'; // ≈ 10% — soft luminous pastel wash on white
const TINT_ALPHA_DARK = '18';  // ≈  9% — refined tint on dark glass

export interface TodayStatusCardProps {
  status: StatusKey;
  label: string;
  count: number;
  /** Optional press handler — also controls whether the card renders as a button. */
  onPress?: () => void;
  testID?: string;
}

/**
 * Clinical status badge card for Today's Progress matching the reference design:
 *
 * Layout: [● Icon] [Label]               [Count] [›]
 *
 * Left: Solid vivid circular icon chip (status hue fill + bold white glyph)
 * Center: Status label in deep contrast status text
 * Right: Bold count number directly beside the chevron arrow
 */
export function TodayStatusCard({
  status: statusKey,
  label,
  count,
  onPress,
  testID,
}: TodayStatusCardProps) {
  const theme = useTheme();
  const token = status[statusKey];

  // Resolve vivid hue for this mode (using vivid medical tones from palette)
  const hue = theme.mode === 'dark' ? (token.baseDark ?? token.base) : (token.baseDark ?? token.base);
  const textColor = theme.statusText(statusKey);

  // Soft luminous pastel background tint matching reference
  const tintAlpha = theme.mode === 'dark' ? TINT_ALPHA_DARK : TINT_ALPHA_LIGHT;
  const backgroundColor = `${hue}${tintAlpha}`;

  const StatusIcon = STATUS_ICON[statusKey];

  const card = (
    <View
      testID={onPress ? undefined : testID}
      accessible={!onPress}
      accessibilityRole={onPress ? undefined : 'text'}
      accessibilityLabel={`${label}: ${count} doses`}
      className="flex-1 flex-row items-center justify-between rounded-2xl px-3.5 py-3"
      style={{
        backgroundColor,
        borderColor: theme.mode === 'dark' ? `${hue}32` : `${hue}20`,
        borderWidth: 1,
        overflow: 'hidden',
        // Hue-tinted soft elevation glow matching reference pill appearance
        shadowColor: hue,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: theme.mode === 'dark' ? 0.22 : 0.16,
        shadowRadius: 10,
        elevation: 2,
      }}
    >
      {/* ── Left: solid icon chip + label ────────────────────────────── */}
      <View className="flex-row items-center gap-2.5 flex-1" style={{ backgroundColor: 'transparent' }}>
        {/*
         * Circular icon chip: full-hue fill + white glyph inside = maximum clarity
         */}
        <View
          style={{
            width: 28,
            height: 28,
            borderRadius: 14,
            backgroundColor: hue,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: hue,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.3,
            shadowRadius: 4,
            elevation: 2,
          }}
        >
          <StatusIcon
            size={statusKey === 'taken' ? 16 : 15}
            color="#FFFFFF"
            strokeWidth={3}
          />
        </View>

        <Text
          numberOfLines={1}
          style={{
            color: textColor,
            fontSize: 15,
            fontWeight: '700',
            letterSpacing: 0.1,
            backgroundColor: 'transparent',
          }}
        >
          {label}
        </Text>
      </View>

      {/* ── Right: count + chevron ───────────────────────────────────── */}
      <View className="flex-row items-center gap-1.5">
        <Text
          style={{
            color: textColor,
            fontSize: 17,
            fontWeight: '800',
            backgroundColor: 'transparent',
          }}
        >
          {count}
        </Text>
        <ChevronRight color={textColor} size={16} strokeWidth={2.5} />
      </View>
    </View>
  );

  // Only wrap in Pressable when an onPress handler is provided.
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${count} doses`}
        className="flex-1"
      >
        {card}
      </Pressable>
    );
  }

  return card;
}
