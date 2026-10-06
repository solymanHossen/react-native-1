import type { PatientProfile } from '../profile/patientProfile';

export interface ReportMedicationSchedule {
  timeUtc: string;
  doseQuantity: number;
  timeNode: string;
  mealRelation: string;
}

export interface ReportMedication {
  name: string;
  strength: string | null;
  form: string;
  instructions: string | null;
  schedules: ReportMedicationSchedule[];
}

export interface ReportAdherence {
  periodDays: number;
  takenCount: number;
  missedCount: number;
  skippedCount: number;
  /** Taken / (Taken + Missed), rounded. Skipped (manual overrides) count toward neither side — they were never verified either way. */
  percent: number;
}

export interface ReportBloodPressureReading {
  timestamp: string;
  systolic: number;
  diastolic: number;
  stageLabel: string;
}

export interface ReportGlucoseReading {
  timestamp: string;
  value: number;
  unit: string;
  context: string | null;
}

export interface ReportSymptomEntry {
  timestamp: string;
  symptom: string;
  severity: string;
  notes: string | null;
  suspectMedications: string[];
}

export interface ClinicalReportData {
  generatedAtIso: string;
  patient: PatientProfile;
  medications: ReportMedication[];
  adherence: ReportAdherence;
  bloodPressureReadings: ReportBloodPressureReading[];
  glucoseReadings: ReportGlucoseReading[];
  symptoms: ReportSymptomEntry[];
}
