import Tts from 'react-native-tts';
import type { LanguageCode } from '../i18n/useLanguage';

const BCP47_LANGUAGE: Record<LanguageCode, string> = {
  en: 'en-US',
  bn: 'bn-BD',
};

let readyPromise: Promise<void> | null = null;

function ensureReady(): Promise<void> {
  if (!readyPromise) {
    readyPromise = Tts.getInitStatus()
      .then(() => undefined)
      .catch((error: unknown) => {
        // Lets the next call retry instead of permanently giving up after one
        // cold-start race (the TTS engine can still be installing itself).
        readyPromise = null;
        throw error;
      });
  }
  return readyPromise;
}

/**
 * Speaks `text` on the on-device TTS engine, best-effort. The sole entry
 * point every voice-announcement call site uses, so the underlying library
 * can be swapped without touching callers. Never throws: a missing TTS
 * engine, an uninstalled voice/language, or any other native failure is
 * logged and silently skipped — a patient must still be able to resolve the
 * alarm by NFC/vision/override even if voice never speaks a word, so a TTS
 * failure can never be allowed to break (or appear to block) the alarm flow.
 * `Tts.stop()` runs before every `speak()` so a fast-firing second alarm
 * can't overlap/garble the first one's announcement.
 */
export async function speakReminder(text: string, language: LanguageCode): Promise<void> {
  try {
    await ensureReady();
    await Tts.setDefaultLanguage(BCP47_LANGUAGE[language]).catch((error: unknown) => {
      // Speaks in whichever language the engine already has loaded rather
      // than not speaking at all — most Android TTS engines only ship
      // Bengali voice data if the user separately installed it.
      console.warn(`[tts] language "${BCP47_LANGUAGE[language]}" unavailable, using engine default`, error);
    });
    await Tts.stop();
    Tts.speak(text);
  } catch (error) {
    console.warn('[tts] speak failed — continuing without voice', error);
  }
}

/** Stops any in-progress announcement immediately — called the instant an alarm starts resolving (NFC/vision/override/snooze/escalation), not after any confirmation-screen delay. */
export async function stopSpeaking(): Promise<void> {
  try {
    await Tts.stop();
  } catch (error) {
    console.warn('[tts] stop failed', error);
  }
}
