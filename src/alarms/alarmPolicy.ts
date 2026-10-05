/** Spec requirement: strictly prohibit infinite deferral. */
export const MAX_SNOOZES = 2;
export const SNOOZE_DURATION_MS = 5 * 60 * 1000;
export const ESCALATION_TIMEOUT_MS = 15 * 60 * 1000;
/** How long a held "emergency silence" press must be sustained before it counts — long enough that it can't be triggered by an accidental touch, short enough to still be usable under duress. */
export const OVERRIDE_HOLD_MS = 10 * 1000;

export function canSnooze(snoozeCount: number): boolean {
  return snoozeCount < MAX_SNOOZES;
}

export function remainingSnoozes(snoozeCount: number): number {
  return Math.max(0, MAX_SNOOZES - snoozeCount);
}

export function nextSnoozeTimestamp(fromMs: number): number {
  return fromMs + SNOOZE_DURATION_MS;
}

export function isPastEscalationDeadline(firedAtMs: number, nowMs: number): boolean {
  return nowMs - firedAtMs >= ESCALATION_TIMEOUT_MS;
}

export function msUntilEscalation(firedAtMs: number, nowMs: number): number {
  return Math.max(0, ESCALATION_TIMEOUT_MS - (nowMs - firedAtMs));
}

export function formatCountdown(ms: number): string {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
