export type AlarmDismissalMethod = 'NFC' | 'VISION' | 'MANUAL_OVERRIDE';
import type { MealRelation } from '../db/types';

/**
 * Everything the full-screen alarm screen needs to render and verify a dose,
 * carried in the notification's own `data` payload rather than re-fetched
 * from the DB at fire time — the alarm has to come up instantly even if the
 * encrypted DB connection is slow to (re)open (see keyManager's
 * WHEN_UNLOCKED_THIS_DEVICE_ONLY caveat for why that's not guaranteed at
 * boot). The DB is only touched afterward, to write the resulting intake log.
 */
export interface ScheduledAlarmPayload {
  scheduleId: number;
  medicationId: number;
  medicationName: string;
  /** Verified strength from the medication record (e.g. "500 mg") — null when never recorded. Never inferred from the name. */
  medicationStrength: string | null;
  dosageLabel: string;
  doseQuantity: number;
  mealRelation: MealRelation;
  nfcTagUid: string | null;
  /** Epoch ms this specific occurrence was scheduled for — identifies the dose being confirmed, independent of when the alarm actually fires or is resolved. */
  scheduledAtMs: number;
  /** User-supplied label for this reminder (see Schedule.title) — null falls back to the default "Time for {medication}" notification title. */
  title: string | null;
}

/** In-memory state for whichever alarm currently owns the screen (see activeAlarmStore.ts) — `null` means no alarm is active and the normal tab UI renders. */
export interface ActiveAlarm {
  notificationId: string;
  payload: ScheduledAlarmPayload;
  /** When this instance actually fired/was opened — the anchor the 15-minute escalation deadline and snooze countdown are measured from. */
  firedAtMs: number;
  snoozeCount: number;
}
