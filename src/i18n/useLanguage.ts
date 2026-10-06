import { useCallback } from 'react';
import { create } from 'zustand';
import { storage } from '../lib/storage';
import { bn } from './bn';
import { en } from './en';
import type { TranslationKey } from './types';

export type LanguageCode = 'en' | 'bn';

const LANGUAGE_STORAGE_KEY = 'language-preference';

function isLanguageCode(value: string | undefined): value is LanguageCode {
  return value === 'en' || value === 'bn';
}

function readStoredLanguage(): LanguageCode {
  const stored = storage.getString(LANGUAGE_STORAGE_KEY);
  return isLanguageCode(stored) ? stored : 'en';
}

const DICTIONARIES: Record<LanguageCode, typeof en> = { en, bn };

// Runs once at module-evaluation time, same reasoning as the theme store's
// own synchronous MMKV read — every screen's first render needs the right
// language immediately, not after a useEffect round-trip that would flash
// English before correcting itself.
const initialLanguage = readStoredLanguage();

interface LanguageState {
  language: LanguageCode;
  setLanguage: (language: LanguageCode) => void;
}

/**
 * Plain Zustand store, no Provider — same pattern as `useThemeStore`. Not
 * merged into that store: language and theme are independent axes a screen
 * might subscribe to one of without caring about the other.
 */
export const useLanguageStore = create<LanguageState>((set) => ({
  language: initialLanguage,
  setLanguage: (language) => {
    storage.set(LANGUAGE_STORAGE_KEY, language);
    set({ language });
  },
}));

function readPath(dictionary: typeof en, path: string): string | undefined {
  return path
    .split('.')
    .reduce<unknown>((node, segment) => (node && typeof node === 'object' ? (node as Record<string, unknown>)[segment] : undefined), dictionary) as
    | string
    | undefined;
}

/** `{{name}}`-style placeholders — enough for every string in this app (a name, a count, a formatted time), not a full ICU message-format engine this app has no use for. */
export type TranslationVars = Record<string, string | number>;

function interpolate(text: string, vars?: TranslationVars): string {
  if (!vars) return text;
  let result = text;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, String(value));
  }
  return result;
}

export interface UseTranslationResult {
  t: (key: TranslationKey, vars?: TranslationVars) => string;
  language: LanguageCode;
}

/**
 * The one hook every screen uses for display text. Falls back to the
 * English dictionary (never to the raw key) if a Bengali entry is somehow
 * missing — `bn.ts`'s `typeof en` annotation should make that impossible at
 * compile time, but a runtime fallback costs nothing and means a future
 * mistake degrades to the wrong language instead of a visible raw key.
 */
export function useTranslation(): UseTranslationResult {
  const language = useLanguageStore((state) => state.language);

  const t = useCallback(
    (key: TranslationKey, vars?: TranslationVars) => {
      const text = readPath(DICTIONARIES[language], key) ?? readPath(en, key) ?? key;
      return interpolate(text, vars);
    },
    [language],
  );

  return { t, language };
}
