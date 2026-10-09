import type { StatusKey } from '../theme/tokens';
import type { MealRelation } from '../db/types';

/**
 * Reuses the app's existing 5-state status vocabulary instead of inventing a
 * parallel palette: 'taken'/'pending'/'missed'/'scheduled' already have
 * WCAG-verified colors and text pairings (see theme/tokens.ts). 'pending' is
 * this feature's "imminent" state and 'scheduled' is "upcoming" — same
 * meaning, same token, no new colors to verify.
 */
export type DoseState = Extract<StatusKey, 'taken' | 'pending' | 'missed' | 'scheduled'>;

export interface CircadianZone {
  id: string;
  /** English zone label, e.g. "Dawn Fasting". */
  label: string;
  /** Bengali zone label, e.g. "খালি পেটে". */
  labelBn: string;
  /** 24-hour decimal hour the zone is anchored to on the wave, e.g. 20.5 for 8:30 PM. */
  hour: number;
  medicationName: string;
  dosage: string;
  /** Plain-language interaction/stock note shown in the long-press detail sheet. */
  interactionNote: string;
  stockRemaining: number;
  mealRelation: MealRelation;
}

export interface DoseEntry extends CircadianZone {
  state: DoseState;
}

export const SKIP_REASONS = ['Feeling better', 'Side effects', 'Forgot dose', 'Out of stock', 'Doctor advised'] as const;

export type SkipReason = (typeof SKIP_REASONS)[number];

export interface UseDoseScheduleResult {
  doses: DoseEntry[];
  skipReasons: Partial<Record<string, SkipReason>>;
  adherenceRatio: number;
  markTaken: (id: string) => void;
  markSkipped: (id: string, reason: SkipReason) => void;
}
