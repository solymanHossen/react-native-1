import notifee, { EventType, type Event } from '@notifee/react-native';
import { useActiveAlarmStore } from './activeAlarmStore';
import { ensureAlarmChannel, ensureExactAlarmPermission } from './alarmChannel';
import { rescheduleAllActiveAlarms } from './alarmScheduler';
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
    console.warn('[DIAG] onForegroundEvent', EventType[event.type], event.detail.notification?.id);
    if (event.type === EventType.DELIVERED || event.type === EventType.PRESS) {
      activateFromEvent(event);
    }
  });

  // Required by notifee even when there's nothing else to do here: the
  // primary flow is the full-screen Activity launch + getInitialNotification
  // above, which covers both the killed-app and backgrounded-app cases.
  notifee.onBackgroundEvent(async () => {});

  rescheduleAllActiveAlarms().catch((error: unknown) => {
    console.warn('[alarms] failed to reschedule active alarms', error);
  });
}

export { useActiveAlarmStore } from './activeAlarmStore';
export { ensureExactAlarmPermission } from './alarmChannel';
export { getCaregiverPhone, setCaregiverPhone, escalateToCaregiver } from './caregiverEscalation';
export { confirmIntake, logManualOverride } from './intakeConfirmation';
export * from './alarmPolicy';
export { cancelAlarm, computeNextOccurrenceMs, rescheduleAllActiveAlarms, scheduleAlarm, scheduleSnoozeAlarm, triggerAlarmNow } from './alarmScheduler';
export { isNfcAvailable, listenForTag } from './nfcVerification';
export { scanPackForMedication, VISION_CONFIDENCE_THRESHOLD } from './visionVerification';
export * from './types';
