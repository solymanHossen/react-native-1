import type { DB } from '@op-engineering/op-sqlite';
import type { NewSchedule, Schedule } from '../types';

function toSchedule(row: Record<string, unknown>): Schedule {
  return {
    id: Number(row.id),
    medication_id: Number(row.medication_id),
    time_utc: String(row.time_utc),
    time_node: row.time_node as Schedule['time_node'],
    meal_relation: row.meal_relation as Schedule['meal_relation'],
    dose_quantity: Number(row.dose_quantity),
    days_of_week_mask: Number(row.days_of_week_mask),
    is_active: Number(row.is_active) === 1,
  };
}

export class SchedulesRepository {
  constructor(private readonly db: DB) {}

  async create(schedule: NewSchedule): Promise<Schedule> {
    const { insertId } = await this.db.execute(
      `INSERT INTO schedules (medication_id, time_utc, time_node, meal_relation, dose_quantity, days_of_week_mask, is_active)
       VALUES (?, ?, ?, ?, ?, ?, ?);`,
      [
        schedule.medication_id,
        schedule.time_utc,
        schedule.time_node,
        schedule.meal_relation,
        schedule.dose_quantity,
        schedule.days_of_week_mask,
        schedule.is_active ? 1 : 0,
      ],
    );
    const created = await this.getById(insertId as number);
    if (!created) throw new Error('Failed to read back the schedule row that was just inserted.');
    return created;
  }

  async getById(id: number): Promise<Schedule | null> {
    const { rows } = await this.db.execute('SELECT * FROM schedules WHERE id = ?;', [id]);
    return rows[0] ? toSchedule(rows[0]) : null;
  }

  async listForMedication(medicationId: number): Promise<Schedule[]> {
    const { rows } = await this.db.execute('SELECT * FROM schedules WHERE medication_id = ? ORDER BY time_utc;', [medicationId]);
    return rows.map(toSchedule);
  }

  async listActive(): Promise<Schedule[]> {
    const { rows } = await this.db.execute('SELECT * FROM schedules WHERE is_active = 1 ORDER BY time_utc;');
    return rows.map(toSchedule);
  }

  async setActive(id: number, isActive: boolean): Promise<void> {
    await this.db.execute('UPDATE schedules SET is_active = ? WHERE id = ?;', [isActive ? 1 : 0, id]);
  }

  async delete(id: number): Promise<void> {
    await this.db.execute('DELETE FROM schedules WHERE id = ?;', [id]);
  }
}
