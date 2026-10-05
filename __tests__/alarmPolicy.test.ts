import {
  canSnooze,
  ESCALATION_TIMEOUT_MS,
  formatCountdown,
  isPastEscalationDeadline,
  MAX_SNOOZES,
  msUntilEscalation,
  nextSnoozeTimestamp,
  remainingSnoozes,
  SNOOZE_DURATION_MS,
} from '../src/alarms/alarmPolicy';

describe('Alarm anti-snooze and escalation policy', () => {
  it('allows snoozing until the 2-snooze ceiling, then refuses', () => {
    expect(canSnooze(0)).toBe(true);
    expect(canSnooze(1)).toBe(true);
    expect(canSnooze(MAX_SNOOZES)).toBe(false);
    expect(canSnooze(MAX_SNOOZES + 1)).toBe(false);
  });

  it('reports remaining snoozes counting down to zero, never negative', () => {
    expect(remainingSnoozes(0)).toBe(2);
    expect(remainingSnoozes(1)).toBe(1);
    expect(remainingSnoozes(2)).toBe(0);
    expect(remainingSnoozes(5)).toBe(0);
  });

  it('schedules the next snooze exactly 5 minutes out', () => {
    const now = 1_700_000_000_000;
    expect(nextSnoozeTimestamp(now)).toBe(now + SNOOZE_DURATION_MS);
    expect(SNOOZE_DURATION_MS).toBe(5 * 60 * 1000);
  });

  it('does not consider an alarm past deadline before 15 minutes elapse', () => {
    const firedAt = 1_700_000_000_000;
    expect(isPastEscalationDeadline(firedAt, firedAt)).toBe(false);
    expect(isPastEscalationDeadline(firedAt, firedAt + ESCALATION_TIMEOUT_MS - 1)).toBe(false);
  });

  it('considers an alarm past deadline at and after exactly 15 minutes', () => {
    const firedAt = 1_700_000_000_000;
    expect(isPastEscalationDeadline(firedAt, firedAt + ESCALATION_TIMEOUT_MS)).toBe(true);
    expect(isPastEscalationDeadline(firedAt, firedAt + ESCALATION_TIMEOUT_MS + 60_000)).toBe(true);
  });

  it('counts down the remaining time to escalation and floors at zero', () => {
    const firedAt = 1_700_000_000_000;
    expect(msUntilEscalation(firedAt, firedAt)).toBe(ESCALATION_TIMEOUT_MS);
    expect(msUntilEscalation(firedAt, firedAt + 60_000)).toBe(ESCALATION_TIMEOUT_MS - 60_000);
    expect(msUntilEscalation(firedAt, firedAt + ESCALATION_TIMEOUT_MS + 60_000)).toBe(0);
  });

  it('formats a countdown as M:SS, rounding up to the next full second', () => {
    expect(formatCountdown(0)).toBe('0:00');
    expect(formatCountdown(1)).toBe('0:01');
    expect(formatCountdown(59_000)).toBe('0:59');
    expect(formatCountdown(60_000)).toBe('1:00');
    expect(formatCountdown(15 * 60 * 1000)).toBe('15:00');
  });
});
