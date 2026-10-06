import type { DB } from '@op-engineering/op-sqlite';
import type { NewSymptomLog, RecentIntakeContext, SymptomLog, SymptomSeverity } from '../types';

function toSymptomLog(row: Record<string, unknown>): SymptomLog {
  return {
    id: Number(row.id),
    timestamp: String(row.timestamp),
    symptom: String(row.symptom),
    severity: row.severity as SymptomSeverity,
    notes: row.notes === null ? null : String(row.notes),
  };
}

export class SymptomsRepository {
  constructor(private readonly db: DB) {}

  async record(entry: NewSymptomLog): Promise<SymptomLog> {
    const { insertId } = await this.db.execute(`INSERT INTO symptom_logs (timestamp, symptom, severity, notes) VALUES (?, ?, ?, ?);`, [
      entry.timestamp,
      entry.symptom,
      entry.severity,
      entry.notes,
    ]);
    const created = await this.getById(insertId as number);
    if (!created) throw new Error('Failed to read back the symptom log row that was just inserted.');
    return created;
  }

  async getById(id: number): Promise<SymptomLog | null> {
    const { rows } = await this.db.execute('SELECT * FROM symptom_logs WHERE id = ?;', [id]);
    return rows[0] ? toSymptomLog(rows[0]) : null;
  }

  async listRecent(limit = 50): Promise<SymptomLog[]> {
    const { rows } = await this.db.execute('SELECT * FROM symptom_logs ORDER BY timestamp DESC LIMIT ?;', [limit]);
    return rows.map(toSymptomLog);
  }

  /**
   * The "automatic relational association" the spec asks for: not a stored
   * join row, just a query computed at read time against `intake_logs`
   * joined through `schedules` to `medications` — a dose taken in the 4
   * hours before a symptom was logged, regardless of which medication.
   */
  async listRecentIntakesAround(symptomTimestampIso: string, hoursBefore = 4): Promise<RecentIntakeContext[]> {
    const { rows } = await this.db.execute(
      `SELECT m.name AS medication_name, il.taken_time
       FROM intake_logs il
       JOIN schedules s ON s.id = il.schedule_id
       JOIN medications m ON m.id = s.medication_id
       WHERE il.status = 'TAKEN'
         AND il.taken_time IS NOT NULL
         AND il.taken_time BETWEEN datetime(?, ?) AND ?
       ORDER BY il.taken_time DESC;`,
      [symptomTimestampIso, `-${hoursBefore} hours`, symptomTimestampIso],
    );
    return rows.map((row) => ({
      medicationName: String(row.medication_name),
      takenTime: String(row.taken_time),
    }));
  }
}
