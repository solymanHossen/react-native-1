export type DosageForm = 'tablet' | 'syrup' | 'capsule' | 'injection' | 'drop';

export type TimeNode = 'FASTING' | 'BREAKFAST' | 'LUNCH' | 'DINNER' | 'BEDTIME';

export type MealRelation = 'BEFORE' | 'WITH' | 'AFTER' | 'MINUTES_OFFSET';

export type IntakeStatus = 'TAKEN' | 'SKIPPED' | 'MISSED';

export type DismissalType = 'NFC' | 'VISION' | 'MANUAL_OVERRIDE';

export type VitalType = 'BP_SYS' | 'BP_DIA' | 'BLOOD_SUGAR' | 'WEIGHT' | 'PULSE' | 'TEMPERATURE';

/** One row of the `drug_directory` FTS5 index. `rowid` is SQLite's implicit FTS5 row id. */
export interface DrugDirectoryEntry {
  rowid: number;
  brand_name: string;
  generic_name: string;
  strength: string;
  dosage_form: DosageForm | string;
  manufacturer: string;
  indications: string;
  food_instructions: string;
  /** Raw JSON string, e.g. `["warfarin","aspirin"]`. Parse with `parseHighRiskInteractions`. */
  high_risk_interactions_json: string;
}

export interface DrugSearchResult extends DrugDirectoryEntry {
  /** Lower is a better match. FTS5 `rank` for the FTS branch; a 0-1 fuzzy distance score for the fuzzy-fallback branch. */
  score: number;
  matchType: 'fts' | 'fuzzy';
}

export interface Medication {
  id: number;
  name: string;
  /** Conventionally a `drug_directory.rowid`, not a declared FK — see schema.ts for why. */
  generic_id: number | null;
  strength: string | null;
  form: DosageForm;
  current_stock: number;
  refill_threshold: number;
  expiry_date: string | null;
  instructions: string | null;
  nfc_tag_uid: string | null;
}

export type NewMedication = Omit<Medication, 'id'>;

export interface Schedule {
  id: number;
  medication_id: number;
  time_utc: string;
  time_node: TimeNode;
  meal_relation: MealRelation;
  dose_quantity: number;
  /** Bitmask, bit 0 = Sunday ... bit 6 = Saturday. */
  days_of_week_mask: number;
  is_active: boolean;
}

export type NewSchedule = Omit<Schedule, 'id'>;

export interface IntakeLog {
  id: number;
  schedule_id: number;
  scheduled_time: string;
  taken_time: string | null;
  status: IntakeStatus;
  dismissal_type: DismissalType | null;
  caregiver_alerted: boolean;
}

export type NewIntakeLog = Omit<IntakeLog, 'id'>;

export interface Vital {
  id: number;
  timestamp: string;
  type: VitalType;
  value: number;
  unit: string;
  notes: string | null;
}

export type NewVital = Omit<Vital, 'id'>;

/** One entry of a `drug_directory.high_risk_interactions_json` array. */
export interface HighRiskInteraction {
  /** Generic name of the interacting substance, matched case-insensitively. */
  generic: string;
  severity: 'moderate' | 'severe' | 'contraindicated';
  description: string;
}

export interface DrugConflict {
  /** The generic name already in an active regimen that conflicts with the candidate. */
  conflictingGeneric: string;
  /** The medication row that introduced the existing conflicting regimen. */
  medicationId: number;
  medicationName: string;
  severity: HighRiskInteraction['severity'];
  description: string;
}

export function parseHighRiskInteractions(json: string): HighRiskInteraction[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is HighRiskInteraction =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as HighRiskInteraction).generic === 'string' &&
        typeof (item as HighRiskInteraction).severity === 'string' &&
        typeof (item as HighRiskInteraction).description === 'string',
    );
  } catch {
    return [];
  }
}
