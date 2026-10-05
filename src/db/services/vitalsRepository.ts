import type { DB } from '@op-engineering/op-sqlite';
import type { NewVital, Vital, VitalType } from '../types';

function toVital(row: Record<string, unknown>): Vital {
  return {
    id: Number(row.id),
    timestamp: String(row.timestamp),
    type: row.type as VitalType,
    value: Number(row.value),
    unit: String(row.unit),
    notes: row.notes === null ? null : String(row.notes),
  };
}

export class VitalsRepository {
  constructor(private readonly db: DB) {}

  async record(vital: NewVital): Promise<Vital> {
    const { insertId } = await this.db.execute(
      `INSERT INTO vitals (timestamp, type, value, unit, notes) VALUES (?, ?, ?, ?, ?);`,
      [vital.timestamp, vital.type, vital.value, vital.unit, vital.notes],
    );
    const created = await this.getById(insertId as number);
    if (!created) throw new Error('Failed to read back the vital row that was just inserted.');
    return created;
  }

  async getById(id: number): Promise<Vital | null> {
    const { rows } = await this.db.execute('SELECT * FROM vitals WHERE id = ?;', [id]);
    return rows[0] ? toVital(rows[0]) : null;
  }

  async listByType(type: VitalType, limit = 50): Promise<Vital[]> {
    const { rows } = await this.db.execute('SELECT * FROM vitals WHERE type = ? ORDER BY timestamp DESC LIMIT ?;', [type, limit]);
    return rows.map(toVital);
  }
}
