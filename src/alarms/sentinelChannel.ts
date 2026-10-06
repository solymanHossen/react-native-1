import notifee, { AndroidImportance } from '@notifee/react-native';

export const SENTINEL_CHANNEL_ID = 'medication-sentinel';

let channelReady: Promise<string> | null = null;

/**
 * Deliberately a separate, low-importance channel from `ALARM_CHANNEL_ID`:
 * these are proactive, non-urgent heads-up — "running low," "expiring soon"
 * — not a dose that must be physically verified. LOW importance means no
 * sound/heads-up interruption, no DND bypass, consistent with that being
 * informational rather than something to wake someone up for.
 */
export function ensureSentinelChannel(): Promise<string> {
  if (!channelReady) {
    channelReady = notifee.createChannel({
      id: SENTINEL_CHANNEL_ID,
      name: 'Medication Reminders',
      description: 'Low-stock and expiry reminders — not urgent, no sound.',
      importance: AndroidImportance.LOW,
    });
  }
  return channelReady;
}
