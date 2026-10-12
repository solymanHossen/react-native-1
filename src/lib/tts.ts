import Tts from 'react-native-tts';
import type { LanguageCode } from '../i18n/useLanguage';

const BCP47_LANGUAGE: Record<LanguageCode, string> = {
  en: 'en-US',
  bn: 'bn-BD',
};

/**
 * Routes the announcement through Android's ALARM audio stream instead of
 * the engine's default (MUSIC) stream. Without this, `Tts.speak()` is
 * perfectly correct code that simply speaks into silence on any phone with
 * media volume turned down or muted — exactly the state a phone is likely to
 * be in overnight, i.e. exactly when a medication alarm matters most. The
 * alarm's own tone/vibration (via Notifee's `AlarmType.SET_ALARM_CLOCK`)
 * already plays on the ALARM stream specifically so it can't be silenced
 * that way; the spoken announcement needs the same guarantee.
 * `iosVoiceId`/`rate` are intentionally omitted (not just empty-stringed):
 * the native iOS module reads them with `valueForKey:`, which returns nil
 * for an absent key and leaves voice/rate at their existing defaults,
 * so this is Android-only in effect despite the shared call site. Typed
 * as `any` because `react-native-tts`'s `Options` type requires
 * `iosVoiceId`/`rate` alongside `androidParams` even though the native code
 * on both platforms treats every one of these keys as optional.
 */
const ANDROID_ALARM_STREAM_OPTIONS = {
  androidParams: {
    KEY_PARAM_STREAM: 'STREAM_ALARM',
    KEY_PARAM_VOLUME: 1,
    KEY_PARAM_PAN: 0,
  },
} as any;

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
    Tts.speak(text, ANDROID_ALARM_STREAM_OPTIONS);
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
