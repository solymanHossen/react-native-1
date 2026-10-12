import { buildMedicationReminderMessage } from '../src/alarms/voiceAnnouncement';
import type { ScheduledAlarmPayload } from '../src/alarms/types';

const MORNING = new Date(2026, 0, 1, 8, 0, 0);
const EVENING = new Date(2026, 0, 1, 19, 0, 0);

function payload(overrides: Partial<ScheduledAlarmPayload> = {}): ScheduledAlarmPayload {
  return {
    scheduleId: 1,
    medicationId: 1,
    medicationName: 'Paracetamol',
    medicationStrength: '500 mg',
    dosageLabel: '1 tablet',
    doseQuantity: 1,
    mealRelation: 'WITH',
    nfcTagUid: null,
    scheduledAtMs: MORNING.getTime(),
    title: null,
    ...overrides,
  };
}

describe('buildMedicationReminderMessage', () => {
  it('speaks the full message for a complete English record', () => {
    const message = buildMedicationReminderMessage(payload(), 'en', MORNING);
    expect(message).toBe('Good morning. It is time for your scheduled medicine. Please take 1 tablet of Paracetamol 500 mg, with food.');
  });

  it('omits the strength naturally when none was ever recorded, instead of printing "null"', () => {
    const message = buildMedicationReminderMessage(payload({ medicationStrength: null }), 'en', MORNING);
    expect(message).toContain('of Paracetamol, with food');
    expect(message).not.toMatch(/null|undefined/i);
  });

  it('omits the meal clause for MINUTES_OFFSET rather than guessing at the actual interval', () => {
    const message = buildMedicationReminderMessage(payload({ mealRelation: 'MINUTES_OFFSET' }), 'en', MORNING);
    expect(message).toBe('Good morning. It is time for your scheduled medicine. Please take 1 tablet of Paracetamol 500 mg.');
    expect(message).not.toMatch(/null|undefined/i);
  });

  it('covers every meal relation with a distinct, correctly-placed English phrase', () => {
    expect(buildMedicationReminderMessage(payload({ mealRelation: 'BEFORE' }), 'en', MORNING)).toContain('Paracetamol 500 mg, before food.');
    expect(buildMedicationReminderMessage(payload({ mealRelation: 'WITH' }), 'en', MORNING)).toContain('Paracetamol 500 mg, with food.');
    expect(buildMedicationReminderMessage(payload({ mealRelation: 'AFTER' }), 'en', MORNING)).toContain('Paracetamol 500 mg, after food.');
  });

  it('greets appropriately for the hour the alarm actually fires', () => {
    expect(buildMedicationReminderMessage(payload(), 'en', MORNING)).toMatch(/^Good morning\./);
    expect(buildMedicationReminderMessage(payload(), 'en', EVENING)).toMatch(/^Good evening\./);
  });

  it('builds a grammatically distinct Bengali sentence, not the English template re-keyed', () => {
    const message = buildMedicationReminderMessage(payload(), 'bn', MORNING);
    expect(message).toBe('শুভ সকাল। আপনার নির্ধারিত ওষুধ খাওয়ার সময় হয়েছে। অনুগ্রহ করে Paracetamol 500 mg-এর 1 tablet খাবারের সাথে খান।');
  });

  it('omits the Bengali meal clause for MINUTES_OFFSET too, with no stray double space', () => {
    const message = buildMedicationReminderMessage(payload({ mealRelation: 'MINUTES_OFFSET' }), 'bn', MORNING);
    expect(message).toBe('শুভ সকাল। আপনার নির্ধারিত ওষুধ খাওয়ার সময় হয়েছে। অনুগ্রহ করে Paracetamol 500 mg-এর 1 tablet খান।');
  });

  it('never speaks the user-typed custom alarm title in place of the real medication name', () => {
    const message = buildMedicationReminderMessage(payload({ title: 'My morning pill' }), 'en', MORNING);
    expect(message).toContain('Paracetamol');
    expect(message).not.toContain('My morning pill');
  });
});
