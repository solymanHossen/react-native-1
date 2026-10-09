import notifee, { EventType, type Event } from '@notifee/react-native';
import { useActiveAlarmStore } from './activeAlarmStore';
import { ensureAlarmChannel, ensureExactAlarmPermission } from './alarmChannel';
import { rescheduleAllActiveAlarms } from './alarmScheduler';
import { DAILY_SENTINEL_NOTIFICATION_ID, handleDailySentinelFired, runSentinelCheck, scheduleDailySentinelCheck } from './sentinel';
import type { ScheduledAlarmPayload } from './types';

function extractPayload(event: Event): ScheduledAlarmPayload | null {
  const notification = event.detail.notification;
  const payload = notification?.data?.payload;
  if (!notification || !payload || typeof payload !== 'object') return null;
  return payload as unknown as ScheduledAlarmPayload;
}

/**
 * Android fires more than one event for a single alarm — observed in
 * practice, a DELIVERED immediately followed by a spontaneous PRESS a few
 * seconds later, apparently from the system treating the full-screen
 * intent's own launch as an implicit press of the notification's default
 * press action. Re-activating from that second event would stomp the
 * in-progress alarm's `firedAtMs`/`snoozeCount` back to fresh — resetting
 * the escalation countdown and silently granting an extra snooze beyond the
 * 2-snooze ceiling. Guarding on notificationId makes every event after the
 * first a no-op for an alarm that's already active.
 */
function activateFromEvent(event: Event): void {
  const payload = extractPayload(event);
  const notificationId = event.detail.notification?.id;
  if (!payload || !notificationId) return;
  if (useActiveAlarmStore.getState().activeAlarm?.notificationId === notificationId) return;
  useActiveAlarmStore.getState().setActiveAlarm({
    notificationId,
    payload,
    firedAtMs: Date.now(),
    snoozeCount: 0,
  });
}

/**
 * Every notifee event in this app — alarm or sentinel — flows through the
 * same single `onForegroundEvent`/`onBackgroundEvent` pair (notifee only
 * supports one handler of each, registering a second silently replaces the
 * first), so this is the one place that routes by notification identity
 * rather than assuming every event is an alarm.
 */
async function handleNotifeeEvent(event: Event): Promise<void> {
  const notificationId = event.detail.notification?.id;
  if (notificationId === DAILY_SENTINEL_NOTIFICATION_ID) {
    if (event.type === EventType.DELIVERED) {
      await handleDailySentinelFired();
    }
    return;
  }
  if (event.type === EventType.DELIVERED || event.type === EventType.PRESS) {
    activateFromEvent(event);
  }
}

let initialized = false;

/**
 * Called once from App.tsx on mount. Sets up the channel, wires the two
 * event paths that can bring an alarm onto the active-alarm store — a cold
 * launch via the full-screen intent (`getInitialNotification`) and a
 * delivery/press while the app is already running (`onForegroundEvent`) —
 * and kicks off a reschedule pass so edits made elsewhere in the app (new
 * schedule, stock change) are reflected in the next alarm immediately rather
 * than waiting for the next boot.
 */
export async function initializeAlarmSystem(): Promise<void> {
  if (initialized) return;
  initialized = true;

  await ensureAlarmChannel();
  await notifee.requestPermission();
  await ensureExactAlarmPermission();

  const initial = await notifee.getInitialNotification();
  if (initial) {
    activateFromEvent({ type: EventType.PRESS, detail: { notification: initial.notification, pressAction: initial.pressAction } });
  }

  notifee.onForegroundEvent((event) => {
    handleNotifeeEvent(event).catch((error: unknown) => {
      console.warn('[alarms] failed to handle foreground notifee event', error);
    });
  });

  // Background events (app killed/backgrounded) go through the same router —
  // this is also what lets the daily sentinel check run without the app
  // ever having been opened that day.
  notifee.onBackgroundEvent(handleNotifeeEvent);

  rescheduleAllActiveAlarms().catch((error: unknown) => {
    console.warn('[alarms] failed to reschedule active alarms', error);
  });

  scheduleDailySentinelCheck().catch((error: unknown) => {
    console.warn('[alarms] failed to schedule the daily sentinel check', error);
  });

  runSentinelCheck().catch((error: unknown) => {
    console.warn('[alarms] failed to run the startup sentinel check', error);
  });
}

export { useActiveAlarmStore } from './activeAlarmStore';
export { ensureExactAlarmPermission } from './alarmChannel';
export {
  getCaregiverPhone,
  isValidCaregiverPhone,
  normalizeCaregiverPhone,
  setCaregiverPhone,
  escalateToCaregiver,
} from './caregiverEscalation';
export { confirmIntake, logManualOverride } from './intakeConfirmation';
export * from './alarmPolicy';
export {
  cancelAlarm,
  computeNextOccurrenceMs,
  rescheduleAllActiveAlarms,
  scheduleAlarm,
  scheduleSnoozeAlarm,
  setScheduleActive,
} from './alarmScheduler';
export { isNfcAvailable, listenForTag } from './nfcVerification';
export { scanPackForMedication, VISION_CONFIDENCE_THRESHOLD } from './visionVerification';
export { getActiveMedicationAlerts, runSentinelCheck, runSentinelCheckForMedication, scheduleDailySentinelCheck } from './sentinel';
export type { MedicationAlert } from './sentinel';
export * from './types';
