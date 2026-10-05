/**
 * Design token source of truth for runtime (JS/TS) consumers — Zustand store,
 * StatusPill's dynamic tint/text resolution, StatusBar colors, Reanimated
 * color interpolation, etc.
 *
 * Static layout/spacing/typography is expressed as NativeWind utility classes
 * instead (see tailwind.config.js) so it compiles away at build time. The hex
 * values below are intentionally duplicated there — Tailwind's config is
 * evaluated by a separate (non-TS) build step, so the two can't share a single
 * module without adding a transpile step. Keep both in sync when changing a color.
 *
 * Every background/text pairing below was verified with a WCAG contrast
 * calculator against the exact surfaces it's used on (see the StatusPill
 * token comments). "Strictly exceeds AAA" per the spec is treated as:
 * body text >= 7:1, interactive/status elements >= 4.5:1.
 */

export type ThemeMode = 'light' | 'dark';

/** Absolute minimum touch target edge, enforced on every interactive primitive. */
export const MIN_HITBOX = 56;

export const palette = {
  light: {
    canvas: '#F8F9FD',
    surface: '#FFFFFF',
    elevated: '#EEF2F9',
    hairline: '#E0E6F0',
    /** Primary reading text. 17.2–19.3:1 against canvas/surface/elevated. */
    ink: '#0B0E14',
    /** Secondary text (captions, meta). 8.46:1 against surface — still clears AAA body. */
    inkSecondary: '#454D60',
    /** Decorative/non-essential text only (disabled labels, watermarks). ~5.9:1 — below AAA body, do not use for readable content. */
    inkMuted: '#5B6476',
  },
  dark: {
    canvas: '#090A0F',
    surface: '#141721',
    elevated: '#1C2234',
    hairline: '#2A324B',
    /** Primary reading text. 14.7–18.4:1 against canvas/surface/elevated. */
    ink: '#F5F7FA',
    /** Secondary text (captions, meta). 8.97:1 against surface — still clears AAA body. */
    inkSecondary: '#AEB8CC',
    /** Decorative/non-essential text only. ~5.7:1 — below AAA body, do not use for readable content. */
    inkMuted: '#8891A7',
  },
} as const;

/** Clinical Indigo — primary action color, same value in both themes. */
export const action = {
  base: '#2563EB',
  /** White-on-indigo: 5.17:1, clears the 4.5:1 interactive-state bar. */
  ink: '#FFFFFF',
} as const;

export type StatusKey = 'fasting' | 'taken' | 'pending' | 'missed' | 'scheduled';

interface StatusToken {
  /** Vivid brand hue — used for the glow/shadow and as dark-mode text/icon color (unless onDark is set). */
  base: string;
  /** Darkened variant used as text/icon color in light mode, where the raw base hue fails contrast on a near-white tint. */
  onLight: string;
  /** Brightened variant used as text/icon color in dark mode, only set when `base` itself fails contrast on a dark tint (Clinical Indigo is too dark to read against its own translucent chip). */
  onDark?: string;
  label: string;
}

/**
 * Five clinical states. Fasting/Taken/Pending/Missed map directly to the
 * spec's four semantic status codes; Scheduled reuses Clinical Indigo as the
 * fifth, neutral/informational state for the StatusPill component.
 */
export const status: Record<StatusKey, StatusToken> = {
  fasting: { base: '#00E5FF', onLight: '#007280', label: 'Fasting' },
  taken: { base: '#2ECC71', onLight: '#1A7541', label: 'Taken' },
  pending: { base: '#FFA502', onLight: '#8E5C00', label: 'Pending' },
  missed: { base: '#FF6B6B', onLight: '#CD0000', label: 'Missed' },
  scheduled: { base: '#2563EB', onLight: '#1556E5', onDark: '#6591F1', label: 'Scheduled' },
};

/**
 * Alpha channel appended to a status base hex to build its translucent pill
 * background (8-digit #RRGGBBAA). 0x14/255 ≈ 8% — verified by calculator to
 * hold a text-on-tint contrast >= 4.5:1 for every status × surface × theme
 * combination (the binding/worst case is Missed-on-Elevated and
 * Scheduled-on-Elevated, both ~4.68–4.83:1).
 */
const STATUS_TINT_ALPHA_HEX = '14';

export function statusTint(key: StatusKey): string {
  return `${status[key].base}${STATUS_TINT_ALPHA_HEX}`;
}

export function statusText(key: StatusKey, mode: ThemeMode): string {
  const token = status[key];
  return mode === 'light' ? token.onLight : (token.onDark ?? token.base);
}

/**
 * Geriatric/low-vision type scale. Mirrors the `fontSize` entries in
 * tailwind.config.js (display-lg/title-lg/body-lg/caption) for call sites
 * that need raw numbers instead of a className (e.g. measuring text, or
 * styling a component that takes a numeric `size` prop).
 */
export const typography = {
  displayLarge: { fontSize: 34, lineHeight: 40, fontWeight: '700' },
  titleLarge: { fontSize: 24, lineHeight: 30, fontWeight: '600' },
  bodyLarge: { fontSize: 18, lineHeight: 26, fontWeight: '400' },
  caption: { fontSize: 14, lineHeight: 20, fontWeight: '500' },
} as const;
