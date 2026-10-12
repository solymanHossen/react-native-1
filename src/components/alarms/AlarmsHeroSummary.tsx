import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Bell, Clock, Sparkles } from 'lucide-react-native';
import type { ScheduleWithMedication } from '../../db/types';
import { computeNextOccurrenceMs } from '../../alarms/alarmScheduler';
import { useTranslation } from '../../i18n';
import { useTheme } from '../../theme/useTheme';

export interface AlarmsHeroSummaryProps {
  schedules: ScheduleWithMedication[];
}

function formatNextDoseTime(timeUtc: string): string {
  const [hours, minutes] = timeUtc.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function formatRelativeDiff(diffMs: number): string {
  if (diffMs <= 0) return 'now';
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
 * Modern Hero Alarm Summary Card.
 *
 * Sits at the top of the Scheduled Alarms section:
 * - Computes and spotlights the next immediate upcoming dose across all active schedules.
 * - Displays active/paused schedule count at a glance.
 * - Deep frosted glassmorphic background with vibrant medical accent highlights.
 */
export function AlarmsHeroSummary({ schedules }: AlarmsHeroSummaryProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const activeSchedules = useMemo(
    () => schedules.filter((s) => s.is_active),
    [schedules],
  );

  const nextAlarmInfo = useMemo(() => {
    if (activeSchedules.length === 0) return null;
    const now = Date.now();
    let earliestMs = Infinity;
    let earliestSchedule: ScheduleWithMedication | null = null;

    for (const schedule of activeSchedules) {
      const nextMs = computeNextOccurrenceMs(schedule.time_utc, schedule.days_of_week_mask, now);
      if (nextMs < earliestMs) {
        earliestMs = nextMs;
        earliestSchedule = schedule;
      }
    }

    if (!earliestSchedule || earliestMs === Infinity) return null;

    return {
      schedule: earliestSchedule,
      nextMs: earliestMs,
      relative: formatRelativeDiff(earliestMs - now),
      timeLabel: formatNextDoseTime(earliestSchedule.time_utc),
    };
  }, [activeSchedules]);

  if (schedules.length === 0) {
    return null;
  }

  const isDark = theme.mode === 'dark';

  return (
    <View
      className="relative overflow-hidden rounded-3xl border p-5 shadow-lg"
      style={{
        backgroundColor: isDark ? 'rgba(31, 41, 55, 0.85)' : theme.colors.elevated,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.1)' : theme.colors.hairline,
        shadowColor: theme.action.base,
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: isDark ? 0.35 : 0.08,
        shadowRadius: 20,
        elevation: 6,
      }}
    >
      {/* Specular rim frosted highlight */}
      {isDark ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 20,
            right: 20,
            height: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.14)',
          }}
        />
      ) : null}

      {/* Top Banner Row: Section Tag & Active Count */}
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View
            className="items-center justify-center rounded-xl"
            style={{ width: 32, height: 32, backgroundColor: `${theme.action.base}18` }}
          >
            <Bell color={theme.action.base} size={16} strokeWidth={2.4} />
          </View>
          <Text className="text-caption uppercase tracking-wider font-bold" style={{ color: theme.colors.inkSecondary }}>
            {t('alarms.scheduledAlarms')}
          </Text>
        </View>

        {/* Counter Badge */}
        <View
          className="rounded-full px-3 py-1 border"
          style={{
            backgroundColor: activeSchedules.length > 0 ? `${theme.action.base}18` : (isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline),
            borderColor: activeSchedules.length > 0 ? `${theme.action.base}35` : 'transparent',
          }}
        >
          <Text
            style={{
              color: activeSchedules.length > 0 ? theme.action.base : theme.colors.inkMuted,
              fontSize: 12,
              fontWeight: '700',
            }}
          >
            {activeSchedules.length > 0
              ? t('alarms.activeCount', { count: activeSchedules.length })
              : t('alarms.allPaused')}
          </Text>
        </View>
      </View>

      {/* Next Upcoming Alarm Spotlight */}
      {nextAlarmInfo ? (
        <View className="mt-4 rounded-2xl border p-4" style={{ backgroundColor: isDark ? 'rgba(0, 0, 0, 0.25)' : theme.colors.surface, borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : theme.colors.hairline }}>
          <View className="flex-row items-center justify-between mb-1.5">
            <View className="flex-row items-center gap-1.5">
              <Sparkles size={14} color={theme.action.base} strokeWidth={2.4} />
              <Text className="text-caption font-semibold" style={{ color: theme.action.base }}>
                {t('alarms.nextAlarm')}
              </Text>
            </View>
            <View className="flex-row items-center gap-1">
              <Clock size={12} color={theme.colors.inkSecondary} />
              <Text className="text-caption font-bold" style={{ color: theme.colors.inkSecondary }}>
                {nextAlarmInfo.relative}
              </Text>
            </View>
          </View>

          <View className="flex-row items-baseline justify-between">
            <Text className="text-title-md font-bold" numberOfLines={1} style={{ color: theme.colors.ink, flex: 1 }}>
              {nextAlarmInfo.schedule.medicationName}
            </Text>
            <Text className="text-body-lg font-extrabold ml-3" style={{ color: theme.action.base }}>
              {nextAlarmInfo.timeLabel}
            </Text>
          </View>

          <Text className="text-caption mt-0.5" style={{ color: theme.colors.inkMuted }}>
            {nextAlarmInfo.schedule.dose_quantity} {nextAlarmInfo.schedule.medicationForm} · {t(`alarms.mealRelation.${nextAlarmInfo.schedule.meal_relation}` as never)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}
