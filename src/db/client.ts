import { isSQLCipher, open, type DB } from '@op-engineering/op-sqlite';
import { getOrCreateDatabaseKey } from './security/keyManager';
import { importBundledDrugDirectory } from './seedImport';
import { runMigrations } from './schema';

const DATABASE_NAME = 'medius.db';

let dbInstance: DB | null = null;
let initPromise: Promise<DB> | null = null;

async function createConnection(): Promise<DB> {
  if (!isSQLCipher()) {
    throw new Error(
      'This build was not compiled with SQLCipher. Add "op-sqlite": { "sqlcipher": true, "fts5": true } ' +
        'to package.json and do a full native rebuild (JS/Metro reload is not enough).',
    );
  }

  const encryptionKey = await getOrCreateDatabaseKey();

  // Migrate first, so the (empty) drug_directory table exists before seeding
  // tries to INSERT into it — then close before importBundledDrugDirectory()
  // ATTACHes this same file from its own connection, so there's never a
  // second live handle fighting it for the file lock. See the ordering note
  // in seedImport.ts.
  const db = open({ name: DATABASE_NAME, encryptionKey });

  // SQLCipher-specific: actively wipe decrypted pages from the process's
  // memory once SQLite is done with them, instead of leaving them in freed
  // (but not zeroed) heap memory.
  await db.execute('PRAGMA cipher_memory_security = ON;');
  // Per-connection, not persisted in the database file — must be set on
  // every connection that needs cascading deletes/FK enforcement.
  await db.execute('PRAGMA foreign_keys = ON;');
  await runMigrations(db);

  const targetDbPath = db.getDbPath();
  db.close();

  await importBundledDrugDirectory({ targetDbPath, encryptionKey });

  const reopened = open({ name: DATABASE_NAME, encryptionKey });
  await reopened.execute('PRAGMA cipher_memory_security = ON;');
  await reopened.execute('PRAGMA foreign_keys = ON;');

  return reopened;
}

/**
 * Opens (or returns the already-open) encrypted database connection.
 * Concurrent callers during startup share the same in-flight open — the key
 * lookup, seed import and migrations only run once.
 */
export function getDatabase(): Promise<DB> {
  if (dbInstance) {
    return Promise.resolve(dbInstance);
  }
  if (!initPromise) {
    initPromise = createConnection()
      .then((db) => {
        dbInstance = db;
        return db;
      })
      .catch((error: unknown) => {
        initPromise = null;
        throw error;
      });
  }
  return initPromise;
}

/** For tests and account-wipe flows. Does not delete the key or the file. */
export async function closeDatabase(): Promise<void> {
  if (!dbInstance) return;
  const db = dbInstance;
  dbInstance = null;
  initPromise = null;
  await db.closeAsync();
}
