import { moveAssetsDatabase, open } from '@op-engineering/op-sqlite';

/**
 * Bundled reference dataset shipped in the app's native assets. A PLAIN,
 * unencrypted SQLite file containing only the `drug_directory` table.
 *
 * Placement is platform-specific and NOT symmetric, because op-sqlite's own
 * `moveAssetsDatabase` isn't:
 *  - Android: `android/app/src/main/assets/custom/drug_directory_seed.db`.
 *    op-sqlite's Android `path` option (undocumented in its .d.ts) is the
 *    SOURCE subfolder inside `assets/`, not a destination override, and
 *    defaults to `"custom"` — so the file has to live under `assets/custom/`
 *    for the default (no-`path`) call below to find it.
 *  - iOS: add it as an Xcode bundle resource with this exact filename at the
 *    bundle root (not wired into the iOS project here). op-sqlite's iOS
 *    implementation ignores the `path` option entirely and looks the
 *    filename up as a flat bundle resource.
 *
 * IMPORTANT: the file at that path is SAMPLE/DEMO data — 8 well-known drugs
 * with textbook interaction facts (see src/db/seed-data/generate-sample-seed.py),
 * used only to exercise the search and conflict-sentinel code paths end to
 * end. It is not a real 25,000-row drug index and must not ship to users as
 * clinical data. A real index has to come from a licensed/verified
 * pharmaceutical data source (a national formulary, RxNorm, DrugBank, or a
 * licensed regional dataset), converted into this same `drug_directory`
 * schema, before production use.
 */
const SEED_ASSET_FILENAME = 'drug_directory_seed.db';

const DRUG_DIRECTORY_COLUMNS =
  'brand_name, generic_name, strength, dosage_form, manufacturer, indications, food_instructions, high_risk_interactions_json';

/** `'` is the only character SQL string-literal syntax requires escaping. */
function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Imports the bundled `drug_directory` dataset into the app's encrypted
 * database, if it hasn't been imported already. Must run on `targetDbPath`
 * while NO connection to it is open (see the two-connection ordering note in
 * client.ts) — SQLCipher's `ATTACH ... KEY` needs a direct path, and having
 * two separate handles write to the same file concurrently is asking for a
 * lock conflict. Assumes `runMigrations()` has already created an (empty)
 * `drug_directory` table at that path — this only inserts rows into it.
 *
 * Deliberately NOT using SQLCipher's `sqlcipher_export()` (the usual route
 * for folding a plaintext database into an encrypted one): that function
 * replays the source's entire schema, including an unconditional copy of
 * `sqlite_sequence` — the bundled seed has no AUTOINCREMENT tables, so
 * `sqlite_sequence` doesn't exist there, and sqlcipher_export fails with "no
 * such table: main.sqlite_sequence". A plain cross-attach `INSERT ... SELECT`
 * sidesteps that: the target table already exists, so only its rows need to
 * move, not its schema.
 *
 * The plaintext seed asset is decrypted (it was never encrypted to begin
 * with — it ships as plain SQLite) only inside a transient copy in the app's
 * private storage, which this function deletes in its `finally` block
 * whether the import succeeds or fails. It is never copied into, or
 * reachable from, the app's real encrypted database file.
 */
export async function importBundledDrugDirectory(params: { targetDbPath: string; encryptionKey: string }): Promise<void> {
  const moved = await moveAssetsDatabase({ filename: SEED_ASSET_FILENAME, overwrite: true });
  if (!moved) {
    // No seed asset bundled with this build — not an error, just nothing to import.
    return;
  }

  const seedDb = open({ name: SEED_ASSET_FILENAME });
  try {
    // Interpolated, not parameterized: ATTACH does not accept bound
    // parameters for its path or KEY clause. Both values are escaped and
    // both come from this app (a sandboxed file path, a locally-generated
    // hex key), never from user input.
    const path = escapeSqlLiteral(params.targetDbPath);
    const key = escapeSqlLiteral(params.encryptionKey);
    seedDb.executeSync(`ATTACH DATABASE '${path}' AS target_db KEY '${key}';`);
    try {
      const { rows } = seedDb.executeSync('SELECT count(*) AS count FROM target_db.drug_directory;');
      const alreadySeeded = Number(rows[0]?.count ?? 0) > 0;
      if (!alreadySeeded) {
        seedDb.executeSync(
          `INSERT INTO target_db.drug_directory (${DRUG_DIRECTORY_COLUMNS}) SELECT ${DRUG_DIRECTORY_COLUMNS} FROM drug_directory;`,
        );
      }
    } finally {
      seedDb.executeSync('DETACH DATABASE target_db;');
    }
  } finally {
    seedDb.close();
    seedDb.delete();
  }
}
