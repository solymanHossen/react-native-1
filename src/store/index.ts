/**
 * Centralized reactive state — one import surface for the four things the
 * app's screens actually need to stay in sync on: today's intake queue, the
 * refill/expiry sentinel, the latest vitals readings, and the currently-
 * ringing alarm (if any).
 *
 * The active-alarm store already lived in `alarms/activeAlarmStore.ts`
 * before this module existed and is re-exported rather than merged in here
 * — it's tested, working, and represents a genuinely different kind of
 * state (ephemeral runtime UI for one in-progress alarm) from the three
 * query-backed, DB-synced stores below. Re-exporting it means every screen
 * can still reach all four pieces of coordinated state from one place
 * without risking the alarm engine's own working code.
 */
export { useIntakeQueueStore, useLiveDoseSchedule, type IntakeQueueItem, type IntakeQueueStatus } from './intakeQueueStore';
export { useSentinelStore } from './sentinelStore';
export { useVitalsStore, type LatestVitals } from './vitalsStore';
export { useActiveAlarmStore } from '../alarms';

import { useIntakeQueueStore } from './intakeQueueStore';
import { useSentinelStore } from './sentinelStore';
import { useVitalsStore } from './vitalsStore';

/** Called once from App.tsx on mount, after `initializeAlarmSystem()` — primes all three query-backed stores so the first screen a user lands on already has real data instead of an empty/loading flash. */
export function refreshAllStores(): Promise<void[]> {
  return Promise.all([
    useIntakeQueueStore.getState().refresh(),
    useSentinelStore.getState().refresh(),
    useVitalsStore.getState().refresh(),
  ]);
}
