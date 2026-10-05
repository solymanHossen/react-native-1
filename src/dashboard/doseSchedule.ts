import { useCallback, useMemo, useState } from 'react';
import type { CircadianZone, DoseEntry, DoseState, SkipReason } from './types';

/** Fixed demo regimen — see DrugLabScreen for the same "no live DB" convention this screen follows. */
export const CIRCADIAN_ZONES: CircadianZone[] = [
  {
    id: 'dawn-fasting',
    label: 'Dawn Fasting',
    labelBn: 'খালি পেটে',
    hour: 6,
    medicationName: 'Metformin 500mg',
    dosage: '1 tablet',
    interactionNote: 'Take on an empty stomach. No interactions with current regimen.',
    stockRemaining: 18,
  },
  {
    id: 'post-breakfast',
    label: 'Post-Breakfast',
    labelBn: 'সকালের নাশতা',
    hour: 8.5,
    medicationName: 'Atorvastatin 10mg',
    dosage: '1 tablet',
    interactionNote: 'Avoid grapefruit juice within 2 hours of this dose.',
    stockRemaining: 24,
  },
  {
    id: 'post-lunch',
    label: 'Post-Lunch',
    labelBn: 'দুপুরের আহার',
    hour: 14,
    medicationName: 'Amlodipine 5mg',
    dosage: '1 tablet',
    interactionNote: 'May cause mild dizziness — avoid standing up too quickly.',
    stockRemaining: 9,
  },
  {
    id: 'post-dinner',
    label: 'Post-Dinner',
    labelBn: 'রাতের খাবার',
    hour: 20.5,
    medicationName: 'Metformin 500mg',
    dosage: '1 tablet',
    interactionNote: 'Second daily dose. No interactions with current regimen.',
    stockRemaining: 18,
  },
  {
    id: 'bedtime-recovery',
    label: 'Bedtime Recovery',
    labelBn: 'ঘুমানোর আগে',
    hour: 23,
    medicationName: 'Escitalopram 10mg',
    dosage: '1 tablet',
    interactionNote: 'Caution: sedative effect may combine with alcohol.',
    stockRemaining: 5,
  },
];

/** A dose within ±1h of now and not yet acted on reads as 'pending' (imminent); further than 1h past due reads as 'missed' until manually marked. */
function deriveBaseState(hour: number, nowHour: number): DoseState {
  const diff = hour - nowHour;
  if (diff < -1) return 'missed';
  if (diff <= 1) return 'pending';
  return 'scheduled';
}

export interface UseDoseScheduleResult {
  doses: DoseEntry[];
  skipReasons: Partial<Record<string, SkipReason>>;
  adherenceRatio: number;
  markTaken: (id: string) => void;
  markSkipped: (id: string, reason: SkipReason) => void;
}

/**
 * Local interactive state only, no persistence/DB — this screen is a
 * self-contained showcase of the gesture/canvas interactions, same "demo
 * regimen, not real patient data" convention as DrugLabScreen.
 */
export function useDoseSchedule(): UseDoseScheduleResult {
  const [overrides, setOverrides] = useState<Partial<Record<string, DoseState>>>({});
  const [skipReasons, setSkipReasons] = useState<Partial<Record<string, SkipReason>>>({});
  const nowHour = useMemo(() => {
    const now = new Date();
    return now.getHours() + now.getMinutes() / 60;
  }, []);

  const doses = useMemo<DoseEntry[]>(
    () =>
      CIRCADIAN_ZONES.map((zone) => ({
        ...zone,
        state: overrides[zone.id] ?? deriveBaseState(zone.hour, nowHour),
      })),
    [overrides, nowHour],
  );

  const markTaken = useCallback((id: string) => {
    setOverrides((prev) => ({ ...prev, [id]: 'taken' }));
  }, []);

  const markSkipped = useCallback((id: string, reason: SkipReason) => {
    setOverrides((prev) => ({ ...prev, [id]: 'missed' }));
    setSkipReasons((prev) => ({ ...prev, [id]: reason }));
  }, []);

  const adherenceRatio = useMemo(() => doses.filter((dose) => dose.state === 'taken').length / doses.length, [doses]);

  return { doses, skipReasons, adherenceRatio, markTaken, markSkipped };
}
