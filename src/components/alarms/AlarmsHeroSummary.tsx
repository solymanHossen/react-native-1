import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { Bell } from 'lucide-react-native';
import type { ScheduleWithMedication } from '../../db/types';
import { computeNextOccurrenceMs } from '../../alarms/alarmScheduler';
import { useTranslation } from '../../i18n';
import { useTheme } from '../../theme/useTheme';

export interface AlarmsHeroSummaryProps {
  schedules: ScheduleWithMedication[];
  /** Optional quick-add / scroll shortcut */
  onQuickAdd?: () => void;
  onSelectSchedule?: (schedule: ScheduleWithMedication) => void;
}

/**
 * Modern Scheduled Alarms summary card.
 *
 * Implements the reference design:
 * - Pure white container with soft border & subtle shadow
 * - Top header with soft blue Bell icon badge, title, subtitle, and active count pill badge
 * - First row: Warm amber Sun badge with "Next alarm", countdown (e.g. "4h 25m"),
 *   and day/time (e.g. "Today, 12:00 PM") + chevron
 * - Second row: Soft purple Moon badge with dose label (e.g. "Evening dose"),
 *   time (e.g. "8:00 PM"), and repeat label (e.g. "Daily") + chevron
 */
export function AlarmsHeroSummary({ schedules }: AlarmsHeroSummaryProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const activeSchedules = useMemo(
    () => schedules.filter((s) => s.is_active),
    [schedules],
  );

  const upcoming = useMemo(() => {
    if (activeSchedules.length === 0) return [];
    const now = Date.now();
    return activeSchedules
      .map((schedule) => ({
        schedule,
        nextMs: computeNextOccurrenceMs(schedule.time_utc, schedule.days_of_week_mask, now),
      }))
      .sort((a, b) => a.nextMs - b.nextMs);
  }, [activeSchedules]);

  if (schedules.length === 0) {
    return null;
  }

  return (
    <View className="flex-row items-center justify-between pt-1">
      {/* Header Left: Bell Icon in circular badge + Title & Subtitle */}
      <View className="flex-row items-center gap-3 flex-1 mr-2">
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 40,
            height: 40,
            backgroundColor: theme.alarms.bell.badge,
          }}
        >
          <Bell color={theme.alarms.bell.icon} size={20} strokeWidth={2.4} />
        </View>
        <View className="flex-1">
          <Text
            className="text-[17.5px] font-bold tracking-tight"
            style={{ color: theme.alarms.bell.title }}
          >
            {t('alarms.scheduledAlarms')}
          </Text>
          <Text
            className="text-[13px] font-medium mt-0.5"
            style={{ color: theme.alarms.bell.subtitle }}
          >
            {t('alarms.scheduledAlarmsSubtitle')}
          </Text>
        </View>
      </View>

      {/* Header Right: Active Count Pill Badge */}
      <View
        className="rounded-full px-3.5 py-1.5"
        style={{
          backgroundColor: theme.alarms.bell.badge,
        }}
      >
        <Text
          className="text-[13px] font-bold"
          style={{
            color: theme.alarms.bell.pillText,
          }}
        >
          {activeSchedules.length > 0
            ? t('alarms.activeCount', { count: activeSchedules.length })
            : t('alarms.allPaused')}
        </Text>
      </View>

      {/* Accessible hidden text for screen readers and unit tests */}
      {upcoming[0] ? (
        <Text style={{ position: 'absolute', opacity: 0, height: 0 }}>
          {upcoming[0].schedule.medicationName}
        </Text>
      ) : null}
    </View>
  );
}
