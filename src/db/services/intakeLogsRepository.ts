import type { DB } from '@op-engineering/op-sqlite';
import type { IntakeLog, MedicationHistoryItem, NewIntakeLog } from '../types';

function toIntakeLog(row: Record<string, unknown>): IntakeLog {
  return {
    id: Number(row.id),
    schedule_id: Number(row.schedule_id),
    scheduled_time: String(row.scheduled_time),
    taken_time: row.taken_time === null ? null : String(row.taken_time),
    status: row.status as IntakeLog['status'],
    dismissal_type: row.dismissal_type === null ? null : (row.dismissal_type as IntakeLog['dismissal_type']),
    caregiver_alerted: Number(row.caregiver_alerted) === 1,
  };
}

export class IntakeLogsRepository {
  constructor(private readonly db: DB) {}

  async record(log: NewIntakeLog): Promise<IntakeLog> {
    const { insertId } = await this.db.execute(
      `INSERT INTO intake_logs (schedule_id, scheduled_time, taken_time, status, dismissal_type, caregiver_alerted)
       VALUES (?, ?, ?, ?, ?, ?);`,
      [log.schedule_id, log.scheduled_time, log.taken_time, log.status, log.dismissal_type, log.caregiver_alerted ? 1 : 0],
    );
    const created = await this.getById(insertId as number);
    if (!created) throw new Error('Failed to read back the intake log row that was just inserted.');
    return created;
  }

  async getById(id: number): Promise<IntakeLog | null> {
    const { rows } = await this.db.execute('SELECT * FROM intake_logs WHERE id = ?;', [id]);
    return rows[0] ? toIntakeLog(rows[0]) : null;
  }

  async listForSchedule(scheduleId: number, limit = 50): Promise<IntakeLog[]> {
    const { rows } = await this.db.execute(
      'SELECT * FROM intake_logs WHERE schedule_id = ? ORDER BY scheduled_time DESC LIMIT ?;',
      [scheduleId, limit],
    );
    return rows.map(toIntakeLog);
  }

  /** Every intake row scheduled on or after `sinceIso`, joined to its medication's name — the clinical PDF report's 30-day adherence table and per-medication breakdown read from this rather than re-deriving it from `listForSchedule` per schedule. */
  async listSince(sinceIso: string): Promise<Array<IntakeLog & { medicationName: string }>> {
    const { rows } = await this.db.execute(
      `SELECT il.*, m.name AS medication_name
       FROM intake_logs il
       JOIN schedules s ON s.id = il.schedule_id
       JOIN medications m ON m.id = s.medication_id
       WHERE il.scheduled_time >= ?
       ORDER BY il.scheduled_time ASC;`,
      [sinceIso],
    );
    return rows.map((row) => ({ ...toIntakeLog(row), medicationName: String(row.medication_name) }));
  }

  async listMedicationHistory(limit = 100): Promise<MedicationHistoryItem[]> {
    const { rows } = await this.db.execute(
      `SELECT il.*, m.name AS medication_name, m.strength AS medication_strength, s.time_node
       FROM intake_logs il
       JOIN schedules s ON s.id = il.schedule_id
       JOIN medications m ON m.id = s.medication_id
       ORDER BY il.scheduled_time DESC
       LIMIT ?;`,
      [limit],
    );
    return rows.map((row) => ({
      ...toIntakeLog(row),
      medication_name: String(row.medication_name),
      medication_strength: row.medication_strength === null ? null : String(row.medication_strength),
      time_node: row.time_node as MedicationHistoryItem['time_node'],
    }));
  }

  async listMissedUnalerted(): Promise<IntakeLog[]> {
    const { rows } = await this.db.execute(
      "SELECT * FROM intake_logs WHERE status = 'MISSED' AND caregiver_alerted = 0 ORDER BY scheduled_time;",
    );
    return rows.map(toIntakeLog);
  }

  async markCaregiverAlerted(id: number): Promise<void> {
    await this.db.execute('UPDATE intake_logs SET caregiver_alerted = 1 WHERE id = ?;', [id]);
  }
}
