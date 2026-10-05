import NfcManager, { NfcEvents, NfcTech, type TagEvent } from 'react-native-nfc-manager';

let started = false;

async function ensureStarted(): Promise<void> {
  if (!started) {
    await NfcManager.start();
    started = true;
  }
}

export async function isNfcAvailable(): Promise<boolean> {
  try {
    await ensureStarted();
    const [supported, enabled] = await Promise.all([NfcManager.isSupported(), NfcManager.isEnabled()]);
    return supported && enabled;
  } catch {
    return false;
  }
}

/**
 * Continuous discovery, not a one-shot read: the alarm needs to keep
 * listening for as long as the screen is up, since the caregiver/patient may
 * take a few tries to align an NTAG213 tag with the phone's antenna. Returns
 * a cleanup function that unregisters the listener — callers must invoke it
 * on unmount/resolution, since a dangling NFC session blocks the next
 * `requestTechnology`/`registerTagEvent` call elsewhere in the app.
 */
export function listenForTag(onTagDiscovered: (uid: string) => void): () => void {
  let cancelled = false;

  const handleDiscoverTag = (tag: TagEvent) => {
    if (cancelled || !tag.id) return;
    onTagDiscovered(tag.id.toUpperCase());
  };

  ensureStarted()
    .then(() => {
      if (cancelled) return;
      NfcManager.setEventListener(NfcEvents.DiscoverTag, handleDiscoverTag);
      return NfcManager.registerTagEvent({ isReaderModeEnabled: true });
    })
    .catch((error: unknown) => {
      console.warn('[nfcVerification] failed to start tag discovery', error);
    });

  return () => {
    cancelled = true;
    NfcManager.setEventListener(NfcEvents.DiscoverTag, null);
    NfcManager.unregisterTagEvent().catch(() => {
      // No active session to unregister — not an error worth surfacing.
    });
  };
}

/** NTAG213 responds to Ndef/NfcA; exported for the rare caller that wants a one-shot read instead of continuous discovery (not used by the alarm screen itself). */
export async function readTagUidOnce(): Promise<string | null> {
  try {
    await ensureStarted();
    await NfcManager.requestTechnology([NfcTech.Ndef, NfcTech.NfcA]);
    const tag = await NfcManager.getTag();
    return tag?.id ? tag.id.toUpperCase() : null;
  } finally {
    await NfcManager.cancelTechnologyRequest().catch(() => {});
  }
}
