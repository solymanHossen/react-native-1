import notifee, { AlarmType, AndroidCategory, AndroidImportance, TriggerType, type Notification } from '@notifee/react-native';
import { initializeDatabase } from '../db';
import type { ScheduleWithMedication } from '../db/types';
import { ALARM_CHANNEL_ID, ensureAlarmChannel } from './alarmChannel';
import { nextSnoozeTimestamp } from './alarmPolicy';
import type { ScheduledAlarmPayload } from './types';

/** Stable per-schedule notification id — re-scheduling the same schedule naturally replaces its previous trigger instead of stacking duplicates. */
function notificationIdFor(scheduleId: number): string {
  return `alarm-schedule-${scheduleId}`;
}

/**
 * Finds the next timestamp this schedule should fire at, honoring
 * `days_of_week_mask` (bit 0 = Sunday … bit 6 = Saturday) and skipping
 * today if its time has already passed. `time_utc` is treated as local
 * wall-clock "HH:MM", the same simplification the rest of this app already
 * makes for every other schedule/dose-time field — nothing in this codebase
 * does real timezone conversion on it.
 */
export function computeNextOccurrenceMs(timeUtc: string, daysOfWeekMask: number, fromMs: number = Date.now()): number {
  const [hoursStr, minutesStr] = timeUtc.split(':');
  const hours = Number(hoursStr);
  const minutes = Number(minutesStr);

  for (let dayOffset = 0; dayOffset < 8; dayOffset += 1) {
    const candidate = new Date(fromMs);
    candidate.setDate(candidate.getDate() + dayOffset);
    candidate.setHours(hours, minutes, 0, 0);
    const dayBit = 1 << candidate.getDay();
    if ((daysOfWeekMask & dayBit) === 0) continue;
    if (candidate.getTime() <= fromMs) continue;
    return candidate.getTime();
  }

  // Degenerate mask (e.g. 0) — fall back to the same time tomorrow rather than never firing.
  const fallback = new Date(fromMs);
  fallback.setDate(fallback.getDate() + 1);
  fallback.setHours(hours, minutes, 0, 0);
  return fallback.getTime();
}

function toPayload(schedule: ScheduleWithMedication, scheduledAtMs: number): ScheduledAlarmPayload {
  return {
    scheduleId: schedule.id,
    medicationId: schedule.medication_id,
    medicationName: schedule.medicationName,
    dosageLabel: `${schedule.dose_quantity} ${schedule.medicationForm}${schedule.dose_quantity === 1 ? '' : 's'}`,
    doseQuantity: schedule.dose_quantity,
    nfcTagUid: schedule.nfcTagUid,
    scheduledAtMs,
  };
}

function buildNotification(notificationId: string, payload: ScheduledAlarmPayload, body?: string): Notification {
  return {
    id: notificationId,
    title: `Time for ${payload.medicationName}`,
    body: body ?? `${payload.dosageLabel} — scan the bottle's NFC tag or show the pack to the camera to confirm.`,
    data: { payload },
    android: {
      channelId: ALARM_CHANNEL_ID,
      category: AndroidCategory.ALARM,
      importance: AndroidImportance.HIGH,
      loopSound: true,
      ongoing: true,
      autoCancel: false,
      lightUpScreen: true,
      fullScreenAction: { id: 'default' },
      pressAction: { id: 'default', launchActivity: 'default' },
    },
  };
}

async function buildAlarmNotification(schedule: ScheduleWithMedication, scheduledAtMs: number): Promise<Notification> {
  await ensureAlarmChannel();
  const payload = toPayload(schedule, scheduledAtMs);
  return buildNotification(notificationIdFor(schedule.id), payload);
}

/** Schedules (or replaces) the next-occurrence alarm for one active schedule entry. */
export async function scheduleAlarm(schedule: ScheduleWithMedication): Promise<void> {
  const scheduledAtMs = computeNextOccurrenceMs(schedule.time_utc, schedule.days_of_week_mask);
  const notification = await buildAlarmNotification(schedule, scheduledAtMs);
  await notifee.createTriggerNotification(notification, {
    type: TriggerType.TIMESTAMP,
    timestamp: scheduledAtMs,
    alarmManager: { type: AlarmType.SET_ALARM_CLOCK },
  });
}

/** Re-fires the same alarm 5 minutes out, carrying the same payload forward — called from AlarmScreen's snooze button, which already holds the full payload and has no need to re-read the schedule from the DB. */
export async function scheduleSnoozeAlarm(notificationId: string, payload: ScheduledAlarmPayload): Promise<void> {
  await ensureAlarmChannel();
  await notifee.cancelTriggerNotification(notificationId).catch(() => {});
  const notification = buildNotification(notificationId, payload, `${payload.dosageLabel} — snoozed, confirm when ready.`);
  await notifee.createTriggerNotification(notification, {
    type: TriggerType.TIMESTAMP,
    timestamp: nextSnoozeTimestamp(Date.now()),
    alarmManager: { type: AlarmType.SET_ALARM_CLOCK },
  });
}

/**
 * Cancels both the pending trigger and any currently-displayed/ongoing
 * notification for this schedule. Those are two separate notifee states —
 * `cancelTriggerNotification` only withdraws a *future* scheduled firing,
 * it does nothing to a notification that has already fired and is sitting
 * in the shade as `ongoing: true`. "Turn this alarm off" has to cover an
 * alarm that's already ringing, not just ones still waiting to fire —
 * otherwise a stale, never-dismissed alarm notification keeps re-showing
 * its full-screen activity on its own.
 */
export async function cancelAlarm(scheduleId: number): Promise<void> {
  const id = notificationIdFor(scheduleId);
  await notifee.cancelTriggerNotification(id).catch(() => {});
  await notifee.cancelNotification(id).catch(() => {});
}

/** Flips a schedule's active flag and keeps the real notification in sync with it — off actually cancels the scheduled/displayed alarm, not just a UI toggle that drifts from what's really going to fire. */
export async function setScheduleActive(schedule: ScheduleWithMedication, isActive: boolean): Promise<void> {
  const database = await initializeDatabase();
  await database.schedules.setActive(schedule.id, isActive);
  if (isActive) {
    await scheduleAlarm(schedule);
  } else {
    await cancelAlarm(schedule.id);
  }
}

/**
 * Re-reads every active schedule from the DB and re-schedules its alarm from
 * scratch. This is the one function both app-startup and the boot-time
 * headless task call — Android drops all AlarmManager entries on reboot, so
 * "reschedule everything from the source of truth" has to be safe to run
 * repeatedly and is simpler than trying to diff what survived.
 */
export async function rescheduleAllActiveAlarms(): Promise<void> {
  const database = await initializeDatabase();
  const schedules = await database.schedules.listActiveWithMedication();

  const existingIds = await notifee.getTriggerNotificationIds();
  await notifee.cancelTriggerNotifications(existingIds.filter((id) => id.startsWith('alarm-schedule-')));

  for (const schedule of schedules) {
    await scheduleAlarm(schedule);
  }
}
