import { Linking } from 'react-native';
import { initializeDatabase } from '../db';
import { storage } from '../lib/storage';
import type { ScheduledAlarmPayload } from './types';

const CAREGIVER_PHONE_KEY = 'alarm-caregiver-phone';

export function getCaregiverPhone(): string | null {
  return storage.getString(CAREGIVER_PHONE_KEY) ?? null;
}

export function setCaregiverPhone(phone: string): void {
  if (phone.trim()) {
    storage.set(CAREGIVER_PHONE_KEY, phone.trim());
  } else {
    storage.delete(CAREGIVER_PHONE_KEY);
  }
}

/**
 * Marks the dose MISSED and, if a caregiver number is configured, opens the
 * device's own SMS composer pre-filled with an alert — the user (or whoever
 * is holding the phone once the 15-minute window lapses) still has to tap
 * send. This app is offline-first (no server, no background network call
 * anywhere in it); SMS travels over cellular signaling, not the internet,
 * and requiring an explicit tap means nothing goes out silently on anyone's
 * behalf. A truly automatic/silent send would need the SEND_SMS dangerous
 * permission and Play Store's restricted-permission review process —
 * deliberately not what this does.
 */
export async function escalateToCaregiver(payload: ScheduledAlarmPayload): Promise<void> {
  const phone = getCaregiverPhone();

  const database = await initializeDatabase();
  await database.intakeLogs.record({
    schedule_id: payload.scheduleId,
    scheduled_time: new Date(payload.scheduledAtMs).toISOString(),
    taken_time: null,
    status: 'MISSED',
    dismissal_type: null,
    caregiver_alerted: Boolean(phone),
  });

  if (!phone) return;

  const message = `Medius Health alert: ${payload.medicationName} (${payload.dosageLabel}) was not confirmed taken and is now marked missed.`;
  const url = `sms:${phone}?body=${encodeURIComponent(message)}`;
  if (await Linking.canOpenURL(url)) {
    await Linking.openURL(url);
  }
}
