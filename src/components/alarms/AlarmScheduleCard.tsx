import { ComponentType, useMemo } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { Camera, Clock, Droplet, Nfc, Package, Pill, Trash2 } from 'lucide-react-native';
import type { Medication, ScheduleWithMedication } from '../../db/types';
import { computeNextOccurrenceMs } from '../../alarms/alarmScheduler';
import { useTranslation, type TranslationKey } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

export interface AlarmScheduleCardProps {
  schedule: ScheduleWithMedication;
  onToggle: (schedule: ScheduleWithMedication, nextActive: boolean) => void;
  onDelete: (schedule: ScheduleWithMedication) => void;
  /** `depth` is 0 (breakfast) to 3 (bedtime), or -1 for fasting (not a time of day — see badge color computation below). */
  timeNodeStyle: {
    icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    depth: number;
  };
}

/** Alpha strength per day/night depth (0–2); depth 3 (bedtime) renders as a solid fill instead — see `badgeColors` below. Deepens from breakfast to bedtime so the four badges still read as a progression through the day, the quality the old hardcoded pomegranate-red badges had, while staying within the app's single blue brand hue (`theme.action.base`) instead of an unrelated color family that didn't adapt to light/dark mode. */
const DEPTH_TINT_ALPHA = ['14', '29', '4D'];

/**
 * A static lookup, not a derived string (`` `alarms.time${timeNode...}` ``):
 * the `time_node` enum (BREAKFAST/LUNCH/DINNER/BEDTIME/FASTING) and the
 * existing translation keys (timeMorning/timeAfternoon/timeEvening/
 * timeBedtime) don't actually share a naming scheme — the derived-string
 * approach silently produced `alarms.timeBreakfast`, `alarms.timeLunch`,
 * `alarms.timeDinner`, none of which exist, so the raw untranslated key
 * string rendered straight into the card for 3 of the 5 time nodes. FASTING
 * has no `alarms.*` label of its own; it reuses `status.fasting` (the same
 * "Fasting" text already shown for the Fasting status pill elsewhere).
 */
const TIME_NODE_LABEL_KEY: Record<ScheduleWithMedication['time_node'], TranslationKey> = {
  BREAKFAST: 'alarms.timeMorning',
  LUNCH: 'alarms.timeAfternoon',
  DINNER: 'alarms.timeEvening',
  BEDTIME: 'alarms.timeBedtime',
  FASTING: 'status.fasting',
};

function medicationFormIcon(form: Medication['form']) {
  return form === 'tablet' || form === 'capsule' ? Pill : form === 'syrup' || form === 'drop' ? Droplet : Package;
}

function formatTimeParts(timeUtc: string): { displayTime: string; period: string } {
  const [hours, minutes] = timeUtc.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return {
    displayTime: `${displayHour}:${minutes.toString().padStart(2, '0')}`,
    period,
  };
}

function formatTimeRemaining(timeUtc: string, daysOfWeekMask: number): string | null {
  const nextMs = computeNextOccurrenceMs(timeUtc, daysOfWeekMask);
  const diffMs = nextMs - Date.now();
  if (diffMs <= 0) return null;
  const totalMinutes = Math.round(diffMs / (60 * 1000));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) {
    return `${mins}m`;
  }
  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

/**
 * Modern world-class Medication Alarm Card.
 *
 * Designed with clinical clarity, digital clock hierarchy, rich glassmorphism,
 * and high-contrast accessibility:
 * - Prominent display clock with decoupled AM/PM badge and time-of-day colored icon.
 * - Dynamic countdown indicator ("In 2h 15m") when active.
 * - Medication name, strength, dosage form icon, and meal relationship tags.
 * - Verification method badge (NFC Tag vs Vision Camera).
 * - Tactile on/off toggle and safe alarm deletion with haptic feedback.
 */
export function AlarmScheduleCard({
  schedule,
  onToggle,
  onDelete,
  timeNodeStyle,
}: AlarmScheduleCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const { displayTime, period } = useMemo(() => formatTimeParts(schedule.time_utc), [schedule.time_utc]);
  const FormIcon = useMemo(() => medicationFormIcon(schedule.medicationForm), [schedule.medicationForm]);
  const NodeIcon = timeNodeStyle.icon;

  // Fasting isn't a time of day, so it keeps its own `fasting` status color
  // (the same cyan used for the Fasting pill elsewhere, e.g. Home's Blood
  // Sugar card) instead of a slot in the breakfast→bedtime depth
  // progression. Every real time slot derives its badge from the single
  // brand blue at increasing strength as the day goes on, solid by bedtime.
  const isFasting = timeNodeStyle.depth < 0;
  const badgeBase = isFasting ? (theme.status.fasting.baseDark ?? theme.status.fasting.base) : theme.action.base;
  const badgeBg = isFasting
    ? theme.statusTint('fasting')
    : timeNodeStyle.depth >= 3
      ? theme.action.base
      : `${theme.action.base}${DEPTH_TINT_ALPHA[timeNodeStyle.depth] ?? DEPTH_TINT_ALPHA[0]}`;
  const badgeIconColor = isFasting ? theme.statusText('fasting') : timeNodeStyle.depth >= 3 ? theme.action.ink : theme.action.base;

  const timeRemaining = useMemo(() => {
    if (!schedule.is_active) return null;
    return formatTimeRemaining(schedule.time_utc, schedule.days_of_week_mask);
  }, [schedule.days_of_week_mask, schedule.is_active, schedule.time_utc]);

  const confirmTint = schedule.nfcTagUid ? theme.statusTint('taken') : theme.statusTint('pending');
  const confirmText = schedule.nfcTagUid ? theme.statusText('taken') : theme.statusText('pending');

  const handleDeletePress = () => {
    triggerHaptic('impactLight');
    Alert.alert(
      t('alarms.deleteAlarmConfirmTitle'),
      t('alarms.deleteAlarmConfirm', {
        name: schedule.medicationName,
        time: `${displayTime} ${period}`,
      }),
      [
        { text: t('alarms.cancel'), style: 'cancel' },
        {
          text: t('alarms.delete'),
          style: 'destructive',
          onPress: () => {
            triggerHaptic('notificationWarning');
            onDelete(schedule);
          },
        },
      ],
    );
  };

  const isDark = theme.mode === 'dark';
  const isActive = schedule.is_active;

  return (
    <View
      className="relative overflow-hidden rounded-3xl border p-5"
      style={{
        marginBottom: 16,
        backgroundColor: isActive
          ? isDark
            ? 'rgba(31, 41, 55, 0.75)'
            : theme.colors.elevated
          : isDark
            ? 'rgba(20, 26, 36, 0.55)'
            : '#F8FAFC',
        borderColor: isActive
          ? isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : theme.colors.hairline
          : isDark
            ? 'rgba(255, 255, 255, 0.04)'
            : theme.colors.hairline,
        opacity: isActive ? 1 : 0.65,
        shadowColor: isActive ? '#000000' : 'transparent',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: isActive ? (isDark ? 0.35 : 0.08) : 0,
        shadowRadius: 16,
        elevation: isActive ? 5 : 1,
      }}
    >
      {/* Frosted specular top highlight on active cards in dark mode */}
      {isDark && isActive ? (
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

      {/* Top Header: Big Digital Clock, Icon & Active Switch */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          {/* Time-of-day colored icon */}
          <View
            className="items-center justify-center rounded-2xl"
            style={{
              width: 46,
              height: 46,
              backgroundColor: isActive ? badgeBg : (isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline),
              shadowColor: isActive ? badgeBase : 'transparent',
              shadowOffset: { width: 0, height: 3 },
              shadowOpacity: isActive ? 0.4 : 0,
              shadowRadius: 8,
              elevation: isActive ? 4 : 0,
            }}
          >
            <NodeIcon color={isActive ? badgeIconColor : theme.colors.inkMuted} size={24} strokeWidth={2.2} />
          </View>

          {/* Clock Display */}
          <View>
            <View className="flex-row items-baseline gap-1.5">
              <Text
                className="text-3xl font-extrabold tracking-tight"
                style={{
                  color: isActive ? theme.colors.ink : theme.colors.inkMuted,
                  letterSpacing: -0.5,
                }}
              >
                {displayTime}
              </Text>
              <Text
                className="text-body font-bold"
                style={{
                  color: isActive ? theme.action.base : theme.colors.inkMuted,
                }}
              >
                {period}
              </Text>

              {/* Time Remaining / Countdown badge or OFF badge */}
              {isActive && timeRemaining ? (
                <View
                  className="ml-1.5 flex-row items-center gap-1 rounded-full px-2 py-0.5"
                  style={{
                    backgroundColor: `${theme.action.base}18`,
                    borderWidth: 1,
                    borderColor: `${theme.action.base}33`,
                  }}
                >
                  <Clock size={10} color={theme.action.base} strokeWidth={2.4} />
                  <Text
                    style={{
                      color: theme.action.base,
                      fontSize: 10,
                      fontWeight: '700',
                    }}
                  >
                    {t('alarms.nextAlarmIn', { time: timeRemaining })}
                  </Text>
                </View>
              ) : !isActive ? (
                <View
                  className="ml-1.5 rounded-full px-2 py-0.5"
                  style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline }}
                >
                  <Text style={{ color: theme.colors.inkMuted, fontSize: 10, fontWeight: '700' }}>
                    {t('alarms.off')}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text className="text-caption font-medium" style={{ color: theme.colors.inkSecondary }}>
              {t(TIME_NODE_LABEL_KEY[schedule.time_node])} · {t('alarms.daily')}
            </Text>
          </View>
        </View>

        {/* Master On/Off Switch */}
        <Switch
          value={isActive}
          onValueChange={(next) => onToggle(schedule, next)}
          trackColor={{
            false: isDark ? 'rgba(255, 255, 255, 0.12)' : theme.colors.hairline,
            true: theme.action.base,
          }}
          thumbColor="#FFFFFF"
          accessibilityLabel={
            isActive
              ? t('alarms.turnOffAccessibility', { name: schedule.medicationName })
              : t('alarms.turnOnAccessibility', { name: schedule.medicationName })
          }
        />
      </View>

      {/* Medication Regimen Info Section */}
      <View className="mt-4 border-t pt-3" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : theme.colors.hairline }}>
        {schedule.title ? (
          <Text
            className="text-caption font-bold tracking-wider uppercase mb-0.5"
            numberOfLines={1}
            style={{ color: theme.action.base }}
          >
            {schedule.title}
          </Text>
        ) : null}

        <View className="flex-row items-center justify-between">
          <Text
            className="text-title-md font-bold"
            numberOfLines={1}
            style={{ color: theme.colors.ink, flex: 1 }}
          >
            {schedule.medicationName}
          </Text>

          {/* Delete Action Button */}
          <Pressable
            onPress={handleDeletePress}
            accessibilityRole="button"
            accessibilityLabel={t('alarms.deleteAlarm')}
            className="items-center justify-center rounded-xl p-2 ml-2"
            style={{
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.1)' : 'rgba(239, 68, 68, 0.08)',
            }}
          >
            <Trash2 color={theme.statusText('missed')} size={15} strokeWidth={2.2} />
          </Pressable>
        </View>
      </View>

      {/* Bottom Info Pills: Dosage, Meal Guidance & Verification Tag */}
      <View className="mt-3 flex-row flex-wrap items-center gap-2">
        {/* Dose & Form chip */}
        <View
          className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1 border"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : theme.colors.surface,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
          }}
        >
          <FormIcon color={theme.colors.inkSecondary} size={12} strokeWidth={2.2} />
          <Text className="text-caption font-medium" style={{ color: theme.colors.inkSecondary }}>
            {schedule.dose_quantity} {schedule.medicationForm}
          </Text>
        </View>

        {/* Meal guidance chip */}
        <View
          className="rounded-full px-2.5 py-1 border"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : theme.colors.surface,
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
          }}
        >
          <Text className="text-caption font-medium" style={{ color: theme.colors.inkSecondary }}>
            {t(`alarms.mealRelation.${schedule.meal_relation}` as TranslationKey)}
          </Text>
        </View>

        {/* Security verification tag (NFC or Camera) */}
        <View className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: confirmTint }}>
          {schedule.nfcTagUid ? (
            <Nfc color={confirmText} size={12} strokeWidth={2.5} />
          ) : (
            <Camera color={confirmText} size={12} strokeWidth={2.5} />
          )}
          <Text className="text-caption font-semibold" numberOfLines={1} style={{ color: confirmText }}>
            {schedule.nfcTagUid ? t('alarms.nfcRegistered') : t('alarms.nfcFallback')}
          </Text>
        </View>
      </View>
    </View>
  );
}
