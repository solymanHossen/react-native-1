import notifee, { AndroidImportance, AndroidNotificationSetting, AndroidVisibility } from '@notifee/react-native';

export const ALARM_CHANNEL_ID = 'medication-alarms';

let channelReady: Promise<string> | null = null;

/**
 * High-importance + `bypassDnd` is what actually gets this past Do Not
 * Disturb — Android only bypasses DND for a channel explicitly marked this
 * way (the same mechanism the stock Clock app's alarm channel uses), not for
 * any notification that merely asks loudly. Memoized: `createChannel` is
 * idempotent on the OS side, but there's no reason to re-call it on every
 * `scheduleAlarm`.
 */
export function ensureAlarmChannel(): Promise<string> {
  if (!channelReady) {
    channelReady = notifee.createChannel({
      id: ALARM_CHANNEL_ID,
      name: 'Medication Alarms',
      description: 'Unmissable alerts for scheduled doses — bypasses Do Not Disturb.',
      importance: AndroidImportance.HIGH,
      visibility: AndroidVisibility.PUBLIC,
      bypassDnd: true,
      sound: 'default',
      vibration: true,
      vibrationPattern: [300, 600, 300, 600],
    });
  }
  return channelReady;
}

/**
 * Android 12+ treats exact alarms as a special, user-grantable permission —
 * declaring SCHEDULE_EXACT_ALARM in the manifest is not enough on its own,
 * and there is no runtime request dialog for it. Without this, notifee logs
 * "Missing SCHEDULE_EXACT_ALARM permission" and silently drops the trigger,
 * which is exactly the failure mode this alarm engine exists to prevent —
 * so this checks the setting and sends the user straight to the system
 * screen that grants it, rather than failing silently.
 */
export async function ensureExactAlarmPermission(): Promise<boolean> {
  const settings = await notifee.getNotificationSettings();
  if (settings.android.alarm === AndroidNotificationSetting.ENABLED) return true;
  if (settings.android.alarm === AndroidNotificationSetting.DISABLED) {
    await notifee.openAlarmPermissionSettings();
  }
  return false;
}
