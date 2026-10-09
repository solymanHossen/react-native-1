import type { ClinicalReportData } from './reportTypes';

const TIME_NODE_LABEL: Record<string, string> = {
  FASTING: 'Fasting',
  BREAKFAST: 'Breakfast',
  LUNCH: 'Lunch',
  DINNER: 'Dinner',
  BEDTIME: 'Bedtime',
};

const MEAL_RELATION_LABEL: Record<string, string> = {
  BEFORE: 'before meal',
  WITH: 'with meal',
  AFTER: 'after meal',
  MINUTES_OFFSET: 'offset',
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })} · ${date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' })}`;
}

function renderMedicationsSection(data: ClinicalReportData): string {
  if (data.medications.length === 0) {
    return '<p class="empty">No active medications on record.</p>';
  }
  const rows = data.medications
    .map((medication) => {
      const scheduleText = medication.schedules
        .map((schedule) => `${schedule.timeUtc} · ${schedule.doseQuantity}× (${TIME_NODE_LABEL[schedule.timeNode] ?? schedule.timeNode}, ${MEAL_RELATION_LABEL[schedule.mealRelation] ?? schedule.mealRelation})`)
        .join('<br/>');
      return `<tr>
        <td>${escapeHtml(medication.name)}</td>
        <td>${medication.strength ? escapeHtml(medication.strength) : '—'}</td>
        <td>${escapeHtml(medication.form)}</td>
        <td>${scheduleText || '—'}</td>
        <td>${medication.instructions ? escapeHtml(medication.instructions) : '—'}</td>
      </tr>`;
    })
    .join('');
  return `<table>
    <thead><tr><th>Medication</th><th>Strength</th><th>Form</th><th>Schedule</th><th>Instructions</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderAdherenceSection(data: ClinicalReportData): string {
  const { periodDays, takenCount, missedCount, skippedCount, percent } = data.adherence;
  return `<div class="adherence-summary">
    <div class="adherence-score">${percent}%</div>
    <div class="adherence-breakdown">
      <p>${periodDays}-day adherence score (Taken ÷ Taken + Missed)</p>
      <ul>
        <li><span class="dot taken"></span> Taken: <strong>${takenCount}</strong></li>
        <li><span class="dot missed"></span> Missed: <strong>${missedCount}</strong></li>
        <li><span class="dot skipped"></span> Manually overridden: <strong>${skippedCount}</strong></li>
      </ul>
    </div>
  </div>`;
}

function renderBloodPressureSection(data: ClinicalReportData): string {
  if (data.bloodPressureReadings.length === 0) {
    return '<p class="empty">No blood pressure readings in this period.</p>';
  }
  const rows = data.bloodPressureReadings
    .map(
      (reading) =>
        `<tr><td>${formatDateTime(reading.timestamp)}</td><td>${reading.systolic}/${reading.diastolic} mmHg</td><td>${escapeHtml(reading.stageLabel)}</td></tr>`,
    )
    .join('');
  return `<table>
    <thead><tr><th>Date &amp; Time</th><th>Reading</th><th>Classification</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderGlucoseSection(data: ClinicalReportData): string {
  if (data.glucoseReadings.length === 0) {
    return '<p class="empty">No blood glucose readings in this period.</p>';
  }
  const rows = data.glucoseReadings
    .map(
      (reading) =>
        `<tr><td>${formatDateTime(reading.timestamp)}</td><td>${reading.value} ${escapeHtml(reading.unit)}</td><td>${reading.context ? escapeHtml(reading.context) : '—'}</td></tr>`,
    )
    .join('');
  return `<table>
    <thead><tr><th>Date &amp; Time</th><th>Reading</th><th>Context</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function renderSymptomsSection(data: ClinicalReportData): string {
  if (data.symptoms.length === 0) {
    return '<p class="empty">No adverse reactions logged in this period.</p>';
  }
  const rows = data.symptoms
    .map(
      (symptom) =>
        `<tr>
          <td>${formatDateTime(symptom.timestamp)}</td>
          <td>${escapeHtml(symptom.symptom)}</td>
          <td>${escapeHtml(symptom.severity)}</td>
          <td>${symptom.suspectMedications.length ? symptom.suspectMedications.map(escapeHtml).join(', ') : '—'}</td>
          <td>${symptom.notes ? escapeHtml(symptom.notes) : '—'}</td>
        </tr>`,
    )
    .join('');
  return `<table>
    <thead><tr><th>Date &amp; Time</th><th>Symptom</th><th>Severity</th><th>Suspect Medication(s)</th><th>Notes</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>`;
}

/**
 * Plain HTML/CSS, not a component framework — this is handed to
 * `react-native-html-to-pdf`'s native WebView-backed renderer as one static
 * string, so there's no runtime to support anything beyond what a print
 * stylesheet needs.
 */
export function buildClinicalReportHtml(data: ClinicalReportData): string {
  const patientRows = [
    ['Name', data.patient.name || '—'],
    ['Date of Birth', data.patient.dateOfBirth || '—'],
    ['Blood Type', data.patient.bloodType || '—'],
    ['Known Allergies', data.patient.allergies || '—'],
  ]
    .map(([label, value]) => `<div class="demo-field"><span class="demo-label">${label}</span><span class="demo-value">${escapeHtml(value)}</span></div>`)
    .join('');

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, Roboto, Helvetica, Arial, sans-serif; color: #1A0605; margin: 0; padding: 32px; font-size: 13px; line-height: 1.5; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  .subtitle { color: #4A1512; font-size: 12px; margin: 0 0 24px; }
  h2 { font-size: 15px; text-transform: uppercase; letter-spacing: 0.04em; color: #4A1512; border-bottom: 1px solid #FBDAD5; padding-bottom: 6px; margin: 28px 0 12px; }
  .demographics { display: flex; flex-wrap: wrap; gap: 16px 32px; background: #FFF8F7; border: 1px solid #FBDAD5; border-radius: 12px; padding: 16px 20px; }
  .demo-field { display: flex; flex-direction: column; min-width: 140px; }
  .demo-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; color: #C0392B; }
  .demo-value { font-size: 14px; font-weight: 600; }
  table { width: 100%; border-collapse: collapse; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #FBDAD5; font-size: 12px; vertical-align: top; }
  th { color: #4A1512; text-transform: uppercase; font-size: 10px; letter-spacing: 0.03em; }
  .empty { color: #C0392B; font-style: italic; }
  .adherence-summary { display: flex; align-items: center; gap: 24px; background: #FFF8F7; border: 1px solid #FBDAD5; border-radius: 12px; padding: 20px; }
  .adherence-score { font-size: 40px; font-weight: 800; color: #C0392B; min-width: 100px; }
  .adherence-breakdown p { margin: 0 0 8px; color: #4A1512; }
  .adherence-breakdown ul { list-style: none; margin: 0; padding: 0; display: flex; gap: 20px; }
  .adherence-breakdown li { display: flex; align-items: center; gap: 6px; }
  .dot { width: 9px; height: 9px; border-radius: 999px; display: inline-block; }
  .dot.taken { background: #2ECC71; }
  .dot.missed { background: #FF6B6B; }
  .dot.skipped { background: #FFA502; }
  .footer { margin-top: 36px; padding-top: 12px; border-top: 1px solid #FBDAD5; color: #C0392B; font-size: 10px; }
</style>
</head>
<body>
  <h1>Clinical Medication &amp; Vitals Report</h1>
  <p class="subtitle">Generated ${formatDateTime(data.generatedAtIso)} · Medicine Reminder (offline, patient-reported record)</p>

  <h2>Patient Demographics &amp; Emergency Identifiers</h2>
  <div class="demographics">${patientRows}</div>

  <h2>Active Medication Regimens</h2>
  ${renderMedicationsSection(data)}

  <h2>${data.adherence.periodDays}-Day Adherence</h2>
  ${renderAdherenceSection(data)}

  <h2>Blood Pressure Log</h2>
  ${renderBloodPressureSection(data)}

  <h2>Blood Glucose Log</h2>
  ${renderGlucoseSection(data)}

  <h2>Adverse Reaction Summary</h2>
  ${renderSymptomsSection(data)}

  <p class="footer">This report was compiled entirely on-device from patient-reported data and is not a substitute for professional medical evaluation. Share only with trusted clinicians or caregivers.</p>
</body>
</html>`;
}
