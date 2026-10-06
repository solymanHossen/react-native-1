import { initializeDatabase } from '../db';
import { getPatientProfile } from '../profile/patientProfile';
import { classifyBloodPressure } from '../vitals/bpClassification';
import type { ClinicalReportData, ReportMedication } from './reportTypes';

const REPORT_PERIOD_DAYS = 30;

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * Pulls every section the clinical PDF needs into one plain data object,
 * independent of the HTML template — so the template can be unit-tested (or
 * swapped) without touching the database, and the database queries can be
 * exercised without rendering HTML.
 */
export async function buildClinicalReportData(): Promise<ClinicalReportData> {
  const database = await initializeDatabase();
  const sinceIso = isoDaysAgo(REPORT_PERIOD_DAYS);

  const [activeSchedules, allMedications, intakeRows, bpSystolic, bpDiastolic, glucoseRows, recentSymptoms] = await Promise.all([
    database.schedules.listActiveWithMedication(),
    database.medications.list(),
    database.intakeLogs.listSince(sinceIso),
    database.vitals.listByTypeSince('BP_SYS', sinceIso),
    database.vitals.listByTypeSince('BP_DIA', sinceIso),
    database.vitals.listByTypeSince('BLOOD_SUGAR', sinceIso),
    database.symptoms.listRecent(200),
  ]);

  // Group active schedules by medication, then fill in the strength/
  // instructions fields `ScheduleWithMedication` doesn't carry.
  const medicationById = new Map(allMedications.map((medication) => [medication.id, medication]));
  const medicationsMap = new Map<number, ReportMedication>();
  for (const schedule of activeSchedules) {
    if (!medicationsMap.has(schedule.medication_id)) {
      const medication = medicationById.get(schedule.medication_id);
      medicationsMap.set(schedule.medication_id, {
        name: schedule.medicationName,
        strength: medication?.strength ?? null,
        form: schedule.medicationForm,
        instructions: medication?.instructions ?? null,
        schedules: [],
      });
    }
    medicationsMap.get(schedule.medication_id)!.schedules.push({
      timeUtc: schedule.time_utc,
      doseQuantity: schedule.dose_quantity,
      timeNode: schedule.time_node,
      mealRelation: schedule.meal_relation,
    });
  }

  const takenCount = intakeRows.filter((row) => row.status === 'TAKEN').length;
  const missedCount = intakeRows.filter((row) => row.status === 'MISSED').length;
  const skippedCount = intakeRows.filter((row) => row.status === 'SKIPPED').length;
  const verifiedTotal = takenCount + missedCount;
  const percent = verifiedTotal === 0 ? 0 : Math.round((takenCount / verifiedTotal) * 100);

  // Systolic/diastolic are recorded as two separate vital rows sharing one
  // timestamp (the same cuff reading) — see VitalsScreen.handleSaveBloodPressure.
  // Pairing them back up by that shared timestamp is how a tabular "120/80"
  // reading gets reconstructed from the two independent series.
  const diastolicByTimestamp = new Map(bpDiastolic.map((vital) => [vital.timestamp, vital.value]));
  const bloodPressureReadings = bpSystolic
    .filter((systolic) => diastolicByTimestamp.has(systolic.timestamp))
    .map((systolic) => {
      const diastolic = diastolicByTimestamp.get(systolic.timestamp)!;
      return {
        timestamp: systolic.timestamp,
        systolic: systolic.value,
        diastolic,
        stageLabel: classifyBloodPressure(systolic.value, diastolic).label,
      };
    });

  const glucoseReadings = glucoseRows.map((vital) => ({
    timestamp: vital.timestamp,
    value: vital.value,
    unit: vital.unit,
    context: vital.notes,
  }));

  const symptomsInRange = recentSymptoms.filter((symptom) => symptom.timestamp >= sinceIso);
  const symptoms = await Promise.all(
    symptomsInRange.map(async (symptom) => {
      const recentIntakes = await database.symptoms.listRecentIntakesAround(symptom.timestamp);
      return {
        timestamp: symptom.timestamp,
        symptom: symptom.symptom,
        severity: symptom.severity,
        notes: symptom.notes,
        suspectMedications: [...new Set(recentIntakes.map((intake) => intake.medicationName))],
      };
    }),
  );

  return {
    generatedAtIso: new Date().toISOString(),
    patient: getPatientProfile(),
    medications: [...medicationsMap.values()],
    adherence: { periodDays: REPORT_PERIOD_DAYS, takenCount, missedCount, skippedCount, percent },
    bloodPressureReadings,
    glucoseReadings,
    symptoms,
  };
}
