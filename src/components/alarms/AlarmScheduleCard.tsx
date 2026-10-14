import { ComponentType, useMemo } from 'react';
import { Alert, Pressable, Switch, Text, View } from 'react-native';
import { Camera, Clock, Droplet, Moon, Nfc, Package, Pill, Sun, Sunrise, Trash2, Utensils } from 'lucide-react-native';
import type { Medication, ScheduleWithMedication } from '../../db/types';
import { computeNextOccurrenceMs } from '../../alarms/alarmScheduler';
import { useTranslation, type TranslationKey } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

export interface AlarmScheduleCardProps {
  schedule: ScheduleWithMedication;
  onToggle: (schedule: ScheduleWithMedication, nextActive: boolean) => void;
  onDelete: (schedule: ScheduleWithMedication) => void;
  /** `depth` is 0 (breakfast) to 3 (bedtime), or -1 for fasting */
  timeNodeStyle?: {
    icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
    depth: number;
  };
}

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
 * Modern Medication Alarm Card.
 *
 * Implements the exact reference design:
 * - Pure white container with soft border & subtle shadow
 * - Top Row:
 *   - Squircle time-of-day badge (Sunrise for Morning, Sun for Afternoon, Moon for Evening)
 *   - Bold digital time with AM/PM
 *   - Neutral pill badge with Clock icon + "in 18h" countdown on the same baseline
 *   - "Morning · Daily" subtitle
 *   - Modern Switch toggle on the far right
 * - Hairline horizontal divider
 * - Medication name with soft pink/red Trash2 delete button on the right
 * - Bottom Tags:
 *   - Row 1: "[ 💊 1 tablet ]" and "[ 🍴 With food ]"
 *   - Row 2: "[ 📷 Camera confirm ]" / "[ 📶 NFC confirm ]" in warm amber
 */
export function AlarmScheduleCard({
  schedule,
  onToggle,
  onDelete,
  timeNodeStyle,
}: AlarmScheduleCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.mode === 'dark';
  const isActive = schedule.is_active;

  const { displayTime, period } = useMemo(() => formatTimeParts(schedule.time_utc), [schedule.time_utc]);
  const FormIcon = useMemo(() => medicationFormIcon(schedule.medicationForm), [schedule.medicationForm]);

  // Resolve time-of-day style matching the reference design
  const nodeConfig = useMemo(() => {
    switch (schedule.time_node) {
      case 'BREAKFAST':
        return {
          icon: Sunrise,
          badgeBg: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EEF4FB',
          iconColor: isDark ? '#60A5FA' : '#395886',
          label: t('alarms.timeMorning'),
        };
      case 'LUNCH':
        return {
          icon: Sun,
          badgeBg: theme.alarms.sun.badge,
          iconColor: theme.alarms.sun.icon,
          label: t('alarms.timeAfternoon'),
        };
      case 'DINNER':
        return {
          icon: Moon,
          badgeBg: theme.alarms.moon.badge,
          iconColor: theme.alarms.moon.icon,
          label: t('alarms.timeEvening'),
        };
      case 'BEDTIME':
        return {
          icon: Moon,
          badgeBg: theme.alarms.moon.badge,
          iconColor: theme.alarms.moon.icon,
          label: t('alarms.timeBedtime'),
        };
      case 'FASTING':
        return {
          icon: Clock,
          badgeBg: theme.statusTint('fasting'),
          iconColor: theme.statusText('fasting'),
          label: t('status.fasting'),
        };
      default:
        return {
          icon: Sun,
          badgeBg: theme.alarms.sun.badge,
          iconColor: theme.alarms.sun.icon,
          label: t('alarms.timeMorning'),
        };
    }
  }, [isDark, schedule.time_node, t, theme]);

  const NodeIcon = timeNodeStyle?.icon ?? nodeConfig.icon;
  const badgeBg = nodeConfig.badgeBg;
  const badgeIconColor = nodeConfig.iconColor;
  const nodeLabel = nodeConfig.label;

  const timeRemaining = useMemo(() => {
    if (!schedule.is_active) return null;
    return formatTimeRemaining(schedule.time_utc, schedule.days_of_week_mask);
  }, [schedule.days_of_week_mask, schedule.is_active, schedule.time_utc]);

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

  return (
    <View
      className="rounded-[24px] border p-5 shadow-sm"
      style={{
        marginBottom: 16,
        backgroundColor: isActive
          ? isDark
            ? 'rgba(31, 41, 55, 0.75)'
            : '#FFFFFF'
          : isDark
            ? 'rgba(20, 26, 36, 0.55)'
            : '#F8FAFC',
        borderColor: isActive
          ? isDark
            ? 'rgba(255, 255, 255, 0.08)'
            : '#F1F5F9'
          : isDark
            ? 'rgba(255, 255, 255, 0.04)'
            : theme.colors.hairline,
        opacity: isActive ? 1 : 0.65,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.25 : 0.03,
        shadowRadius: 8,
        elevation: 1,
      }}
    >
      {/* Top Header: Time, AM/PM, in Xh badge, Morning · Daily, and Switch */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3.5 flex-1 mr-2">
          {/* Time-of-day colored icon badge */}
          <View
            className="items-center justify-center rounded-2xl overflow-hidden"
            style={{
              width: 46,
              height: 46,
              backgroundColor: isActive ? badgeBg : (isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline),
            }}
          >
            <NodeIcon color={isActive ? badgeIconColor : theme.colors.inkMuted} size={24} strokeWidth={2.2} />
          </View>

          {/* Clock Display + Countdown */}
          <View className="flex-1">
            <View className="flex-row items-baseline">
              <Text
                className="text-[22px] font-extrabold tracking-tight"
                style={{
                  color: isActive ? theme.colors.ink : theme.colors.inkMuted,
                }}
              >
                {displayTime}
              </Text>
              <Text
                className="text-[15px] font-bold ml-1.5"
                style={{
                  color: isActive ? theme.colors.ink : theme.colors.inkMuted,
                }}
              >
                {period}
              </Text>

              {/* Time Remaining / Countdown badge or OFF badge */}
              {isActive && timeRemaining ? (
                <View
                  className="ml-2.5 flex-row items-center gap-1 rounded-full px-2.5 py-0.5"
                  style={{
                    backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                  }}
                >
                  <Clock size={11} color={isDark ? '#94A3B8' : '#64748B'} strokeWidth={2.4} />
                  <Text
                    style={{
                      color: isDark ? '#94A3B8' : '#475569',
                      fontSize: 11.5,
                      fontWeight: '700',
                    }}
                  >
                    {t('alarms.nextAlarmIn', { time: timeRemaining })}
                  </Text>
                </View>
              ) : !isActive ? (
                <View
                  className="ml-2.5 rounded-full px-2.5 py-0.5"
                  style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline }}
                >
                  <Text style={{ color: theme.colors.inkMuted, fontSize: 11, fontWeight: '700' }}>
                    {t('alarms.off')}
                  </Text>
                </View>
              ) : null}
            </View>

            <Text className="text-[13px] font-medium mt-0.5" style={{ color: theme.colors.inkSecondary }}>
              {nodeLabel} · {t('alarms.daily')}
            </Text>
          </View>
        </View>

        {/* Master On/Off Switch */}
        <Switch
          value={isActive}
          onValueChange={(next) => onToggle(schedule, next)}
          trackColor={{
            false: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
            true: isDark ? '#3B82F6' : '#395886',
          }}
          thumbColor="#FFFFFF"
          accessibilityLabel={
            isActive
              ? t('alarms.turnOffAccessibility', { name: schedule.medicationName })
              : t('alarms.turnOnAccessibility', { name: schedule.medicationName })
          }
        />
      </View>

      {/* Hairline Divider */}
      <View
        className="my-3.5 border-t"
        style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9' }}
      />

      {/* Medication Name & Delete Action Row */}
      <View className="flex-row items-center justify-between">
        <View className="flex-1 mr-2">
          {schedule.title ? (
            <Text
              className="text-[12px] font-bold tracking-wider uppercase mb-0.5"
              numberOfLines={1}
              style={{ color: theme.action.base }}
            >
              {schedule.title}
            </Text>
          ) : null}
          <Text
            className="text-[17px] font-bold tracking-tight"
            numberOfLines={1}
            style={{ color: theme.colors.ink }}
          >
            {schedule.medicationName}
          </Text>
        </View>

        {/* Delete Action Button */}
        <Pressable
          onPress={handleDeletePress}
          accessibilityRole="button"
          accessibilityLabel={t('alarms.deleteAlarm')}
          className="items-center justify-center rounded-xl p-2"
          style={{
            backgroundColor: isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2',
          }}
        >
          <Trash2 color={isDark ? '#F87171' : '#EF4444'} size={15} strokeWidth={2.0} />
        </Pressable>
      </View>

      {/* Bottom Info Pills: Row 1 (Dose + Meal Guidance) */}
      <View className="mt-2.5 flex-row flex-wrap items-center gap-2">
        {/* Dose & Form chip */}
        <View
          className="flex-row items-center gap-1.5 rounded-full px-3 py-1 border"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
          }}
        >
          <FormIcon color={isDark ? '#94A3B8' : '#475569'} size={13} strokeWidth={2.2} />
          <Text className="text-[12.5px] font-semibold" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>
            {schedule.dose_quantity} {schedule.medicationForm}
          </Text>
        </View>

        {/* Meal guidance chip with Utensils icon */}
        <View
          className="flex-row items-center gap-1.5 rounded-full px-3 py-1 border"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
          }}
        >
          <Utensils color={isDark ? '#94A3B8' : '#475569'} size={13} strokeWidth={2.2} />
          <Text className="text-[12.5px] font-semibold" style={{ color: isDark ? '#CBD5E1' : '#334155' }}>
            {t(`alarms.mealRelation.${schedule.meal_relation}` as TranslationKey)}
          </Text>
        </View>
      </View>

      {/* Row 2: Verification Tag (Camera / NFC Confirm) */}
      <View
        className="mt-2 flex-row items-center gap-1.5 rounded-full px-3 py-1 self-start"
        style={{
          backgroundColor: isDark ? 'rgba(245, 158, 11, 0.16)' : '#FEF3C7',
        }}
      >
        {schedule.nfcTagUid ? (
          <Nfc color={isDark ? '#FBBF24' : '#B45309'} size={13} strokeWidth={2.2} />
        ) : (
          <Camera color={isDark ? '#FBBF24' : '#B45309'} size={13} strokeWidth={2.2} />
        )}
        <Text
          className="text-[12px] font-semibold"
          numberOfLines={1}
          style={{ color: isDark ? '#FBBF24' : '#B45309' }}
        >
          {schedule.nfcTagUid ? t('alarms.nfcRegistered') : t('alarms.nfcFallback')}
        </Text>
      </View>
    </View>
  );
}
