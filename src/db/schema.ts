import type { DB } from '@op-engineering/op-sqlite';

export const SCHEMA_VERSION = 1;

/**
 * `drug_directory` is FTS5, not a normal table — SQLite does not enforce
 * foreign keys against virtual tables (the `foreign_keys` pragma silently
 * ignores them). So `medications.generic_id` below is a plain INTEGER that
 * holds a `drug_directory.rowid` by convention, not a declared FK: declaring
 * one would look enforced but silently wouldn't be, which is worse than not
 * declaring it.
 */
const CREATE_DRUG_DIRECTORY = `
  CREATE VIRTUAL TABLE IF NOT EXISTS drug_directory USING fts5(
    brand_name,
    generic_name,
    strength,
    dosage_form,
    manufacturer,
    indications,
    food_instructions,
    high_risk_interactions_json UNINDEXED,
    tokenize = 'unicode61'
  );
`;

const CREATE_MEDICATIONS = `
  CREATE TABLE IF NOT EXISTS medications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    generic_id INTEGER,
    strength TEXT,
    form TEXT NOT NULL CHECK (form IN ('tablet', 'syrup', 'capsule', 'injection', 'drop')),
    current_stock REAL NOT NULL DEFAULT 0,
    refill_threshold REAL NOT NULL DEFAULT 0,
    expiry_date TEXT,
    instructions TEXT,
    nfc_tag_uid TEXT
  );
`;

const CREATE_SCHEDULES = `
  CREATE TABLE IF NOT EXISTS schedules (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    medication_id INTEGER NOT NULL,
    time_utc TEXT NOT NULL,
    time_node TEXT NOT NULL CHECK (time_node IN ('FASTING', 'BREAKFAST', 'LUNCH', 'DINNER', 'BEDTIME')),
    meal_relation TEXT NOT NULL CHECK (meal_relation IN ('BEFORE', 'WITH', 'AFTER', 'MINUTES_OFFSET')),
    dose_quantity REAL NOT NULL,
    days_of_week_mask INTEGER NOT NULL DEFAULT 127,
    is_active INTEGER NOT NULL DEFAULT 1,
    FOREIGN KEY (medication_id) REFERENCES medications(id) ON DELETE CASCADE
  );
`;

const CREATE_INTAKE_LOGS = `
  CREATE TABLE IF NOT EXISTS intake_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    schedule_id INTEGER NOT NULL,
    scheduled_time TEXT NOT NULL,
    taken_time TEXT,
    status TEXT NOT NULL CHECK (status IN ('TAKEN', 'SKIPPED', 'MISSED')),
    dismissal_type TEXT CHECK (dismissal_type IN ('NFC', 'VISION', 'MANUAL_OVERRIDE')),
    caregiver_alerted INTEGER NOT NULL DEFAULT 0,
    FOREIGN KEY (schedule_id) REFERENCES schedules(id) ON DELETE CASCADE
  );
`;

const CREATE_VITALS = `
  CREATE TABLE IF NOT EXISTS vitals (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    timestamp TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('BP_SYS', 'BP_DIA', 'BLOOD_SUGAR', 'WEIGHT', 'PULSE', 'TEMPERATURE')),
    value REAL NOT NULL,
    unit TEXT NOT NULL,
    notes TEXT
  );
`;

const CREATE_INDEXES = [
  `CREATE INDEX IF NOT EXISTS idx_medications_generic ON medications(generic_id);`,
  `CREATE INDEX IF NOT EXISTS idx_schedules_medication ON schedules(medication_id);`,
  `CREATE INDEX IF NOT EXISTS idx_schedules_active ON schedules(is_active);`,
  `CREATE INDEX IF NOT EXISTS idx_intake_logs_schedule ON intake_logs(schedule_id);`,
  `CREATE INDEX IF NOT EXISTS idx_intake_logs_status ON intake_logs(status);`,
  `CREATE INDEX IF NOT EXISTS idx_vitals_type_timestamp ON vitals(type, timestamp);`,
];

/**
 * Creates every table/index if missing. Safe to call on every app boot —
 * each statement is idempotent (`IF NOT EXISTS`).
 */
export async function runMigrations(db: DB): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.execute(CREATE_DRUG_DIRECTORY);
    await tx.execute(CREATE_MEDICATIONS);
    await tx.execute(CREATE_SCHEDULES);
    await tx.execute(CREATE_INTAKE_LOGS);
    await tx.execute(CREATE_VITALS);
    for (const statement of CREATE_INDEXES) {
      await tx.execute(statement);
    }
  });
}
