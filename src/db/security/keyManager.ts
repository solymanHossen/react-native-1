// Side-effecting import: patches `global.crypto.getRandomValues` with a
// CSPRNG-backed implementation. Must run before the `crypto.getRandomValues`
// call below. Imported here (not just once at the app entry point) so this
// module's correctness doesn't depend on import order elsewhere.
import 'react-native-get-random-values';
import * as Keychain from 'react-native-keychain';

// react-native-get-random-values is untyped and this project doesn't include
// the DOM lib (RN has no `window`), so `crypto.getRandomValues` needs a
// minimal ambient declaration rather than pulling in all of lib.dom.d.ts.
declare const crypto: { getRandomValues: <T extends Uint8Array>(array: T) => T };

const KEYCHAIN_SERVICE = 'medius.db.encryptionKey';
/** Keychain requires a username; this DB key isn't tied to a real account. */
const KEYCHAIN_USERNAME = 'medius-db';
const KEY_BYTE_LENGTH = 32; // 256 bits, for AES-256

function generateKeyHex(): string {
  const bytes = new Uint8Array(KEY_BYTE_LENGTH);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Returns the device's SQLCipher database key, generating and persisting one
 * on first launch. The key never leaves the Keychain/Android Keystore except
 * as this in-memory string, and `WHEN_UNLOCKED_THIS_DEVICE_ONLY` means it is
 * both inaccessible while the device is locked and excluded from device
 * backups/transfers (it does not migrate to a restored or new device).
 */
export async function getOrCreateDatabaseKey(): Promise<string> {
  const existing = await Keychain.getGenericPassword({ service: KEYCHAIN_SERVICE });
  if (existing) {
    return existing.password;
  }

  const key = generateKeyHex();
  const saved = await Keychain.setGenericPassword(KEYCHAIN_USERNAME, key, {
    service: KEYCHAIN_SERVICE,
    accessible: Keychain.ACCESSIBLE.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });

  if (!saved) {
    throw new Error('Failed to persist the database encryption key in the secure keystore.');
  }

  return key;
}

/**
 * Removes the stored key. Only for account wipe / "delete all my data" flows
 * — without the key, the encrypted database file is permanently unreadable.
 */
export async function destroyDatabaseKey(): Promise<void> {
  await Keychain.resetGenericPassword({ service: KEYCHAIN_SERVICE });
}
