import { DrugSearchService } from '../db/services/drugSearchService';
import { initializeDatabase } from '../db';
import { matchDrugName } from './drugMatcher';
import type { DoseQuantity, DoseSchedule, MealRelation, MealTiming, ParsedPrescriptionItem, RegimenDuration } from './types';

const BENGALI_DIGITS: Record<string, string> = {
  '০': '0',
  '১': '1',
  '২': '2',
  '৩': '3',
  '৪': '4',
  '৫': '5',
  '৬': '6',
  '৭': '7',
  '৮': '8',
  '৯': '9',
};

/** ML Kit's on-device recognizer has no Bengali-script mode (see the note in prescriptionCameraView.tsx) — but once text reaches this parser, Bengali digits/words are handled natively. */
export function normalizeBengaliDigits(input: string): string {
  return input.replace(/[০-৯]/g, (digit) => BENGALI_DIGITS[digit] ?? digit);
}

const DOSE_SCHEDULE_RE = /(\d+)\s*[+-]\s*(\d+)\s*[+-]\s*(\d+)/;
const FRACTION_TABLET_RE = /(\d+)\s*\/\s*(\d+)\s*(?:ট্যাবলেট|tablets?|tabs?)?/i;
const SPOON_RE = /(\d+(?:\.\d+)?)\s*(?:চামচ|spoons?|tsp)/i;
const ML_RE = /(\d+(?:\.\d+)?)\s*(?:মিলি|ml)\b/i;
const DROP_RE = /(\d+(?:\.\d+)?)\s*(?:ফোঁটা|drops?)/i;
// No trailing `\b` on the Bengali alternatives: \b is a transition between a
// \w and non-\w character, and JS's default (non-Unicode-aware) \w is
// ASCII-only, so it doesn't reliably bound a Bengali script word the way it
// does a Latin one.
const STRENGTH_RE = /\d+(?:\.\d+)?\s*(?:mg|mcg|g|%)\b|\d+(?:\.\d+)?\s*(?:মিগ্রা|মিলিগ্রাম|গ্রাম)/gi;

const EMPTY_STOMACH_RE = /খালি\s*পেটে|empty\s*stomach/i;
const AFTER_MEAL_WITH_OFFSET_RE = /খাওয়ার\s*(\d+)\s*মিনিট\s*পর|(\d+)\s*min(?:ute)?s?\s*after\s*(?:meal|food)/i;
const BEFORE_MEAL_RE = /খাবার(?:ের)?\s*আগে|before\s*(?:meal|food)/i;
const AFTER_MEAL_RE = /খাবার(?:ের)?\s*পরে?|খাওয়ার\s*পর|after\s*(?:meal|food)/i;
const WITH_MEAL_RE = /খাবারের\s*সাথে|with\s*(?:meal|food)/i;

const ONGOING_RE = /চলবে|ongoing|continue/i;
const DAYS_RE = /(\d+)\s*(?:দিন|days?)/i;

/** Re-applies `re` as a fresh global regex so repeated `.replace()` calls across many lines never hit the shared-`lastIndex` footgun of reusing a stateful `g`-flagged RegExp literal. */
function stripAll(text: string, re: RegExp): string {
  const flags = re.flags.includes('g') ? re.flags : `${re.flags}g`;
  return text.replace(new RegExp(re.source, flags), ' ');
}

export function parseDoseSchedule(normalizedText: string): DoseSchedule | null {
  const match = normalizedText.match(DOSE_SCHEDULE_RE);
  if (!match) return null;
  return { morning: Number(match[1]), afternoon: Number(match[2]), night: Number(match[3]) };
}

export function parseDoseQuantity(normalizedText: string): DoseQuantity | null {
  const fraction = normalizedText.match(FRACTION_TABLET_RE);
  if (fraction) return { amount: Number(fraction[1]) / Number(fraction[2]), unit: 'tablet' };
  const spoon = normalizedText.match(SPOON_RE);
  if (spoon) return { amount: Number(spoon[1]), unit: 'spoon' };
  const ml = normalizedText.match(ML_RE);
  if (ml) return { amount: Number(ml[1]), unit: 'ml' };
  const drop = normalizedText.match(DROP_RE);
  if (drop) return { amount: Number(drop[1]), unit: 'drop' };
  return null;
}

export function parseMealRelation(normalizedText: string): MealRelation | null {
  if (EMPTY_STOMACH_RE.test(normalizedText)) {
    return { timing: 'EMPTY_STOMACH', offsetMinutes: null };
  }
  const withOffset = normalizedText.match(AFTER_MEAL_WITH_OFFSET_RE);
  if (withOffset) {
    return { timing: 'AFTER', offsetMinutes: Number(withOffset[1] ?? withOffset[2]) };
  }
  if (BEFORE_MEAL_RE.test(normalizedText)) {
    return { timing: 'BEFORE', offsetMinutes: null };
  }
  if (AFTER_MEAL_RE.test(normalizedText)) {
    return { timing: 'AFTER', offsetMinutes: null };
  }
  if (WITH_MEAL_RE.test(normalizedText)) {
    return { timing: 'WITH', offsetMinutes: null };
  }
  return null;
}

export function parseDuration(normalizedText: string): RegimenDuration | null {
  if (ONGOING_RE.test(normalizedText)) {
    return { days: null, isOngoing: true };
  }
  const daysMatch = normalizedText.match(DAYS_RE);
  if (daysMatch) {
    return { days: Number(daysMatch[1]), isOngoing: false };
  }
  return null;
}

const STRIP_FOR_NAME_RES = [
  DOSE_SCHEDULE_RE,
  FRACTION_TABLET_RE,
  SPOON_RE,
  ML_RE,
  DROP_RE,
  STRENGTH_RE,
  AFTER_MEAL_WITH_OFFSET_RE,
  EMPTY_STOMACH_RE,
  BEFORE_MEAL_RE,
  AFTER_MEAL_RE,
  WITH_MEAL_RE,
  ONGOING_RE,
  DAYS_RE,
];

/** Whatever's left of a line after every recognized dosage/meal/duration token is stripped out — the drug-name candidate. */
export function extractDrugNameFragment(normalizedText: string): string {
  let remainder = normalizedText;
  for (const re of STRIP_FOR_NAME_RES) {
    remainder = stripAll(remainder, re);
  }
  return remainder
    .replace(/[-–—:|,،।]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

interface ExtractedLine {
  rawLine: string;
  drugNameRaw: string;
  doseSchedule: DoseSchedule | null;
  doseQuantity: DoseQuantity | null;
  mealRelation: MealRelation | null;
  duration: RegimenDuration | null;
}

/**
 * Splits raw OCR text into per-drug items. Prescriptions come in two common
 * shapes: drug name and dosage on the same line ("Napa 500mg - 1+0+1 - After
 * meal - 7 days"), or drug name on its own line followed by a dosage-only
 * line. This handles both with one rule: a name-only line is held and
 * merged into the next line if that next line is dosage-only. It is a
 * documented heuristic, not an NLP layout model — a prescription with dosage
 * before the name, or multiple drugs crammed onto one line, won't split
 * correctly.
 */
function extractLines(rawText: string): ExtractedLine[] {
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const extracted: ExtractedLine[] = [];
  let pendingDrugName: string | null = null;

  for (const rawLine of lines) {
    const normalized = normalizeBengaliDigits(rawLine);
    const doseSchedule = parseDoseSchedule(normalized);
    const doseQuantity = parseDoseQuantity(normalized);
    const mealRelation = parseMealRelation(normalized);
    const duration = parseDuration(normalized);
    const hasDosageInfo = doseSchedule !== null || doseQuantity !== null || mealRelation !== null || duration !== null;
    const drugNameFragment = extractDrugNameFragment(normalized);

    if (!drugNameFragment && hasDosageInfo && pendingDrugName) {
      extracted.push({
        rawLine: `${pendingDrugName}\n${rawLine}`,
        drugNameRaw: pendingDrugName,
        doseSchedule,
        doseQuantity,
        mealRelation,
        duration,
      });
      pendingDrugName = null;
      continue;
    }

    if (drugNameFragment && !hasDosageInfo) {
      pendingDrugName = drugNameFragment;
      continue;
    }

    if (drugNameFragment && hasDosageInfo) {
      extracted.push({ rawLine, drugNameRaw: drugNameFragment, doseSchedule, doseQuantity, mealRelation, duration });
      pendingDrugName = null;
    }
  }

  return extracted;
}

/**
 * Parses raw OCR text from a prescription or blister pack into structured,
 * drug-database-matched items. Async because drug-name resolution (step 2)
 * queries the local SQLCipher FTS5 `drug_directory` — the regex extraction
 * itself (step 1) is fully synchronous and independently testable via the
 * exported `parseDoseSchedule`/`parseMealRelation`/etc. functions.
 *
 * `drugSearch` is injectable for tests; omitted, it uses the app's shared
 * database singleton.
 */
export async function parsePrescriptionText(
  rawText: string,
  drugSearch?: DrugSearchService,
): Promise<ParsedPrescriptionItem[]> {
  const lines = extractLines(rawText);
  if (lines.length === 0) return [];

  const service = drugSearch ?? (await initializeDatabase()).drugSearch;

  return Promise.all(
    lines.map(async (line): Promise<ParsedPrescriptionItem> => {
      const { matchedDrug, confidence, autoMapped } = await matchDrugName(line.drugNameRaw, service);
      return {
        ...line,
        matchedDrug,
        matchConfidence: confidence,
        autoMapped,
        confidenceTier: confidence >= 70 ? 'high' : confidence >= 40 ? 'medium' : 'low',
      };
    }),
  );
}

const MEAL_TIMING_LABEL: Record<MealTiming, string> = {
  BEFORE: 'Before food',
  AFTER: 'After food',
  WITH: 'With food',
  EMPTY_STOMACH: 'Empty stomach',
};

/** Renders a parsed item's structured fields back into one editable summary line, for the review UI. */
export function summarizeDosage(item: Pick<ParsedPrescriptionItem, 'doseSchedule' | 'doseQuantity' | 'mealRelation' | 'duration'>): string {
  const parts: string[] = [];
  if (item.doseSchedule) {
    const { morning, afternoon, night } = item.doseSchedule;
    parts.push(`${morning}+${afternoon}+${night}`);
  }
  if (item.doseQuantity) {
    parts.push(`${item.doseQuantity.amount} ${item.doseQuantity.unit}`);
  }
  if (item.mealRelation) {
    const label = MEAL_TIMING_LABEL[item.mealRelation.timing];
    parts.push(item.mealRelation.offsetMinutes ? `${label} (${item.mealRelation.offsetMinutes}m)` : label);
  }
  if (item.duration) {
    parts.push(item.duration.isOngoing ? 'Ongoing' : `${item.duration.days} days`);
  }
  return parts.join(' · ');
}
