import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Bell, ChevronRight, Clock, Moon, Plus, Sparkles, Sun, Sunrise, Sunset } from 'lucide-react-native';
import type { ScheduleWithMedication, TimeNode } from '../../db/types';
import { computeNextOccurrenceMs } from '../../alarms/alarmScheduler';
import { useTranslation, type TranslationKey } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

export interface AlarmsHeroSummaryProps {
  schedules: ScheduleWithMedication[];
  /** Quick-add shortcut shown as a floating "+" on the card's corner — optional so this component still works standalone/in tests without a wired scroll target. */
  onQuickAdd?: () => void;
}

const TIME_NODE_ICON: Record<TimeNode, typeof Sun> = {
  BREAKFAST: Sunrise,
  LUNCH: Sun,
  DINNER: Sunset,
  BEDTIME: Moon,
  FASTING: Clock,
};

const TIME_NODE_LABEL_KEY: Record<TimeNode, TranslationKey> = {
  BREAKFAST: 'alarms.timeMorning',
  LUNCH: 'alarms.timeAfternoon',
  DINNER: 'alarms.timeEvening',
  BEDTIME: 'alarms.timeBedtime',
  FASTING: 'status.fasting',
};

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
export function AlarmsHeroSummary({ schedules, onQuickAdd }: AlarmsHeroSummaryProps) {
  const theme = useTheme();
  const { t } = useTranslation();

  const activeSchedules = useMemo(
    () => schedules.filter((s) => s.is_active),
    [schedules],
  );

  // Every active schedule's next occurrence, soonest first — the spotlight
  // uses [0], the compact preview row below it uses [1], so they can never
  // show the same alarm twice even as schedules change.
  const upcoming = useMemo(() => {
    if (activeSchedules.length === 0) return [];
    const now = Date.now();
    return activeSchedules
      .map((schedule) => ({ schedule, nextMs: computeNextOccurrenceMs(schedule.time_utc, schedule.days_of_week_mask, now) }))
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
    };
  }, [upcoming]);

  const followingAlarmInfo = useMemo(() => {
    const second = upcoming[1];
    if (!second) return null;
    return {
      schedule: second.schedule,
      timeLabel: formatNextDoseTime(second.schedule.time_utc),
    };
  }, [upcoming]);

  if (schedules.length === 0) {
    return null;
  }

  const isDark = theme.mode === 'dark';

  return (
    <View
      // No `overflow-hidden` here (unlike the original version of this card):
      // the quick-add FAB below is deliberately positioned to overlap this
      // card's bottom-right corner, and overflow-hidden would clip it off.
      className="relative rounded-3xl border p-5 shadow-lg"
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

      <Text className="mt-1 text-caption" style={{ color: theme.colors.inkSecondary }}>
        {t('alarms.scheduledAlarmsSubtitle')}
      </Text>

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

      {/* Compact preview of the alarm right after the spotlighted one — a
          glanceable "what's next after next", not a duplicate of the full
          detail already available in the schedule list below this card. */}
      {followingAlarmInfo
        ? (() => {
            const FollowingIcon = TIME_NODE_ICON[followingAlarmInfo.schedule.time_node];
            return (
              <View className="mt-3 flex-row items-center gap-3 border-t pt-3" style={{ borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline }}>
                <View className="items-center justify-center rounded-full" style={{ width: 36, height: 36, backgroundColor: `${theme.action.base}14` }}>
                  <FollowingIcon color={theme.action.base} size={17} strokeWidth={2.25} />
                </View>
                <View className="flex-1">
                  <Text className="text-caption" numberOfLines={1} style={{ color: theme.colors.inkSecondary }}>
                    {t(TIME_NODE_LABEL_KEY[followingAlarmInfo.schedule.time_node])}
                  </Text>
                  <Text className="text-body-lg font-bold" numberOfLines={1} style={{ color: theme.colors.ink }}>
                    {followingAlarmInfo.timeLabel}
                  </Text>
                  <Text className="text-caption" numberOfLines={1} style={{ color: theme.colors.inkMuted }}>
                    {t('alarms.daily')}
                  </Text>
                </View>
                <ChevronRight color={theme.colors.inkMuted} size={18} strokeWidth={2.5} />
              </View>
            );
          })()
        : null}

      {onQuickAdd ? (
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            onQuickAdd();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('alarms.addReminder')}
          className="min-h-hit min-w-hit items-center justify-center rounded-full"
          style={{
            position: 'absolute',
            bottom: -14,
            right: 10,
            width: 48,
            height: 48,
            backgroundColor: theme.action.base,
            shadowColor: theme.action.base,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.35,
            shadowRadius: 10,
            elevation: 6,
          }}
        >
          <Plus color={theme.action.ink} size={22} strokeWidth={2.5} />
        </Pressable>
      ) : null}
    </View>
  );
}
