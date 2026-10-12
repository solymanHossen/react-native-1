import { bn } from '../i18n/bn';
import { en } from '../i18n/en';
import type { LanguageCode } from '../i18n/useLanguage';
import type { ScheduledAlarmPayload } from './types';

function greetingWord(hour: number, language: LanguageCode): string {
  const dictionary = language === 'bn' ? bn : en;
  if (hour < 5) return dictionary.home.greetingNight;
  if (hour < 12) return dictionary.home.greetingMorning;
  if (hour < 17) return dictionary.home.greetingAfternoon;
  return dictionary.home.greetingEvening;
}

/**
 * Short, mid-sentence meal phrases distinct from the app's UI labels
 * ("Before food" reads fine as a button; "before food" is what actually
 * fits spoken into "please take it before food"). `MINUTES_OFFSET` has no
 * generic phrase that wouldn't misstate the prescribed interval, so it's
 * omitted from the announcement entirely rather than guessed at — the
 * notification/AlarmScreen text still shows the full instruction.
 */
function mealPhrase(relation: ScheduledAlarmPayload['mealRelation'], language: LanguageCode): string | null {
  if (language === 'bn') {
    if (relation === 'BEFORE') return 'খাবারের আগে';
    if (relation === 'WITH') return 'খাবারের সাথে';
    if (relation === 'AFTER') return 'খাবারের পরে';
    return null;
  }
  if (relation === 'BEFORE') return 'before food';
  if (relation === 'WITH') return 'with food';
  if (relation === 'AFTER') return 'after food';
  return null;
}

/**
 * Builds the sentence spoken aloud when an alarm fires, from verified,
 * already-persisted schedule/medication data only — never from the medicine
 * name alone, and never inventing a dose, strength, or instruction that
 * wasn't actually recorded. A missing strength or unresolvable meal relation
 * is omitted from the sentence rather than read as "null"/"undefined".
 *
 * English and Bengali are built as two genuinely different sentence
 * structures (English appends the meal clause after the dose; Bengali's
 * verb-final word order needs it before "খান"), not one template mechanically
 * reused across languages — a single shared template reads naturally in at
 * most one of the two.
 *
 * The custom alarm title (`payload.title`, see AlarmsScreen's ReminderSheet)
 * is deliberately NOT used here, for the same reason AlarmScreen always
 * keeps the real medication name as its headline regardless of a custom
 * title: the thing a patient needs to hear and verify is what they're
 * actually about to take, not a label they typed in themselves.
 */
export function buildMedicationReminderMessage(payload: ScheduledAlarmPayload, language: LanguageCode, now: Date = new Date()): string {
  const greeting = greetingWord(now.getHours(), language);
  const medicineLabel = payload.medicationStrength ? `${payload.medicationName} ${payload.medicationStrength}` : payload.medicationName;
  const meal = mealPhrase(payload.mealRelation, language);

  if (language === 'bn') {
    const mealClause = meal ? `${meal} ` : '';
    return `${greeting}। আপনার নির্ধারিত ওষুধ খাওয়ার সময় হয়েছে। অনুগ্রহ করে ${medicineLabel}-এর ${payload.dosageLabel} ${mealClause}খান।`;
  }

  const mealClause = meal ? `, ${meal}` : '';
  return `${greeting}. It is time for your scheduled medicine. Please take ${payload.dosageLabel} of ${medicineLabel}${mealClause}.`;
}
