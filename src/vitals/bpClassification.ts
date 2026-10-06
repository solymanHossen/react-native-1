/**
 * 2017 ACC/AHA blood pressure categories. Checked most-severe-first so each
 * rule only has to guard against the ones above it rather than restate every
 * boundary — e.g. by the time ELEVATED is reached, diastolic < 80 is already
 * guaranteed (an 80+ diastolic would have matched STAGE_1 or STAGE_2 first).
 */
export type BloodPressureStage = 'NORMAL' | 'ELEVATED' | 'STAGE_1' | 'STAGE_2' | 'CRISIS';

export interface BloodPressureClassification {
  stage: BloodPressureStage;
  label: string;
  color: string;
  /** Crisis-range readings need same-day medical attention, not just a logged data point. */
  urgent: boolean;
}

const STAGE_INFO: Record<BloodPressureStage, Omit<BloodPressureClassification, 'stage'>> = {
  NORMAL: { label: 'Normal', color: '#2ECC71', urgent: false },
  ELEVATED: { label: 'Elevated', color: '#FFA502', urgent: false },
  STAGE_1: { label: 'Hypertension Stage 1', color: '#FF8C42', urgent: false },
  STAGE_2: { label: 'Hypertension Stage 2', color: '#FF6B6B', urgent: false },
  CRISIS: { label: 'Hypertensive Crisis', color: '#B00020', urgent: true },
};

function resolveStage(systolic: number, diastolic: number): BloodPressureStage {
  if (systolic > 180 || diastolic > 120) return 'CRISIS';
  if (systolic >= 140 || diastolic >= 90) return 'STAGE_2';
  if (systolic >= 130 || diastolic >= 80) return 'STAGE_1';
  if (systolic >= 120) return 'ELEVATED';
  return 'NORMAL';
}

export function classifyBloodPressure(systolic: number, diastolic: number): BloodPressureClassification {
  const stage = resolveStage(systolic, diastolic);
  return { stage, ...STAGE_INFO[stage] };
}
