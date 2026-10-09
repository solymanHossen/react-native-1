import { initializeDatabase } from '../db';
// Leaf store modules, not the `../store` barrel — that barrel re-exports
// `useActiveAlarmStore` from the `../alarms` barrel, which re-exports this
// very file, so importing it here would create a cycle.
import { useIntakeQueueStore } from '../store/intakeQueueStore';
import { useSentinelStore } from '../store/sentinelStore';
import { runSentinelCheckForMedication } from './sentinel';
import type { AlarmDismissalMethod, ScheduledAlarmPayload } from './types';

/**
 * Writes the confirmed-taken record and decrements stock by the dose
 * actually taken — called once NFC or vision verification succeeds (never
 * for a manual override, which logs through `caregiverEscalation`/MISSED
 * instead, not as a confirmed TAKEN).
 *
 * The insert and the stock decrement run inside one `db.transaction`, not as
 * two separate awaited calls: if the app were killed between them, the
 * previous (non-atomic) version could leave a TAKEN log with stock never
 * decremented, or vice versa. The repository classes are hard-typed to the
 * outer `DB` connection and don't accept the transaction's own `Transaction`
 * executor, so this writes the two statements directly against `tx.execute`
 * instead of going through `intakeLogs.record`/`medications.adjustStock`.
 */
export async function confirmIntake(payload: ScheduledAlarmPayload, method: Exclude<AlarmDismissalMethod, 'MANUAL_OVERRIDE'>): Promise<void> {
  const database = await initializeDatabase();
  const scheduledTime = new Date(payload.scheduledAtMs).toISOString();
  const takenTime = new Date().toISOString();

  await database.db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO intake_logs (schedule_id, scheduled_time, taken_time, status, dismissal_type, caregiver_alerted)
       VALUES (?, ?, ?, 'TAKEN', ?, 0);`,
      [payload.scheduleId, scheduledTime, takenTime, method],
    );
    await tx.execute(
      'UPDATE medications SET current_stock = MAX(0, current_stock - ?) WHERE id = ? AND is_archived = 0;',
      [payload.doseQuantity, payload.medicationId],
    );
  });

  // Outside the transaction on purpose: a notification is a side effect, not
  // part of the data write's atomicity guarantee, and reads the
  // just-committed stock level fresh.
  await runSentinelCheckForMedication(payload.medicationId);

  // This write happened through the alarm engine, not through the shared
  // intake-queue store's own `markTaken` — so the store's in-memory copy
  // needs an explicit re-read, or Home/Rhythm would keep showing this dose
  // as pending until their next natural remount.
  useIntakeQueueStore.getState().refresh().catch(() => {});
  useSentinelStore.getState().refresh().catch(() => {});
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
  useIntakeQueueStore.getState().refresh().catch(() => {});
}
