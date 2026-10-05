import { initializeDatabase } from '../db';
import type { AlarmDismissalMethod, ScheduledAlarmPayload } from './types';

/** Writes the confirmed-taken record and decrements stock by the dose actually taken — called once NFC or vision verification succeeds (never for a manual override, which logs through `caregiverEscalation`/MISSED instead, not as a confirmed TAKEN). */
export async function confirmIntake(payload: ScheduledAlarmPayload, method: Exclude<AlarmDismissalMethod, 'MANUAL_OVERRIDE'>): Promise<void> {
  const database = await initializeDatabase();
  await database.intakeLogs.record({
    schedule_id: payload.scheduleId,
    scheduled_time: new Date(payload.scheduledAtMs).toISOString(),
    taken_time: new Date().toISOString(),
    status: 'TAKEN',
    dismissal_type: method,
    caregiver_alerted: false,
  });
  await database.medications.adjustStock(payload.medicationId, -payload.doseQuantity);
}

/** A hold-to-override silence is explicitly NOT a confirmed dose — it's logged as a manual override on an otherwise-unverified alarm, distinct from both a real TAKEN and the auto-MISSED path. */
export async function logManualOverride(payload: ScheduledAlarmPayload): Promise<void> {
  const database = await initializeDatabase();
  await database.intakeLogs.record({
    schedule_id: payload.scheduleId,
    scheduled_time: new Date(payload.scheduledAtMs).toISOString(),
    taken_time: null,
    status: 'SKIPPED',
    dismissal_type: 'MANUAL_OVERRIDE',
    caregiver_alerted: false,
  });
}
