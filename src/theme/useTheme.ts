import { useMemo } from 'react';
import { Appearance } from 'react-native';
import { colorScheme as nativeWindColorScheme } from 'nativewind';
import { create } from 'zustand';
import { storage } from '../lib/storage';
import { action, palette, status, statusText, statusTint, type StatusKey, type ThemeMode } from './tokens';

export type ThemePreference = ThemeMode | 'system';

const THEME_STORAGE_KEY = 'theme-preference';

function isThemePreference(value: string | undefined): value is ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system';
}

function resolveSystemMode(): ThemeMode {
  return Appearance.getColorScheme() === 'dark' ? 'dark' : 'light';
}

function readStoredPreference(): ThemePreference {
  const stored = storage.getString(THEME_STORAGE_KEY);
  return isThemePreference(stored) ? stored : 'system';
}

// Runs once, synchronously, at module-evaluation time — i.e. before App's
// first render, since importing this module (transitively, via useTheme) is
// what triggers it. MMKV's read and NativeWind's colorScheme.set are both
// synchronous, so `dark:` classes resolve against the correct scheme on the
// very first paint. No useEffect round-trip, no light-mode flash on a dark
// device.
const initialPreference = readStoredPreference();
nativeWindColorScheme.set(initialPreference);

interface ThemeStoreState {
  preference: ThemePreference;
  mode: ThemeMode;
  setPreference: (preference: ThemePreference) => void;
}

/**
 * Plain Zustand store (no Provider/Context). Components subscribe with a
 * selector, so e.g. a screen that only reads `mode` never re-renders when
 * `preference` changes without `mode` changing — the re-render thrashing a
 * single big Context value would cause doesn't happen here because there's
 * no Context at all.
 */
export const useThemeStore = create<ThemeStoreState>((set) => ({
  preference: initialPreference,
  mode: initialPreference === 'system' ? resolveSystemMode() : initialPreference,
  setPreference: (preference) => {
    storage.set(THEME_STORAGE_KEY, preference);
    nativeWindColorScheme.set(preference);
    set({
      preference,
      mode: preference === 'system' ? resolveSystemMode() : preference,
    });
  },
}));

Appearance.addChangeListener(() => {
  const { preference } = useThemeStore.getState();
  if (preference === 'system') {
    useThemeStore.setState({ mode: resolveSystemMode() });
  }
});

export function useThemeMode(): ThemeMode {
  return useThemeStore((state) => state.mode);
}

export function useThemePreference(): ThemePreference {
  return useThemeStore((state) => state.preference);
}

export function useSetThemePreference(): (preference: ThemePreference) => void {
  return useThemeStore((state) => state.setPreference);
}

export interface ResolvedTheme {
  mode: ThemeMode;
  colors: (typeof palette)[ThemeMode];
  action: typeof action;
  status: typeof status;
  statusTint: (key: StatusKey) => string;
  statusText: (key: StatusKey) => string;
}

/**
 * Theme hook abstraction: screens/components call `useTheme()` and never
 * touch the store or the token module directly. Memoized on `mode` alone, so
 * the returned object is referentially stable across renders that don't
 * change the resolved scheme.
 */
export function useTheme(): ResolvedTheme {
  const mode = useThemeMode();

  return useMemo(
    () => ({
      mode,
      colors: palette[mode],
      action,
      status,
      statusTint,
      statusText: (key: StatusKey) => statusText(key, mode),
    }),
    [mode],
  );
}
