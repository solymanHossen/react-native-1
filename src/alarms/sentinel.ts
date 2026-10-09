import notifee, { RepeatFrequency, TriggerType } from '@notifee/react-native';
import { initializeDatabase } from '../db';
import type { Medication } from '../db/types';
import { ensureSentinelChannel, SENTINEL_CHANNEL_ID } from './sentinelChannel';

/** Stable id for the one recurring "run the check" trigger — notifee always shows *something* when a trigger fires, so the handler dismisses this generic one immediately after running the real check and displaying its actual findings (see handleDailySentinelFired). */
export const DAILY_SENTINEL_NOTIFICATION_ID = 'sentinel-daily-check';
const EXPIRY_WARNING_DAYS = 15;

function lowStockNotificationId(medicationId: number): string {
  return `sentinel-lowstock-${medicationId}`;
}

function expiryNotificationId(medicationId: number): string {
  return `sentinel-expiry-${medicationId}`;
}

/** Exact template from spec, kept as one string rather than composed from separately-translated fragments. */
function lowStockMessageBn(medicationName: string, remaining: number): string {
  return `সময়মতো ওষুধ সংগ্রহ করুন: ${medicationName} আর মাত্র ${remaining} টি বাকি আছে।`;
}

/** A stable per-medication notification id means a repeat check just updates (or clears) the same shade entry instead of stacking a fresh duplicate every time a dose is taken while stock is already low. */
async function notifyIfLowStock(medication: Medication): Promise<void> {
  const id = lowStockNotificationId(medication.id);
  if (medication.current_stock > medication.refill_threshold) {
    await notifee.cancelNotification(id).catch(() => {});
    return;
  }
  await ensureSentinelChannel();
  await notifee.displayNotification({
    id,
    title: 'Refill reminder',
    body: lowStockMessageBn(medication.name, Math.max(0, Math.round(medication.current_stock))),
    android: { channelId: SENTINEL_CHANNEL_ID },
  });
}

function daysUntil(dateIso: string): number {
  const target = new Date(dateIso).setHours(0, 0, 0, 0);
  const today = new Date().setHours(0, 0, 0, 0);
  return Math.round((target - today) / (24 * 60 * 60 * 1000));
}

/** Within the 15-day warning window on either side — a medication that already expired is still worth flagging, not just ones approaching expiry. */
async function notifyIfExpiringSoon(medication: Medication): Promise<void> {
  const id = expiryNotificationId(medication.id);
  if (!medication.expiry_date) {
    await notifee.cancelNotification(id).catch(() => {});
    return;
  }
  const days = daysUntil(medication.expiry_date);
  if (days > EXPIRY_WARNING_DAYS) {
    await notifee.cancelNotification(id).catch(() => {});
    return;
  }

  const body =
    days < 0
      ? `${medication.name} expired ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} ago — dispose of it safely and get a replacement.`
      : days === 0
        ? `${medication.name} expires today — time to get a replacement.`
        : `${medication.name} expires in ${days} day${days === 1 ? '' : 's'} — time to get a replacement.`;

  await ensureSentinelChannel();
  await notifee.displayNotification({
    id,
    title: 'Expiry reminder',
    body,
    android: { channelId: SENTINEL_CHANNEL_ID },
  });
}

export interface MedicationAlert {
  medicationId: number;
  medicationName: string;
  kind: 'LOW_STOCK' | 'EXPIRING' | 'EXPIRED';
  /** Remaining units for LOW_STOCK; days until expiry for EXPIRING (0 = today); days since expiry (positive) for EXPIRED. Deliberately not a pre-formatted string — this is read by the in-app UI, which has to render it in whichever language is selected, not whatever this module happened to format it in. */
  value: number;
}

/**
 * Same thresholds as `notifyIfLowStock`/`notifyIfExpiringSoon`, but as a pure
 * read with no notifee side effect — what the in-app dashboard's refill/
 * expiry banner reads from, kept as one source of truth for "does this
 * medication need attention" rather than a second copy of the threshold
 * logic drifting from the notification path.
 */
function classifyMedicationAlert(medication: Medication): MedicationAlert | null {
  if (medication.current_stock <= medication.refill_threshold) {
    return {
      medicationId: medication.id,
      medicationName: medication.name,
      kind: 'LOW_STOCK',
      value: Math.max(0, Math.round(medication.current_stock)),
    };
  }
  if (medication.expiry_date) {
    const days = daysUntil(medication.expiry_date);
    if (days <= EXPIRY_WARNING_DAYS) {
      return {
        medicationId: medication.id,
        medicationName: medication.name,
        kind: days < 0 ? 'EXPIRED' : 'EXPIRING',
        value: Math.abs(days),
      };
    }
  }
  return null;
}

/** In-app read for the dashboard's refill/expiry banner — the notification sentinel (`runSentinelCheck`) stays the source of truth for actually alerting the user outside the app. */
export async function getActiveMedicationAlerts(): Promise<MedicationAlert[]> {
  const database = await initializeDatabase();
  const medications = await database.medications.list();
  return medications.map(classifyMedicationAlert).filter((alert): alert is MedicationAlert => alert !== null);
}

/** Called right after a confirmed intake — checks only the one medication whose stock just changed, rather than re-scanning everything. */
export async function runSentinelCheckForMedication(medicationId: number): Promise<void> {
  const database = await initializeDatabase();
  const medication = await database.medications.getById(medicationId);
  if (!medication) return;
  await notifyIfLowStock(medication);
  await notifyIfExpiringSoon(medication);
}

/** Full sweep — called at app startup and by the daily recurring trigger, since either stock or expiry dates could have changed without an intake ever happening (e.g. a manually-edited threshold, or a day simply passing). */
export async function runSentinelCheck(): Promise<void> {
  const database = await initializeDatabase();
  const medications = await database.medications.list();
  for (const medication of medications) {
    await notifyIfLowStock(medication);
    await notifyIfExpiringSoon(medication);
  }
}

/**
 * Schedules (or re-points) one daily recurring trigger at the given local
 * time. Uses the default WorkManager-backed trigger (no `alarmManager`) —
 * unlike a medication dose, a background inventory sweep has no reason to
 * need millisecond precision or the SCHEDULE_EXACT_ALARM permission.
 */
export async function scheduleDailySentinelCheck(hour = 9, minute = 0): Promise<void> {
  await ensureSentinelChannel();
  const next = new Date();
  next.setHours(hour, minute, 0, 0);
  if (next.getTime() <= Date.now()) next.setDate(next.getDate() + 1);

  await notifee.cancelTriggerNotification(DAILY_SENTINEL_NOTIFICATION_ID).catch(() => {});
  await notifee.createTriggerNotification(
    {
      id: DAILY_SENTINEL_NOTIFICATION_ID,
      title: 'Medicine Reminder',
      body: 'Checking your medication stock and expiry dates…',
      android: { channelId: SENTINEL_CHANNEL_ID },
    },
    {
      type: TriggerType.TIMESTAMP,
      timestamp: next.getTime(),
      repeatFrequency: RepeatFrequency.DAILY,
    },
  );
}

/** Runs the real check and replaces the generic "checking…" notification with whatever it actually found (or clears it if nothing needs attention) — the heartbeat trigger itself is never the thing the user reads. */
export async function handleDailySentinelFired(): Promise<void> {
  await notifee.cancelNotification(DAILY_SENTINEL_NOTIFICATION_ID).catch(() => {});
  await runSentinelCheck();
}
