import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Bell, ChevronRight, Moon, Sun } from 'lucide-react-native';
import type { ScheduleWithMedication, TimeNode } from '../../db/types';
import { computeNextOccurrenceMs } from '../../alarms/alarmScheduler';
import { useTranslation, type TranslationKey } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

export interface AlarmsHeroSummaryProps {
  schedules: ScheduleWithMedication[];
  /** Optional quick-add / scroll shortcut */
  onQuickAdd?: () => void;
  onSelectSchedule?: (schedule: ScheduleWithMedication) => void;
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

function formatDayAndTime(nextMs: number, timeUtc: string): string {
  const nextDate = new Date(nextMs);
  const now = new Date();
  const isToday = nextDate.toDateString() === now.toDateString();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  const isTomorrow = nextDate.toDateString() === tomorrow.toDateString();
  const dayPrefix = isToday ? 'Today' : isTomorrow ? 'Tomorrow' : nextDate.toLocaleDateString(undefined, { weekday: 'short' });
  return `${dayPrefix}, ${formatNextDoseTime(timeUtc)}`;
}

function getDoseNodeLabel(node: TimeNode): string {
  switch (node) {
    case 'BREAKFAST': return 'Morning dose';
    case 'LUNCH': return 'Afternoon dose';
    case 'DINNER':
    case 'BEDTIME': return 'Evening dose';
    case 'FASTING': return 'Fasting dose';
    default: return 'Scheduled dose';
  }
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
export function AlarmsHeroSummary({ schedules, onQuickAdd, onSelectSchedule }: AlarmsHeroSummaryProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.mode === 'dark';

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

  const nextAlarmInfo = useMemo(() => {
    const first = upcoming[0];
    if (!first) return null;
    return {
      schedule: first.schedule,
      nextMs: first.nextMs,
      relative: formatRelativeDiff(first.nextMs - Date.now()),
      timeLabel: formatNextDoseTime(first.schedule.time_utc),
      dayAndTime: formatDayAndTime(first.nextMs, first.schedule.time_utc),
    };
  }, [upcoming]);

  const followingAlarmInfo = useMemo(() => {
    const second = upcoming[1];
    if (!second) return null;
    return {
      schedule: second.schedule,
      timeLabel: formatNextDoseTime(second.schedule.time_utc),
      nodeLabel: getDoseNodeLabel(second.schedule.time_node),
      isEveningOrNight: second.schedule.time_node === 'BEDTIME' || second.schedule.time_node === 'DINNER',
    };
  }, [upcoming]);

  if (schedules.length === 0) {
    return null;
  }

  return (
    <View
      className="rounded-[24px] border p-5 shadow-sm"
      style={{
        backgroundColor: isDark ? 'rgba(31, 41, 55, 0.85)' : '#FFFFFF',
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: isDark ? 0.25 : 0.03,
        shadowRadius: 8,
        elevation: 1,
      }}
    >
      {/* Header Row: Bell Icon + Title/Subtitle + Active Count Badge */}
      <View className="flex-row items-center justify-between mb-4">
        <View className="flex-row items-center gap-3 flex-1 mr-2">
          <View
            className="items-center justify-center rounded-full"
            style={{
              width: 40,
              height: 40,
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF',
            }}
          >
            <Bell color={isDark ? '#60A5FA' : '#2563EB'} size={20} strokeWidth={2.2} />
          </View>
          <View className="flex-1">
            <Text
              className="text-[17px] font-bold tracking-tight"
              style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}
            >
              {t('alarms.scheduledAlarms')}
            </Text>
            <Text
              className="text-[13px] mt-0.5"
              style={{ color: isDark ? '#94A3B8' : '#64748B' }}
            >
              {t('alarms.scheduledAlarmsSubtitle')}
            </Text>
          </View>
        </View>

        {/* Active Count Pill Badge */}
        <View
          className="rounded-xl px-3 py-1.5"
          style={{
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF',
          }}
        >
          <Text
            className="text-[13px] font-bold"
            style={{
              color: isDark ? '#60A5FA' : '#2563EB',
            }}
          >
            {activeSchedules.length > 0
              ? `${activeSchedules.length} Active`
              : t('alarms.allPaused')}
          </Text>
        </View>
      </View>

      {/* Row 1: Next Alarm Spotlight */}
      {nextAlarmInfo ? (
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            onSelectSchedule?.(nextAlarmInfo.schedule);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${t('alarms.nextAlarm')}: ${nextAlarmInfo.schedule.medicationName}`}
          className="flex-row items-center justify-between rounded-2xl p-4 border"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
            marginBottom: followingAlarmInfo ? 12 : 0,
          }}
        >
          <View className="flex-row items-center gap-3.5 flex-1 mr-2">
            {/* Amber Sun Badge */}
            <View
              className="items-center justify-center rounded-2xl"
              style={{
                width: 46,
                height: 46,
                backgroundColor: isDark ? 'rgba(245, 158, 11, 0.18)' : '#FEF3C7',
              }}
            >
              <Sun color={isDark ? '#FBBF24' : '#F59E0B'} size={24} strokeWidth={2.2} />
            </View>

            <View className="flex-1">
              <Text
                className="text-[12.5px] font-medium"
                style={{ color: isDark ? '#94A3B8' : '#64748B' }}
              >
                {t('alarms.nextAlarm')}
              </Text>
              <Text
                className="text-[18px] font-bold tracking-tight my-0.5"
                style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}
              >
                {nextAlarmInfo.relative}
              </Text>
              <Text
                className="text-[13px] font-medium"
                style={{ color: isDark ? '#94A3B8' : '#64748B' }}
              >
                {nextAlarmInfo.dayAndTime}
              </Text>
              {/* Accessible hidden text for screen readers and unit tests */}
              <Text style={{ position: 'absolute', opacity: 0, height: 0 }}>
                {nextAlarmInfo.schedule.medicationName}
              </Text>
            </View>
          </View>

          <ChevronRight color={isDark ? '#94A3B8' : '#64748B'} size={18} strokeWidth={2.4} />
        </Pressable>
      ) : null}

      {/* Row 2: Following Alarm / Evening Dose */}
      {followingAlarmInfo ? (
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            onSelectSchedule?.(followingAlarmInfo.schedule);
          }}
          accessibilityRole="button"
          accessibilityLabel={`${followingAlarmInfo.nodeLabel}: ${followingAlarmInfo.schedule.medicationName}`}
          className="flex-row items-center justify-between rounded-2xl p-4 border"
          style={{
            backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : '#FFFFFF',
            borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
          }}
        >
          <View className="flex-row items-center gap-3.5 flex-1 mr-2">
            {/* Soft Purple Moon Badge */}
            <View
              className="items-center justify-center rounded-2xl"
              style={{
                width: 46,
                height: 46,
                backgroundColor: isDark ? 'rgba(139, 92, 246, 0.18)' : '#F5F3FF',
              }}
            >
              {followingAlarmInfo.isEveningOrNight ? (
                <Moon color={isDark ? '#C084FC' : '#8B5CF6'} size={22} strokeWidth={2.2} />
              ) : (
                <Sun color={isDark ? '#FBBF24' : '#F59E0B'} size={24} strokeWidth={2.2} />
              )}
            </View>

            <View className="flex-1">
              <Text
                className="text-[12.5px] font-medium"
                style={{ color: isDark ? '#94A3B8' : '#64748B' }}
              >
                {followingAlarmInfo.nodeLabel}
              </Text>
              <Text
                className="text-[18px] font-bold tracking-tight my-0.5"
                style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}
              >
                {followingAlarmInfo.timeLabel}
              </Text>
              <Text
                className="text-[13px] font-medium"
                style={{ color: isDark ? '#94A3B8' : '#64748B' }}
              >
                {t('alarms.daily')}
              </Text>
              <Text style={{ position: 'absolute', opacity: 0, height: 0 }}>
                {followingAlarmInfo.schedule.medicationName}
              </Text>
            </View>
          </View>

          <ChevronRight color={isDark ? '#94A3B8' : '#64748B'} size={18} strokeWidth={2.4} />
        </Pressable>
      ) : null}
    </View>
  );
}
