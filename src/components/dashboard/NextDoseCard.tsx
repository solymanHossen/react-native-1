import { Check, Clock, Info, Sparkles, Utensils } from 'lucide-react-native';
import { useEffect, useMemo } from 'react';
import { Image, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import type { DosageForm } from '../../db/types';
import { useTranslation, type TranslationKey } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import type { IntakeQueueItem, IntakeQueueStatus } from '../../store';
import { type StatusKey } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';
import { GlassCard } from '../ui/GlassCard';
import { LargeTextButton } from '../ui/LargeTextButton';
import { StatusPill } from '../ui/StatusPill';

/**
 * Maps IntakeQueueStatus to design system StatusKey for token styling.
 */
export const STATUS_TO_KEY: Record<IntakeQueueStatus, StatusKey> = {
  TAKEN: 'taken',
  MISSED: 'missed',
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
};

/**
 * 3D Icon and color system for all 5 clinical dosage forms:
 * Capsule, Tablet, Syrup, Injection, Drop.
 */
export const DOSAGE_FORM_ASSETS: Record<DosageForm, any> = {
  capsule: require('../../../assets/branding/capsule-pill.png'),
  tablet: require('../../../assets/branding/tablet.png'),
  syrup: require('../../../assets/branding/syrup.png'),
  injection: require('../../../assets/branding/injection.png'),
  drop: require('../../../assets/branding/drop.png'),
};

interface FormStyleMeta {
  asset: any;
  formKey: DosageForm;
  labelKey: TranslationKey;
  accent: string;
  auraLight: string;
  auraDark: string;
  glowColor: string;
}

const FORM_META: Record<DosageForm, FormStyleMeta> = {
  capsule: {
    asset: DOSAGE_FORM_ASSETS.capsule,
    formKey: 'capsule',
    labelKey: 'medications.forms.capsule',
    accent: '#3B82F6',
    auraLight: 'rgba(59, 130, 246, 0.12)',
    auraDark: 'rgba(59, 130, 246, 0.24)',
    glowColor: '#3B82F6',
  },
  tablet: {
    asset: DOSAGE_FORM_ASSETS.tablet,
    formKey: 'tablet',
    labelKey: 'medications.forms.tablet',
    accent: '#2563EB',
    auraLight: 'rgba(37, 99, 235, 0.12)',
    auraDark: 'rgba(37, 99, 235, 0.24)',
    glowColor: '#2563EB',
  },
  syrup: {
    asset: DOSAGE_FORM_ASSETS.syrup,
    formKey: 'syrup',
    labelKey: 'medications.forms.syrup',
    accent: '#0284C7',
    auraLight: 'rgba(2, 132, 199, 0.14)',
    auraDark: 'rgba(14, 165, 233, 0.26)',
    glowColor: '#0284C7',
  },
  injection: {
    asset: DOSAGE_FORM_ASSETS.injection,
    formKey: 'injection',
    labelKey: 'medications.forms.injection',
    accent: '#4F46E5',
    auraLight: 'rgba(79, 70, 229, 0.12)',
    auraDark: 'rgba(99, 102, 241, 0.24)',
    glowColor: '#4F46E5',
  },
  drop: {
    asset: DOSAGE_FORM_ASSETS.drop,
    formKey: 'drop',
    labelKey: 'medications.forms.drop',
    accent: '#0EA5E9',
    auraLight: 'rgba(14, 165, 233, 0.12)',
    auraDark: 'rgba(56, 189, 248, 0.24)',
    glowColor: '#0EA5E9',
  },
};

/**
 * Intelligently resolves the dosage form from explicit form value or dosage text.
 */
export function resolveDosageForm(form?: string, dosageLabel?: string, name?: string): DosageForm {
  if (form) {
    const normalized = form.toLowerCase().trim();
    if (normalized === 'tablet' || normalized === 'pill') return 'tablet';
    if (normalized === 'syrup' || normalized === 'liquid') return 'syrup';
    if (normalized === 'drop' || normalized === 'drops') return 'drop';
    if (normalized === 'injection' || normalized === 'syringe' || normalized === 'shot') return 'injection';
    if (normalized === 'capsule') return 'capsule';
  }

  const combined = `${dosageLabel ?? ''} ${name ?? ''}`.toLowerCase();
  if (combined.includes('syrup') || combined.includes('solution') || combined.includes('suspension')) return 'syrup';
  if (combined.includes('drop') || combined.includes('drops')) return 'drop';
  if (combined.includes('injection') || combined.includes('syringe') || combined.includes('vial') || combined.includes('shot')) return 'injection';
  if (combined.includes('tablet') || combined.includes('tab') || combined.includes('pill')) return 'tablet';
  if (combined.includes('capsule') || combined.includes('cap')) return 'capsule';

  return 'capsule';
}

/**
 * Format UTC schedule time to 12-hour AM/PM string (e.g. "8:00 AM").
 */
export function formatTimeLabel(timeUtc: string): string {
  if (!timeUtc || !timeUtc.includes(':')) return timeUtc;
  const [hours, minutes] = timeUtc.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const h12 = hours % 12 === 0 ? 12 : hours % 12;
  return `${h12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

/**
 * Calculates dynamic time difference label relative to current hour & minute.
 */
export function formatDynamicTimeBadge(timeUtc: string, status: IntakeQueueStatus): { label: string; isUrgent: boolean } {
  if (!timeUtc || !timeUtc.includes(':')) {
    return { label: status === 'MISSED' ? 'Overdue' : 'Due soon', isUrgent: status === 'MISSED' };
  }

  const [hours, minutes] = timeUtc.split(':').map(Number);
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const doseMinutes = hours * 60 + minutes;
  const diffMinutes = doseMinutes - currentMinutes;

  if (status === 'MISSED') {
    const overdueMinutes = Math.abs(diffMinutes);
    if (overdueMinutes >= 60) {
      const h = Math.floor(overdueMinutes / 60);
      const m = overdueMinutes % 60;
      return { label: m > 0 ? `${h}h ${m}m overdue` : `${h}h overdue`, isUrgent: true };
    }
    return { label: overdueMinutes > 0 ? `${overdueMinutes}m overdue` : 'Overdue', isUrgent: true };
  }

  if (status === 'PENDING') {
    if (diffMinutes <= 0) return { label: 'Due now', isUrgent: true };
    return { label: `Due in ${diffMinutes}m`, isUrgent: true };
  }

  if (diffMinutes > 0 && diffMinutes <= 60) {
    return { label: `In ${diffMinutes}m`, isUrgent: false };
  }

  if (diffMinutes > 60) {
    const h = Math.floor(diffMinutes / 60);
    const m = diffMinutes % 60;
    return { label: m > 0 ? `In ${h}h ${m}m` : `In ${h}h`, isUrgent: false };
  }

  return { label: 'Upcoming', isUrgent: false };
}

/**
 * Pulsing Beacon Dot for live/imminent doses.
 */
function PulsingBeaconDot({ color }: { color: string }) {
  const scale = useSharedValue(1);
  const opacity = useSharedValue(0.7);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.8, { duration: 1100, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 1100, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
    opacity.value = withRepeat(
      withSequence(
        withTiming(0, { duration: 1100, easing: Easing.out(Easing.ease) }),
        withTiming(0.75, { duration: 1100, easing: Easing.in(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [scale, opacity]);

  const animatedHalo = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  return (
    <View style={{ width: 10, height: 10, alignItems: 'center', justifyContent: 'center' }}>
      <Animated.View
        style={[
          {
            position: 'absolute',
            width: 10,
            height: 10,
            borderRadius: 5,
            backgroundColor: color,
          },
          animatedHalo,
        ]}
      />
      <View
        style={{
          width: 6,
          height: 6,
          borderRadius: 3,
          backgroundColor: color,
        }}
      />
    </View>
  );
}

/**
 * Action Check Icon for the Take Button.
 */
export function ActionCheckIcon({ color = '#FFFFFF' }: { color?: string; size?: number }) {
  return (
    <View
      style={{
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: color === '#FFFFFF' ? 'rgba(255, 255, 255, 0.22)' : `${color}18`,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Check size={14} color={color} strokeWidth={3} />
    </View>
  );
}

export interface NextDoseCardProps {
  /** The earliest actionable dose of the day, or null if all taken/none scheduled. */
  dose: IntakeQueueItem | null;
  /** Total doses scheduled today to distinguish empty from all-completed state. */
  totalScheduledToday?: number;
  /** Handler invoked when user marks dose as taken. */
  onMarkTaken?: (scheduleId: number) => void;
  /** Optional handler when card itself is pressed. */
  onPressCard?: (dose: IntakeQueueItem) => void;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

/**
 * Hero Next Dose Card:
 * State-of-the-art glassmorphism cockpit with dynamic dosage form icon logos
 * (Tablet, Capsule, Syrup, Injection, Drops), live time urgency indicator,
 * context badges (meal timing, quantity, low stock), and glowing action.
 */
export function NextDoseCard({
  dose,
  totalScheduledToday = 0,
  onMarkTaken,
  onPressCard: _onPressCard,
  style,
  testID,
}: NextDoseCardProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const { t } = useTranslation();

  // Floating breathing animation for the 3D medallion
  const floatY = useSharedValue(0);
  useEffect(() => {
    floatY.value = withRepeat(
      withSequence(
        withTiming(-4, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1800, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [floatY]);

  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: floatY.value }],
  }));

  // Resolve form and aesthetic metadata
  const resolvedForm = useMemo(
    () => (dose ? resolveDosageForm(dose.medicationForm, dose.dosageLabel, dose.medicationName) : 'capsule'),
    [dose],
  );

  const formMeta = FORM_META[resolvedForm];

  // Dynamic urgency badge calculation
  const dynamicUrgency = useMemo(() => {
    if (!dose) return null;
    return formatDynamicTimeBadge(dose.timeUtc, dose.status);
  }, [dose]);

  // Card glow dynamics
  const isPending = dose?.status === 'PENDING';
  const isMissed = dose?.status === 'MISSED';
  const hasCardGlow = isPending || isMissed;
  const glowColor = isMissed ? '#EF4444' : formMeta.glowColor;

  if (!dose) {
    // Empty state: All Completed or Nothing Scheduled
    const allDone = totalScheduledToday > 0;
    return (
      <GlassCard
        testID={testID}
        hasGlow={allDone}
        glowColor="#10B981"
        className="gap-4 rounded-[28px] p-6"
        style={style}
      >
        <View className="flex-row items-center gap-2">
          <Clock color={theme.colors.inkSecondary} size={15} strokeWidth={2} />
          <Text
            className="text-caption font-semibold uppercase tracking-wider"
            style={{ color: theme.colors.inkSecondary }}
          >
            {t('home.nextDose')}
          </Text>
        </View>

        <View className="flex-row items-center gap-4 py-2">
          <View
            style={{
              width: 52,
              height: 52,
              borderRadius: 26,
              backgroundColor: allDone
                ? isDark
                  ? 'rgba(16, 185, 129, 0.20)'
                  : 'rgba(16, 185, 129, 0.12)'
                : isDark
                  ? 'rgba(255, 255, 255, 0.08)'
                  : 'rgba(57, 88, 134, 0.08)',
              alignItems: 'center',
              justifyContent: 'center',
              borderWidth: 1,
              borderColor: allDone
                ? isDark
                  ? 'rgba(16, 185, 129, 0.35)'
                  : 'rgba(16, 185, 129, 0.25)'
                : 'transparent',
            }}
          >
            {allDone ? (
              <Check size={26} color="#10B981" strokeWidth={3} />
            ) : (
              <Sparkles size={24} color={theme.colors.inkSecondary} strokeWidth={2} />
            )}
          </View>
          <View className="flex-1">
            <Text
              className="text-title-sm font-bold"
              style={{ color: theme.colors.ink }}
            >
              {allDone ? t('home.progressAllDone') : t('home.noDoseScheduled')}
            </Text>
            <Text
              className="mt-1 text-body-sm"
              style={{ color: theme.colors.inkSecondary }}
            >
              {allDone ? t('home.allDosesTaken') : t('home.progressEmpty')}
            </Text>
          </View>
        </View>
      </GlassCard>
    );
  }

  const statusKey = STATUS_TO_KEY[dose.status];
  const urgencyBadgeColor = isMissed
    ? theme.status.missed.base
    : isPending
      ? formMeta.accent
      : theme.colors.inkSecondary;

  const isLowStock = dose.stockRemaining > 0 && dose.stockRemaining <= 5;
  const isOutOfStock = dose.stockRemaining <= 0;

  return (
    <GlassCard
      testID={testID}
      hasGlow={hasCardGlow}
      glowColor={glowColor}
      className="gap-5 rounded-[28px] p-6"
      style={style}
    >
      {/* ── Top Header Strip: Category, Dynamic Urgency Pill, Status Pill ── */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <Clock color={theme.colors.inkSecondary} size={14} strokeWidth={2.2} />
          <Text
            className="text-caption font-semibold uppercase tracking-wider"
            style={{ color: theme.colors.inkSecondary }}
          >
            {t('home.nextDose')}
          </Text>

          {/* Dynamic Urgency / Live Countdown Tag */}
          {dynamicUrgency ? (
            <View
              className="flex-row items-center gap-1.5 rounded-full px-2.5 py-0.5"
              style={{
                backgroundColor: isMissed
                  ? isDark
                    ? 'rgba(239, 68, 68, 0.20)'
                    : 'rgba(239, 68, 68, 0.10)'
                  : isPending
                    ? isDark
                      ? `${formMeta.accent}33`
                      : `${formMeta.accent}18`
                    : isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(57, 88, 134, 0.06)',
                borderWidth: 1,
                borderColor: isMissed
                  ? isDark
                    ? 'rgba(239, 68, 68, 0.35)'
                    : 'rgba(239, 68, 68, 0.20)'
                  : isPending
                    ? `${formMeta.accent}40`
                    : 'transparent',
              }}
            >
              {dynamicUrgency.isUrgent ? (
                <PulsingBeaconDot color={urgencyBadgeColor} />
              ) : null}
              <Text
                style={{
                  color: urgencyBadgeColor,
                  fontSize: 11,
                  fontWeight: '700',
                  letterSpacing: 0.1,
                }}
              >
                {dynamicUrgency.label}
              </Text>
            </View>
          ) : null}
        </View>

        <StatusPill status={statusKey} />
      </View>

      {/* ── Hero Cockpit: Time, Med Info, Badges + 3D Logo Vessel ── */}
      <View className="flex-row items-center justify-between gap-4">
        {/* Left Column: Bold Time & Information */}
        <View className="flex-1">
          <Text
            className="text-display-lg font-black"
            numberOfLines={1}
            style={{
              color: theme.colors.ink,
              fontSize: 36,
              letterSpacing: -1,
            }}
          >
            {formatTimeLabel(dose.timeUtc)}
          </Text>

          <Text
            className="mt-1 text-title-md font-bold"
            numberOfLines={1}
            style={{ color: theme.colors.ink }}
          >
            {dose.medicationName}
          </Text>

          {/* Context Badges: Dosage, Meal Relation, Stock Warning */}
          <View className="mt-2.5 flex-row flex-wrap items-center gap-1.5">
            {/* Dose quantity badge */}
            <View
              className="rounded-lg px-2 py-0.5"
              style={{
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(57, 88, 134, 0.08)',
              }}
            >
              <Text
                style={{
                  color: theme.colors.ink,
                  fontSize: 12,
                  fontWeight: '600',
                }}
              >
                {dose.dosageLabel}
              </Text>
            </View>

            {/* Meal relation chip */}
            {dose.mealRelation ? (
              <View
                className="flex-row items-center gap-1 rounded-lg px-2 py-0.5"
                style={{
                  backgroundColor: isDark ? 'rgba(255, 255, 255, 0.09)' : 'rgba(57, 88, 134, 0.08)',
                }}
              >
                <Utensils size={10} color={theme.colors.inkSecondary} />
                <Text
                  style={{
                    color: theme.colors.inkSecondary,
                    fontSize: 12,
                    fontWeight: '500',
                  }}
                >
                  {t(`rhythm.mealRelation.${dose.mealRelation}` as never)}
                </Text>
              </View>
            ) : null}

            {/* Low or out of stock alert */}
            {isOutOfStock ? (
              <View
                className="rounded-lg px-2 py-0.5"
                style={{
                  backgroundColor: isDark ? 'rgba(239, 68, 68, 0.22)' : 'rgba(239, 68, 68, 0.12)',
                }}
              >
                <Text style={{ color: theme.status.missed.base, fontSize: 11, fontWeight: '700' }}>
                  {t('medications.outOfStock')}
                </Text>
              </View>
            ) : isLowStock ? (
              <View
                className="rounded-lg px-2 py-0.5"
                style={{
                  backgroundColor: isDark ? 'rgba(245, 158, 11, 0.22)' : 'rgba(245, 158, 11, 0.12)',
                }}
              >
                <Text style={{ color: theme.status.pending.base, fontSize: 11, fontWeight: '700' }}>
                  {dose.stockRemaining} left
                </Text>
              </View>
            ) : null}
          </View>
        </View>

        {/* Right Column: 3D Form Icon Showcase Vessel */}
        <Animated.View style={[floatStyle, { alignItems: 'center', gap: 6 }]}>
          <View
            style={{
              width: 72,
              height: 72,
              borderRadius: 24,
              backgroundColor: isDark ? formMeta.auraDark : 'rgba(255, 255, 255, 0.92)',
              borderWidth: 1.5,
              borderColor: isDark ? `${formMeta.accent}50` : `${formMeta.accent}30`,
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: [
                {
                  offsetX: 0,
                  offsetY: 4,
                  blurRadius: 16,
                  color: isDark ? `${formMeta.accent}40` : `${formMeta.accent}20`,
                },
              ],
            }}
          >
            {/* Ambient aura glow behind 3D asset */}
            <View
              pointerEvents="none"
              style={{
                position: 'absolute',
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: isDark ? `${formMeta.accent}35` : `${formMeta.accent}15`,
                filter: 'blur(8px)',
              }}
            />

            {/* Authentic 3D dosage asset */}
            <Image
              source={formMeta.asset}
              style={{ width: 52, height: 52 }}
              resizeMode="contain"
              accessibilityRole="image"
              accessibilityLabel={t(formMeta.labelKey)}
            />
          </View>

          {/* Form Tag Badge */}
          <View
            className="rounded-full px-2 py-0.5"
            style={{
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(57, 88, 134, 0.07)',
            }}
          >
            <Text
              style={{
                color: formMeta.accent,
                fontSize: 10,
                fontWeight: '800',
                textTransform: 'uppercase',
                letterSpacing: 0.6,
              }}
            >
              {t(formMeta.labelKey)}
            </Text>
          </View>
        </Animated.View>
      </View>

      {/* ── Instruction Pill Callout (if present) ── */}
      {dose.instructions ? (
        <View
          className="flex-row items-center gap-2 rounded-xl px-3 py-2"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.05)' : 'rgba(57, 88, 134, 0.05)',
            borderLeftWidth: 3,
            borderLeftColor: formMeta.accent,
          }}
        >
          <Info size={14} color={formMeta.accent} strokeWidth={2.2} />
          <Text
            className="flex-1 text-caption"
            numberOfLines={2}
            style={{ color: theme.colors.inkSecondary, fontWeight: '500' }}
          >
            {dose.instructions}
          </Text>
        </View>
      ) : null}

      {/* ── Hero Action Button ── */}
      <LargeTextButton
        label={dose.status === 'MISSED' ? t('home.markAsTakenLate') : t('home.markAsTaken')}
        onPress={() => {
          triggerHaptic('notificationSuccess');
          onMarkTaken?.(dose.scheduleId);
        }}
        icon={ActionCheckIcon}
      />
    </GlassCard>
  );
}
