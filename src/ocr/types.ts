import type { DrugSearchResult } from '../db/types';

export type MealTiming = 'BEFORE' | 'AFTER' | 'WITH' | 'EMPTY_STOMACH';

export type DoseUnit = 'tablet' | 'spoon' | 'ml' | 'drop';

/** Classic South Asian morning+afternoon+night shorthand: "1+0+1", "১+১+১". */
export interface DoseSchedule {
  morning: number;
  afternoon: number;
  night: number;
}

/** A measured dose that isn't a morning/afternoon/night triplet: "1/2 tablet", "2 চামচ", "10ml". */
export interface DoseQuantity {
  amount: number;
  unit: DoseUnit;
}

export interface MealRelation {
  timing: MealTiming;
  /** Minutes offset from the meal, when stated, e.g. "খাওয়ার ৩০ মিনিট পর" -> 30. */
  offsetMinutes: number | null;
}

export interface RegimenDuration {
  days: number | null;
  isOngoing: boolean;
}

export type ConfidenceTier = 'high' | 'medium' | 'low';

export interface ParsedPrescriptionItem {
  /** The OCR line(s) this item was extracted from, for human review/debugging. */
  rawLine: string;
  /** The drug-name fragment left after stripping dosage/meal/duration tokens from the line. */
  drugNameRaw: string;
  doseSchedule: DoseSchedule | null;
  doseQuantity: DoseQuantity | null;
  mealRelation: MealRelation | null;
  duration: RegimenDuration | null;
  /** Best FTS5/fuzzy candidate from the local drug_directory, regardless of confidence — null only if the search found nothing at all. */
  matchedDrug: DrugSearchResult | null;
  /** 0-100, how closely matchedDrug's name matches drugNameRaw (edit-distance based, not the search engine's own ranking score). */
  matchConfidence: number;
  /** true once matchConfidence >= the auto-map threshold — see drugMatcher.ts. */
  autoMapped: boolean;
  confidenceTier: ConfidenceTier;
}
