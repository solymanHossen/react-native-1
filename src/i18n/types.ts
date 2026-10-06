import type { en } from './en';

/**
 * Recursively joins nested object keys into dot-paths ("home.nextDose",
 * "rhythm.skipSheet.subtitle") so every call to `t()` is checked against the
 * dictionary's actual shape at compile time — a typo or a since-renamed key
 * is a type error here, not a silent blank string on a device screen.
 */
type Join<K, P> = K extends string ? (P extends string ? `${K}.${P}` : never) : never;

type Paths<T> = T extends Record<string, unknown>
  ? { [K in keyof T]: K extends string ? (T[K] extends Record<string, unknown> ? Join<K, Paths<T[K]>> : K) : never }[keyof T]
  : never;

export type TranslationKey = Paths<typeof en>;
