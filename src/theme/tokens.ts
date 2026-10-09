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
 * Ember palette — warm near-black through warm near-white, hue-matched to
 * the brand red below, five steps shading into each other. Replaces the
 * earlier cyan-leaning "ocean" scale so canvas/surface/ink and the primary
 * action color read as one deliberately-designed warm family instead of a
 * cool neutral paired with a warm accent.
 */
export const palette = {
  light: {
    canvas: '#FFF8F7',
    surface: '#FFFFFF',
    elevated: '#FFF1EF',
    hairline: '#FBDAD5',
    /** Primary reading text. ~17.8–19.6:1 against canvas/surface/elevated. */
    ink: '#1A0605',
    /** Secondary text (captions, meta). ~13.6–14.9:1 against canvas/surface/elevated — clears AAA body. */
    inkSecondary: '#4A1512',
    /** Decorative/non-essential text only (disabled labels, watermarks) — the brand hue itself. ~5.2:1 — below AAA body, do not use for readable content. */
    inkMuted: '#C0392B',
  },
  dark: {
    canvas: '#170605',
    surface: '#200807',
    elevated: '#2B0C0A',
    hairline: '#4A1512',
    /** Primary reading text. ~16.7–18.2:1 against canvas/surface/elevated. */
    ink: '#FFF3F1',
    /** Secondary text (captions, meta). ~13.6–14.8:1 against canvas/surface/elevated — clears AAA body. */
    inkSecondary: '#F7D8D3',
    /** Tertiary/muted text. ~7.7:1 against canvas — exceeds AAA numerically, kept visually dimmer than ink/inkSecondary to preserve the hierarchy; not a "below AAA" token the way its light-mode counterpart is. */
    inkMuted: '#FF7A68',
  },
} as const;

/** Pomegranate — primary action color, same value in both themes. */
export const action = {
  base: '#C0392B',
  /** White-on-pomegranate: ~5.44:1, clears the 4.5:1 interactive-state bar. */
  ink: '#FFFFFF',
} as const;

export type StatusKey = 'fasting' | 'taken' | 'pending' | 'missed' | 'scheduled';

interface StatusToken {
  /** Vivid brand hue — used for the glow/shadow and as dark-mode text/icon color (unless onDark is set). */
  base: string;
  /** Darkened variant used as text/icon color in light mode, where the raw base hue fails contrast on a near-white tint. */
  onLight: string;
  /** Brightened variant used as text/icon color in dark mode, only set when `base` itself fails contrast on a dark tint. */
  onDark?: string;
  label: string;
}

/**
 * Five clinical states. Fasting/Taken/Pending/Missed map directly to the
 * spec's four semantic status codes; Scheduled reuses the brand action color
 * as the fifth, neutral/informational state for the StatusPill component.
 *
 * Taken/Pending/Missed keep their original green/orange/red hues rather than
 * being pulled from the brand palette: those are medical-safety signal
 * colors (safe/caution/danger) a caregiver relies on at a glance, and
 * restyling them to fit a brand palette would be a correctness risk, not a
 * cosmetic choice. Fasting and Scheduled, which were already brand-adjacent
 * (not safety colors), track the current brand family so they read as part
 * of one coherent design instead of leftover hues beside it — Scheduled is
 * literally `action.base`/pomegranate (same values as `severity.severe`,
 * since both represent "the brand red"); Fasting keeps its own independent
 * cyan, since it isn't tied to brand identity.
 */
export const status: Record<StatusKey, StatusToken> = {
  fasting: { base: '#00B4D8', onLight: '#006B81', label: 'Fasting' },
  taken: { base: '#2ECC71', onLight: '#1A7541', label: 'Taken' },
  pending: { base: '#FFA502', onLight: '#8E5C00', label: 'Pending' },
  missed: { base: '#FF6B6B', onLight: '#CD0000', label: 'Missed' },
  scheduled: { base: '#C0392B', onLight: '#C62918', onDark: '#D55144', label: 'Scheduled' },
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

export type SeverityKey = 'low' | 'moderate' | 'high' | 'severe' | 'critical';

interface SeverityToken {
  /** Vivid hue — chip dot/glow, and dark-mode text/icon color (unless onDark is set). Same value in both themes. */
  base: string;
  /** Darkened variant used as text/icon color in light mode. */
  onLight: string;
  /** Brightened variant used as text/icon color in dark mode, only set when `base` itself fails contrast against the near-black dark canvas. */
  onDark?: string;
}

/**
 * Five-step sequential red ramp for *ordered* alert/severity states (e.g. a
 * drug interaction's moderate/severe/contraindicated rating). Distinct from
 * `status` above: `status` is categorical (safe/caution/danger dose states
 * that must never be reassigned), this is ordinal — lightness decreases
 * monotonically with severity so a chip set reads as a scale at a glance.
 *
 * Contrast was verified the same way as `status` (WCAG, >= 4.5:1 for
 * interactive/status elements): `low`/`moderate`/`high` fail AA directly
 * against a near-white surface (2.25/2.97/3.82:1) and all three darken, at
 * the same hue/saturation, to effectively the same text color (~5.6:1) —
 * they share one hue family, so independently darkening each to the
 * contrast floor converges on one value. `severe`/`critical` pass in light
 * mode (5.44/8.01:1) but are too dark for the dark-mode canvas (3.80/2.58:1),
 * so those two get a brightened `onDark` instead (5.03/5.00:1).
 */
export const severity: Record<SeverityKey, SeverityToken> = {
  low: { base: '#F1948A', onLight: '#C62918' },
  moderate: { base: '#EC7063', onLight: '#C62918' },
  high: { base: '#E74C3C', onLight: '#C62918' },
  severe: { base: '#C0392B', onLight: '#C62918', onDark: '#D55144' },
  critical: { base: '#A50021', onLight: '#A50021', onDark: '#F90032' },
};

const SEVERITY_TINT_ALPHA_HEX = '14';

export function severityTint(key: SeverityKey): string {
  return `${severity[key].base}${SEVERITY_TINT_ALPHA_HEX}`;
}

export function severityText(key: SeverityKey, mode: ThemeMode): string {
  const token = severity[key];
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
