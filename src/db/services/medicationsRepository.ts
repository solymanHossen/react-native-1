import type { DB } from '@op-engineering/op-sqlite';
import type { Medication, NewMedication } from '../types';

function toMedication(row: Record<string, unknown>): Medication {
  return {
    id: Number(row.id),
    name: String(row.name),
    generic_id: row.generic_id === null ? null : Number(row.generic_id),
    strength: row.strength === null ? null : String(row.strength),
    form: row.form as Medication['form'],
    current_stock: Number(row.current_stock),
    refill_threshold: Number(row.refill_threshold),
    expiry_date: row.expiry_date === null ? null : String(row.expiry_date),
    instructions: row.instructions === null ? null : String(row.instructions),
    nfc_tag_uid: row.nfc_tag_uid === null ? null : String(row.nfc_tag_uid),
  };
}

export class MedicationsRepository {
  constructor(private readonly db: DB) {}

  async create(medication: NewMedication): Promise<Medication> {
    const { insertId } = await this.db.execute(
      `INSERT INTO medications (name, generic_id, strength, form, current_stock, refill_threshold, expiry_date, instructions, nfc_tag_uid)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?);`,
      [
        medication.name,
        medication.generic_id,
        medication.strength,
        medication.form,
        medication.current_stock,
        medication.refill_threshold,
        medication.expiry_date,
        medication.instructions,
        medication.nfc_tag_uid,
      ],
    );
    const created = await this.getById(insertId as number);
    if (!created) throw new Error('Failed to read back the medication row that was just inserted.');
    return created;
  }

  async getById(id: number): Promise<Medication | null> {
    const { rows } = await this.db.execute('SELECT * FROM medications WHERE id = ?;', [id]);
    return rows[0] ? toMedication(rows[0]) : null;
  }

  async list(): Promise<Medication[]> {
    const { rows } = await this.db.execute('SELECT * FROM medications ORDER BY name;');
    return rows.map(toMedication);
  }

  async adjustStock(id: number, deltaUnits: number): Promise<void> {
    await this.db.execute('UPDATE medications SET current_stock = current_stock + ? WHERE id = ?;', [deltaUnits, id]);
  }

  async listLowStock(): Promise<Medication[]> {
    const { rows } = await this.db.execute('SELECT * FROM medications WHERE current_stock <= refill_threshold ORDER BY current_stock;');
    return rows.map(toMedication);
  }

  async delete(id: number): Promise<void> {
    await this.db.execute('DELETE FROM medications WHERE id = ?;', [id]);
  }
}
