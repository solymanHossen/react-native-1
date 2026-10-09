import { useCallback, useEffect, useMemo, useState } from 'react';
import { create } from 'zustand';
import { initializeDatabase } from '../db';
import type { MealRelation, TimeNode } from '../db/types';
import type { DoseEntry, SkipReason, UseDoseScheduleResult } from '../dashboard/types';
import { useSentinelStore } from './sentinelStore';

export type IntakeQueueStatus = 'TAKEN' | 'MISSED' | 'PENDING' | 'SCHEDULED';

export interface IntakeQueueItem {
  scheduleId: number;
  medicationId: number;
  medicationName: string;
  dosageLabel: string;
  doseQuantity: number;
  timeNode: TimeNode;
  timeUtc: string;
  mealRelation: MealRelation;
  instructions: string | null;
  stockRemaining: number;
  status: IntakeQueueStatus;
}

interface IntakeQueueState {
  items: IntakeQueueItem[];
  loading: boolean;
  refresh: () => Promise<void>;
  /** Optimistic: flips the item to TAKEN immediately, then writes the intake log + stock decrement as one background transaction. Reverts the optimistic flip if the write fails. */
  markTaken: (scheduleId: number) => Promise<void>;
  /** Same optimistic/background-write shape as `markTaken`, logged as SKIPPED (no stock deducted) instead of TAKEN. */
  markSkipped: (scheduleId: number) => Promise<void>;
}

function startOfTodayIso(): string {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date.toISOString();
}

/** Mirrors the fixed-demo heuristic this store replaces: within an hour either side of now reads as imminent ("pending"), more than an hour past reads as having been missed until something resolves it. */
function deriveTimeBasedStatus(timeUtc: string, nowHour: number): IntakeQueueStatus {
  const [hours, minutes] = timeUtc.split(':').map(Number);
  const scheduleHour = hours + minutes / 60;
  const diff = scheduleHour - nowHour;
  if (diff < -1) return 'MISSED';
  if (diff <= 1) return 'PENDING';
  return 'SCHEDULED';
}

async function buildQueueItems(): Promise<IntakeQueueItem[]> {
  const database = await initializeDatabase();
  const todayBit = 1 << new Date().getDay();
  const now = new Date();
  const nowHour = now.getHours() + now.getMinutes() / 60;

  const [schedules, medications, todaysLogs] = await Promise.all([
    database.schedules.listActiveWithMedication(),
    database.medications.list(),
    database.intakeLogs.listSince(startOfTodayIso()),
  ]);

  const medicationById = new Map(medications.map((medication) => [medication.id, medication]));
  // A schedule could in principle log more than once in a day (e.g. a snooze
  // retry); the latest one is what should drive today's displayed status.
  const latestLogBySchedule = new Map<number, (typeof todaysLogs)[number]>();
  for (const log of todaysLogs) {
    latestLogBySchedule.set(log.schedule_id, log);
  }

  return schedules
    .filter((schedule) => (schedule.days_of_week_mask & todayBit) !== 0)
    .map((schedule) => {
      const log = latestLogBySchedule.get(schedule.id);
      const medication = medicationById.get(schedule.medication_id);
      const status: IntakeQueueStatus =
        log?.status === 'TAKEN'
          ? 'TAKEN'
          : log?.status === 'MISSED' || log?.status === 'SKIPPED'
            ? 'MISSED'
            : deriveTimeBasedStatus(schedule.time_utc, nowHour);

      return {
        scheduleId: schedule.id,
        medicationId: schedule.medication_id,
        medicationName: schedule.medicationName,
        dosageLabel: `${schedule.dose_quantity} ${schedule.medicationForm}${schedule.dose_quantity === 1 ? '' : 's'}`,
        doseQuantity: schedule.dose_quantity,
        timeNode: schedule.time_node,
        timeUtc: schedule.time_utc,
        mealRelation: schedule.meal_relation,
        instructions: medication?.instructions ?? null,
        stockRemaining: medication?.current_stock ?? 0,
        status,
      };
    })
    .sort((a, b) => a.timeUtc.localeCompare(b.timeUtc));
}

/** Writes one intake log row and (for a taken dose) decrements stock, as a single atomic transaction — same reasoning as `alarms/intakeConfirmation.ts`'s `confirmIntake`, just for a direct "mark as taken from the dashboard" tap rather than an alarm's NFC/vision-verified flow, so it logs `dismissal_type: 'MANUAL_OVERRIDE'` instead. */
async function writeIntakeLog(item: IntakeQueueItem, status: 'TAKEN' | 'SKIPPED'): Promise<void> {
  const database = await initializeDatabase();
  const now = new Date().toISOString();
  await database.db.transaction(async (tx) => {
    await tx.execute(
      `INSERT INTO intake_logs (schedule_id, scheduled_time, taken_time, status, dismissal_type, caregiver_alerted)
       VALUES (?, ?, ?, ?, 'MANUAL_OVERRIDE', 0);`,
      [item.scheduleId, now, status === 'TAKEN' ? now : null, status],
    );
    if (status === 'TAKEN') {
      await tx.execute(
        'UPDATE medications SET current_stock = MAX(0, current_stock - ?) WHERE id = ? AND is_archived = 0;',
        [item.doseQuantity, item.medicationId],
      );
    }
  });
}

export const useIntakeQueueStore = create<IntakeQueueState>((set, get) => ({
  items: [],
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const items = await buildQueueItems();
      set({ items, loading: false });
    } catch (error) {
      set({ loading: false });
      console.warn('[intakeQueueStore] failed to refresh', error);
    }
  },
  markTaken: async (scheduleId) => {
    const item = get().items.find((entry) => entry.scheduleId === scheduleId);
    if (!item || item.status === 'TAKEN') return;
    const previousStatus = item.status;

    set((state) => ({
      items: state.items.map((entry) => (entry.scheduleId === scheduleId ? { ...entry, status: 'TAKEN' } : entry)),
    }));

    try {
      await writeIntakeLog(item, 'TAKEN');
      // Stock just moved — the refill banner reads stale data otherwise.
      useSentinelStore.getState().refresh();
    } catch (error) {
      set((state) => ({
        items: state.items.map((entry) => (entry.scheduleId === scheduleId ? { ...entry, status: previousStatus } : entry)),
      }));
      console.warn('[intakeQueueStore] failed to record a taken dose, reverted optimistic update', error);
    }
  },
  markSkipped: async (scheduleId) => {
    const item = get().items.find((entry) => entry.scheduleId === scheduleId);
    if (!item) return;
    const previousStatus = item.status;

    set((state) => ({
      items: state.items.map((entry) => (entry.scheduleId === scheduleId ? { ...entry, status: 'MISSED' } : entry)),
    }));

    try {
      await writeIntakeLog(item, 'SKIPPED');
    } catch (error) {
      set((state) => ({
        items: state.items.map((entry) => (entry.scheduleId === scheduleId ? { ...entry, status: previousStatus } : entry)),
      }));
      console.warn('[intakeQueueStore] failed to record a skipped dose, reverted optimistic update', error);
    }
  },
}));

const TIME_NODE_META: Record<TimeNode, { label: string; labelBn: string }> = {
  FASTING: { label: 'Dawn Fasting', labelBn: 'খালি পেটে' },
  BREAKFAST: { label: 'Post-Breakfast', labelBn: 'সকালের নাশতা' },
  LUNCH: { label: 'Post-Lunch', labelBn: 'দুপুরের আহার' },
  DINNER: { label: 'Post-Dinner', labelBn: 'রাতের খাবার' },
  BEDTIME: { label: 'Bedtime Recovery', labelBn: 'ঘুমানোর আগে' },
};

const STATUS_TO_DOSE_STATE: Record<IntakeQueueStatus, DoseEntry['state']> = {
  TAKEN: 'taken',
  MISSED: 'missed',
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
};

/**
 * Adapts the live store to the exact shape `CircadianDashboardScreen`
 * already consumes (`UseDoseScheduleResult`/`DoseEntry`) — the Skia canvas
 * and dose-card components that shape was designed for don't change at all,
 * only where the data comes from does.
 */
export function useLiveDoseSchedule(): UseDoseScheduleResult {
  const items = useIntakeQueueStore((state) => state.items);
  const refresh = useIntakeQueueStore((state) => state.refresh);
  const storeMarkTaken = useIntakeQueueStore((state) => state.markTaken);
  const storeMarkSkipped = useIntakeQueueStore((state) => state.markSkipped);
  // Skip reasons were never persisted even in the fixed-demo version (no
  // schema column for free-text reason) — kept exactly as ephemeral,
  // client-side-only state here too, not a regression.
  const [skipReasons, setSkipReasons] = useState<Partial<Record<string, SkipReason>>>({});

  useEffect(() => {
    refresh().catch(() => {});
  }, [refresh]);

  const doses = useMemo<DoseEntry[]>(
    () =>
      items.map((item) => {
        const [hours, minutes] = item.timeUtc.split(':').map(Number);
        const meta = TIME_NODE_META[item.timeNode];
        return {
          id: String(item.scheduleId),
          label: meta.label,
          labelBn: meta.labelBn,
          hour: hours + minutes / 60,
          medicationName: item.medicationName,
          dosage: item.dosageLabel,
          interactionNote: item.instructions ?? 'No additional instructions recorded.',
          stockRemaining: item.stockRemaining,
          mealRelation: item.mealRelation,
          state: STATUS_TO_DOSE_STATE[item.status],
        };
      }),
    [items],
  );

  const markTaken = useCallback((id: string) => storeMarkTaken(Number(id)).catch(() => {}), [storeMarkTaken]);
  const markSkipped = useCallback(
    (id: string, reason: SkipReason) => {
      setSkipReasons((previous) => ({ ...previous, [id]: reason }));
      storeMarkSkipped(Number(id)).catch(() => {});
    },
    [storeMarkSkipped],
  );

  const adherenceRatio = doses.length === 0 ? 0 : doses.filter((dose) => dose.state === 'taken').length / doses.length;

  return { doses, skipReasons, adherenceRatio, markTaken, markSkipped };
}
