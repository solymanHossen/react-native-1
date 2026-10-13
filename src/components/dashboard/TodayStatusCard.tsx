import { ChevronRight, CircleCheck, CircleDot, CircleMinus, CircleSlash, CircleX, type LucideIcon } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { status, type StatusKey } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

/**
 * Per-status Lucide icon map — module-level constant (allocated once per
 * bundle, never per render). Icons chosen for semantic unambiguity:
 *
 *  taken     → CircleCheck   ✓  positive / complete
 *  missed    → CircleX       ✗  negative / failed
 *  pending   → CircleDot     ·  imminent / not yet acted on
 *  scheduled → CircleMinus   —  neutral  / upcoming
 *  fasting   → CircleSlash   ⊘  intentional hold / dietary
 */
const STATUS_ICON: Record<StatusKey, LucideIcon> = {
  taken: CircleCheck,
  missed: CircleX,
  pending: CircleDot,
  scheduled: CircleMinus,
  fasting: CircleSlash,
};

/**
 * Background tint alpha per mode.
 * Light mode uses a stronger alpha (28 ≈ 16%) so the card reads as clearly
 * coloured — not just a barely-tinted ghost — matching the reference design's
 * "obviously green / obviously red" pill appearance.
 * Dark mode keeps a lighter tint (18 ≈ 9%) because the glassmorphism surface
 * is already dark enough that a heavy tint would look overpowering.
 */
const TINT_ALPHA_LIGHT = '2E'; // ≈ 18%  — visible colour wash on white
const TINT_ALPHA_DARK = '18';  // ≈  9%  — subtle on near-black glass

export interface TodayStatusCardProps {
  status: StatusKey;
  label: string;
  count: number;
  /** Optional press handler — also controls whether the card renders as a button. */
  onPress?: () => void;
  testID?: string;
}

/**
 * Clinical status badge card for Today's Progress.
 *
 * Layout: [icon chip] [label]  [count badge] [›]
 *
 * The coloured circular icon chip (status hue as fill, white icon inside)
 * makes the card's meaning legible even in peripheral vision — no
 * colour-only differentiation. A stronger background tint than the global
 * statusTint() gives each card a clear, distinct identity.
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

  // Resolve vivid hue for this mode (dark has its own palette via baseDark).
  const hue = theme.mode === 'dark' ? (token.baseDark ?? token.base) : token.base;
  const textColor = theme.statusText(statusKey);

  // Stronger tint than the global helper — the chip fill already uses the
  // full hue, so bumping the background alpha makes the whole card read as
  // one cohesive coloured element rather than a plain white pill with a
  // small coloured dot stuck on it.
  const tintAlpha = theme.mode === 'dark' ? TINT_ALPHA_DARK : TINT_ALPHA_LIGHT;
  const backgroundColor = `${hue}${tintAlpha}`;

  const StatusIcon = STATUS_ICON[statusKey];

  const card = (
    <View
      testID={onPress ? undefined : testID}
      accessible={!onPress}
      accessibilityRole={onPress ? undefined : 'text'}
      accessibilityLabel={`${label}: ${count} doses`}
      className="flex-1 flex-row items-center justify-between rounded-2xl border px-3.5 py-3"
      style={{
        backgroundColor,
        borderColor: theme.mode === 'dark' ? `${hue}38` : `${hue}40`,
        overflow: 'hidden',
        // Hue-tinted elevation — the shadow colour matches the card accent so
        // the whole unit reads as one coloured chip floating above the canvas.
        shadowColor: hue,
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: theme.mode === 'dark' ? 0.18 : 0.22,
        shadowRadius: 8,
        elevation: 3,
      }}
    >
      {/* ── Left: icon chip + label ──────────────────────────────────── */}
      <View className="flex-row items-center gap-2 flex-1" style={{ backgroundColor: 'transparent' }}>
        {/*
         * Circular icon chip: full-hue fill + white icon = maximum contrast
         * with zero extra colour math. The drop shadow repeats the hue so the
         * chip glows out of the tinted background rather than just sitting on it.
         */}
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: 13,
            backgroundColor: hue,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: hue,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.5,
            shadowRadius: 5,
            elevation: 4,
          }}
        >
          <StatusIcon size={15} color="#FFFFFF" strokeWidth={2.5} />
        </View>

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

      {/* ── Right: count badge + chevron ────────────────────────────── */}
      <View className="flex-row items-center gap-1.5">
        <View
          className="items-center justify-center rounded-full px-2.5 py-0.5"
          style={{
            // Count chip background uses a slightly stronger alpha than the
            // card so it reads as a nested layer, not just the same surface.
            backgroundColor: theme.mode === 'dark' ? `${hue}30` : `${hue}25`,
            borderWidth: 1,
            borderColor: theme.mode === 'dark' ? `${hue}50` : `${hue}45`,
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
        <ChevronRight color={textColor} size={14} strokeWidth={2.5} />
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
