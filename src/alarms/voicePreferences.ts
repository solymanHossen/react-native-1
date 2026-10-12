import { create } from 'zustand';
import { storage } from '../lib/storage';

const VOICE_ENABLED_STORAGE_KEY = 'voice-announcements-enabled';

function readStoredVoiceEnabled(): boolean {
  const stored = storage.getBoolean(VOICE_ENABLED_STORAGE_KEY);
  // Defaults on: a spoken reminder is the whole point of this feature, and a
  // patient who never opens Settings should still get it on day one.
  return stored ?? true;
}

interface VoicePreferenceState {
  voiceAnnouncementsEnabled: boolean;
  setVoiceAnnouncementsEnabled: (enabled: boolean) => void;
}

/** Plain Zustand store, no Provider — same pattern as useLanguageStore/useThemeStore, so the Settings toggle and AlarmScreen both read the live value with no remount needed. */
export const useVoicePreferenceStore = create<VoicePreferenceState>((set) => ({
  voiceAnnouncementsEnabled: readStoredVoiceEnabled(),
  setVoiceAnnouncementsEnabled: (enabled) => {
    storage.set(VOICE_ENABLED_STORAGE_KEY, enabled);
    set({ voiceAnnouncementsEnabled: enabled });
  },
}));

/** Non-hook accessor for code outside React (the alarm-fired path runs before any component has mounted). */
export function isVoiceAnnouncementsEnabled(): boolean {
  return useVoicePreferenceStore.getState().voiceAnnouncementsEnabled;
}
