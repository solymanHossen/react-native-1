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

/**
 * Thrown by `create` when `findDuplicate` finds an existing row for the same
 * drug — callers should catch this and show a friendly "already added"
 * message instead of letting a duplicate row get created silently.
 */
export class DuplicateMedicationError extends Error {
  constructor(public readonly existing: Medication) {
    super(`"${existing.name}" is already in your medications.`);
    this.name = 'DuplicateMedicationError';
  }
}

export class MedicationsRepository {
  constructor(private readonly db: DB) {}

  /**
   * Finds an existing row representing the same drug as `candidate`. Matches
   * by `generic_id` when the candidate has one (the normal case — added via
   * drug-directory search, so two rows sharing a `generic_id` are
   * unambiguously the same catalog drug). Falls back to a case-insensitive
   * name+strength match for OCR-added medications, where `generic_id` is
   * null because no directory entry was confidently matched and there's no
   * catalog identity to compare instead.
   */
  async findDuplicate(candidate: Pick<NewMedication, 'generic_id' | 'name' | 'strength'>): Promise<Medication | null> {
    const existing = await this.list();
    if (candidate.generic_id !== null) {
      return existing.find((medication) => medication.generic_id === candidate.generic_id) ?? null;
    }
    const candidateName = candidate.name.trim().toLowerCase();
    return (
      existing.find(
        (medication) =>
          medication.generic_id === null &&
          medication.name.trim().toLowerCase() === candidateName &&
          (medication.strength ?? null) === (candidate.strength ?? null),
      ) ?? null
    );
  }

  async create(medication: NewMedication): Promise<Medication> {
    const duplicate = await this.findDuplicate(medication);
    if (duplicate) throw new DuplicateMedicationError(duplicate);

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

  /** Resolves a scanned NFC tag to the medication it was registered against — the core lookup behind the alarm's proof-of-intake check. */
  async getByNfcTagUid(uid: string): Promise<Medication | null> {
    const { rows } = await this.db.execute('SELECT * FROM medications WHERE nfc_tag_uid = ? LIMIT 1;', [uid]);
    return rows[0] ? toMedication(rows[0]) : null;
  }

  async delete(id: number): Promise<void> {
    await this.db.execute('DELETE FROM medications WHERE id = ?;', [id]);
  }
}
