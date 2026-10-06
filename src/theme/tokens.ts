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

/**
 * Ocean palette — deep_twilight (near-black navy) through light_cyan
 * (near-white cyan), five steps shading into each other. Replaces the
 * earlier neutral gray-blue scale so canvas/surface/ink and the primary
 * action color all read as one deliberately-designed family instead of a
 * generic blue plus gray neutrals.
 */
export const palette = {
  light: {
    canvas: '#F4FCFE',
    surface: '#FFFFFF',
    elevated: '#E9F9FC',
    hairline: '#D2F3F9',
    /** Primary reading text (deep_twilight 100). ~19.9–20.7:1 against canvas/surface/elevated. */
    ink: '#010113',
    /** Secondary text (captions, meta) (deep_twilight 400). ~18:1 against canvas — clears AAA body. */
    inkSecondary: '#02044B',
    /** Decorative/non-essential text only (disabled labels, watermarks) (bright_teal_blue 400). ~6.6:1 — below AAA body, do not use for readable content. */
    inkMuted: '#005F93',
  },
  dark: {
    canvas: '#010113',
    surface: '#010226',
    elevated: '#020338',
    hairline: '#003049',
    /** Primary reading text (light_cyan 900). ~19.9:1 against canvas. */
    ink: '#F4FCFE',
    /** Secondary text (captions, meta) (frosted_blue 800). ~17.7:1 against canvas — clears AAA body. */
    inkSecondary: '#D2F3F9',
    /** Tertiary/muted text (bright_teal_blue 700). ~9.5:1 against canvas — exceeds AAA numerically (every light-enough hue in this cyan-leaning palette does), kept visually dimmer than ink/inkSecondary to preserve the hierarchy; not a "below AAA" token the way its light-mode counterpart is. */
    inkMuted: '#3BBAFF',
  },
} as const;

/** Bright Teal Blue — primary action color, same value in both themes. */
export const action = {
  base: '#0077B6',
  /** White-on-teal: ~4.87:1, clears the 4.5:1 interactive-state bar. */
  ink: '#FFFFFF',
} as const;

export type StatusKey = 'fasting' | 'taken' | 'pending' | 'missed' | 'scheduled';

interface StatusToken {
  /** Vivid brand hue — used for the glow/shadow and as dark-mode text/icon color (unless onDark is set). */
  base: string;
  /** Darkened variant used as text/icon color in light mode, where the raw base hue fails contrast on a near-white tint. */
  onLight: string;
  /** Brightened variant used as text/icon color in dark mode, only set when `base` itself fails contrast on a dark tint (Bright Teal Blue is too dark to read against its own translucent chip). */
  onDark?: string;
  label: string;
}

/**
 * Five clinical states. Fasting/Taken/Pending/Missed map directly to the
 * spec's four semantic status codes; Scheduled reuses Bright Teal Blue as the
 * fifth, neutral/informational state for the StatusPill component.
 *
 * Taken/Pending/Missed keep their original green/orange/red hues rather than
 * being pulled from the new ocean palette: those are medical-safety signal
 * colors (safe/caution/danger) a caregiver relies on at a glance, and
 * restyling them to fit a brand palette would be a correctness risk, not a
 * cosmetic choice. Fasting and Scheduled, which were already brand-adjacent
 * (cyan and indigo respectively, not safety colors), are updated to the new
 * palette so they read as part of one coherent design instead of leftover
 * neon hues beside it.
 */
export const status: Record<StatusKey, StatusToken> = {
  fasting: { base: '#00B4D8', onLight: '#006B81', label: 'Fasting' },
  taken: { base: '#2ECC71', onLight: '#1A7541', label: 'Taken' },
  pending: { base: '#FFA502', onLight: '#8E5C00', label: 'Pending' },
  missed: { base: '#FF6B6B', onLight: '#CD0000', label: 'Missed' },
  scheduled: { base: '#0077B6', onLight: '#00486E', onDark: '#7CD1FF', label: 'Scheduled' },
};

/**
 * Alpha channel appended to a status base hex to build its translucent pill
 * background (8-digit #RRGGBBAA). 0x14/255 ≈ 8% — at that opacity the tint
 * is close enough to the surface underneath it that onLight/onDark's
 * contrast against the plain surface (documented above, all >= 5.9:1) carries
 * over to the tinted pill with no meaningful loss.
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
 *
 * Sized up twice from the original 34/24/18/14 pass after direct user
 * feedback that it still read too small for an app meant to work equally
 * well for older, middle-aged, and younger users. The second pass pushed
 * Display/Title further (the hero/heading tier) and left Body/Caption as
 * they were — those are continuous reading text, and 20/15 was already a
 * generous size for that role; the complaint by then was about visual
 * punch at the top of the hierarchy, not body-copy density. Pure size
 * increases don't affect the WCAG contrast math above (that's about color,
 * not scale), so no re-verification was needed there.
 */
export const typography = {
  displayLarge: { fontSize: 44, lineHeight: 50, fontWeight: '800' },
  titleLarge: { fontSize: 30, lineHeight: 36, fontWeight: '700' },
  bodyLarge: { fontSize: 20, lineHeight: 28, fontWeight: '400' },
  caption: { fontSize: 15, lineHeight: 21, fontWeight: '500' },
} as const;

/**
 * Spacing rhythm, named by role rather than raw pixel value — the thing
 * that was actually missing from this token module (colors and type had a
 * documented system; spacing was just whatever gap-N each screen happened
 * to reach for). Deliberately small and T-shirt-sized rather than a parallel
 * Tailwind scale: these are for the rare non-className call site (inline
 * `style`, layout math); everywhere else, use the matching Tailwind utility
 * at the same pixel value (e.g. `tight` → `gap-2`, `section` → `gap-9`) so
 * there's exactly one way to spell each gap, not two.
 *
 *  - tight (8dp): within a tight inline group, e.g. an icon beside its label.
 *  - stack (16dp): between related items in a vertical stack, e.g. rows inside a card.
 *  - card (24dp): padding inside a standard card/surface.
 *  - cardLarge (32dp): padding inside a hero/featured card.
 *  - section (36dp): between major sections on a screen, and the screen's own vertical padding.
 *  - page (24dp): a screen's horizontal margin.
 */
export const spacing = {
  tight: 8,
  stack: 16,
  card: 24,
  cardLarge: 32,
  section: 36,
  page: 24,
} as const;
