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
    photo_uri: row.photo_uri === null ? null : String(row.photo_uri),
    course_start_date: row.course_start_date === null ? null : String(row.course_start_date),
    course_end_date: row.course_end_date === null ? null : String(row.course_end_date),
    is_archived: Number(row.is_archived ?? 0) === 1,
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
      `INSERT INTO medications (name, generic_id, strength, form, current_stock, refill_threshold, expiry_date, instructions, nfc_tag_uid, photo_uri, course_start_date, course_end_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
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
        medication.photo_uri ?? null,
        medication.course_start_date ?? null,
        medication.course_end_date ?? null,
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
    const { rows } = await this.db.execute('SELECT * FROM medications WHERE is_archived = 0 ORDER BY name;');
    return rows.map(toMedication);
  }

  async adjustStock(id: number, deltaUnits: number): Promise<void> {
    if (!Number.isFinite(deltaUnits)) throw new Error('Stock adjustment must be a finite number.');
    await this.db.execute(
      'UPDATE medications SET current_stock = MAX(0, current_stock + ?) WHERE id = ? AND is_archived = 0;',
      [deltaUnits, id],
    );
  }

  async setStock(id: number, units: number): Promise<Medication> {
    if (!Number.isFinite(units) || units < 0) throw new Error('Stock must be zero or greater.');
    await this.db.execute('UPDATE medications SET current_stock = ? WHERE id = ? AND is_archived = 0;', [units, id]);
    const updated = await this.getById(id);
    if (!updated) throw new Error('Medication disappeared while saving its stock.');
    return updated;
  }

  async updatePhoto(id: number, photoUri: string | null): Promise<Medication> {
    await this.db.execute('UPDATE medications SET photo_uri = ? WHERE id = ?;', [photoUri, id]);
    const updated = await this.getById(id);
    if (!updated) throw new Error('Medication disappeared while saving its photo.');
    return updated;
  }

  async listLowStock(): Promise<Medication[]> {
    const { rows } = await this.db.execute(
      'SELECT * FROM medications WHERE is_archived = 0 AND current_stock <= refill_threshold ORDER BY current_stock;',
    );
    return rows.map(toMedication);
  }

  /** Resolves a scanned NFC tag to the medication it was registered against — the core lookup behind the alarm's proof-of-intake check. */
  async getByNfcTagUid(uid: string): Promise<Medication | null> {
    const { rows } = await this.db.execute('SELECT * FROM medications WHERE nfc_tag_uid = ? LIMIT 1;', [uid]);
    return rows[0] ? toMedication(rows[0]) : null;
  }

  /**
   * Removes a medication from the active list without deleting its schedules
   * or intake history. Schedules are deactivated in the same transaction so
   * removing a medication can never leave an active alarm pointing at it.
   */
  async archive(id: number): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.execute('UPDATE medications SET is_archived = 1 WHERE id = ?;', [id]);
      await tx.execute('UPDATE schedules SET is_active = 0 WHERE medication_id = ?;', [id]);
    });
  }
}
