import { rescheduleAllActiveAlarms } from './alarmScheduler';

/**
 * Registered as a Headless JS task in index.js (not here — headless tasks
 * must be registered at the JS entry point, before any screen renders, so
 * they're reachable even when the native boot receiver starts this task
 * without ever opening a React Native Activity). The receiver passes no
 * useful data; this task's only job is "re-read the DB and reschedule
 * everything," which is also exactly what `initializeAlarmSystem` already
 * does on every normal app launch.
 */
export default async function bootRescheduleTask(): Promise<void> {
  await rescheduleAllActiveAlarms();
}
