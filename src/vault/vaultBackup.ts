import { open } from '@op-engineering/op-sqlite';
import { errorCodes, isErrorWithCode, keepLocalCopy, pick } from '@react-native-documents/picker';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { initializeDatabase, shutdownDatabase } from '../db';
import { getOrCreateDatabaseKey } from '../db/security/keyManager';

function stripFileScheme(path: string): string {
  return path.startsWith('file://') ? path.slice('file://'.length) : path;
}

function splitPath(fullPath: string): { dir: string; name: string } {
  const index = fullPath.lastIndexOf('/');
  return { dir: fullPath.slice(0, index), name: fullPath.slice(index + 1) };
}

/**
 * Exports a fully-consistent, still-encrypted copy of the live vault via
 * SQLite's own `VACUUM INTO` rather than copying the live `.db` file with
 * `RNFS.copyFile`. Two reasons: (1) a raw file copy taken mid-write could
 * capture a half-committed page, where `VACUUM INTO` always produces a
 * complete, compacted snapshot in one atomic step; (2) the output inherits
 * this connection's SQLCipher key automatically — there is no intermediate
 * decrypted form at any point, which is what "absolute verification of zero
 * plaintext leakage" actually requires (not a claim to verify after the
 * fact, but a mechanism that can't produce plaintext in the first place).
 */
export async function exportVaultBackup(): Promise<string> {
  const database = await initializeDatabase();
  const exportPath = `${RNFS.CachesDirectoryPath}/medius-vault-backup-${Date.now()}.db`;
  await database.db.execute('VACUUM INTO ?;', [exportPath]);
  await Share.open({
    url: `file://${exportPath}`,
    type: 'application/octet-stream',
    filename: splitPath(exportPath).name,
    failOnCancel: false,
  });
  return exportPath;
}

export class VaultRestoreCancelled extends Error {
  constructor() {
    super('Restore cancelled.');
    this.name = 'VaultRestoreCancelled';
  }
}

/**
 * Opens the candidate file read-only with this device's own SQLCipher key
 * and runs one real query against it. A wrong key or a non-database file
 * fails right here — SQLCipher only proves a key is correct by attempting to
 * read actual table pages with it, not by opening the file handle. Nothing
 * about the live vault is touched if this throws.
 */
async function assertValidVault(localPath: string, encryptionKey: string): Promise<void> {
  const { dir, name } = splitPath(localPath);
  const candidate = open({ name, location: dir, encryptionKey, readOnly: true });
  try {
    await candidate.execute('SELECT count(*) AS n FROM medications;');
  } finally {
    candidate.close();
  }
}

/** Removes a file if it exists, silently no-ops if it doesn't — used for the WAL/SHM sidecars SQLite may leave next to the live `.db` path. */
async function unlinkIfExists(path: string): Promise<void> {
  if (await RNFS.exists(path)) {
    await RNFS.unlink(path);
  }
}

export interface RestoreCandidate {
  /** Local, directly-readable path (not a `content://` uri) — already copied out of whatever document provider the user picked it from, and already proven to decrypt with this device's key. */
  path: string;
  fileName: string | null;
}

/**
 * Phase 1 of restore: lets the user pick a previously-exported vault file and
 * validates it decrypts with *this device's* key (a vault key never leaves
 * the Keychain, so a backup from a different device or a reinstalled key
 * will correctly fail here rather than silently restoring garbage). Does
 * nothing to the live database — callers should show the returned file name
 * back to the user and get explicit confirmation before calling
 * `applyVaultRestore`, since that step is destructive.
 */
export async function pickAndValidateRestoreCandidate(): Promise<RestoreCandidate> {
  let picked;
  try {
    [picked] = await pick({ type: ['*/*'], mode: 'import' });
  } catch (error) {
    if (isErrorWithCode(error) && error.code === errorCodes.OPERATION_CANCELED) {
      throw new VaultRestoreCancelled();
    }
    throw error;
  }

  const [copyResult] = await keepLocalCopy({
    files: [{ uri: picked.uri, fileName: picked.name ?? `restore-candidate-${Date.now()}.db` }],
    destination: 'cachesDirectory',
  });
  if (copyResult.status === 'error') {
    throw new Error(`Could not read the selected file: ${copyResult.copyError}`);
  }

  const candidatePath = stripFileScheme(copyResult.localUri);
  const encryptionKey = await getOrCreateDatabaseKey();
  await assertValidVault(candidatePath, encryptionKey);

  return { path: candidatePath, fileName: picked.name };
}

/**
 * Phase 2 of restore: swaps a path already returned by
 * `pickAndValidateRestoreCandidate` in for the live database. The live file
 * is backed up to `<path>.pre-restore-<timestamp>.bak` right before being
 * overwritten — a bad restore should never be the second way a user loses
 * their data in the same session.
 */
export async function applyVaultRestore(candidatePath: string): Promise<void> {
  const database = await initializeDatabase();
  const livePath = database.db.getDbPath();
  await shutdownDatabase();

  try {
    await RNFS.copyFile(livePath, `${livePath}.pre-restore-${Date.now()}.bak`);
    await unlinkIfExists(`${livePath}-wal`);
    await unlinkIfExists(`${livePath}-shm`);
    await unlinkIfExists(livePath);
    await RNFS.copyFile(candidatePath, livePath);
  } finally {
    // Whatever happened above, the app needs a live connection again —
    // reopening re-runs migrations/seed import against whichever file is now
    // actually at `livePath` (the restored one, or the original if the copy
    // failed partway and was never removed).
    await initializeDatabase();
  }
}
