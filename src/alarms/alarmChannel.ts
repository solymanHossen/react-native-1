import notifee, { AndroidImportance, AndroidNotificationSetting, AndroidVisibility } from '@notifee/react-native';

// Bumped from 'medication-alarms': Android notification channels are
// immutable after first creation (sound especially — "this setting cannot be
// overridden once the channel is created," per notifee/Android's own docs),
// so dropping the generic default-notification chime below needs a new
// channel id to actually take effect on a device that already has the old
// one. The old id is simply abandoned, not migrated — nothing reads it by
// name outside this module.
export const ALARM_CHANNEL_ID = 'medication-alarms-v3';

let channelReady: Promise<string> | null = null;

/**
 * High-importance + `bypassDnd` is what actually gets this past Do Not
 * Disturb — Android only bypasses DND for a channel explicitly marked this
 * way (the same mechanism the stock Clock app's alarm channel uses).
 * `sound: 'default'` guarantees an audible chime even when the device is
 * locked or screen is off.
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
