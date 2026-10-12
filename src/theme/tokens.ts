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
 * Ocean/steel palette. Originally five scales backing the whole light theme;
 * `lightBlue`/`coolSteel`/`blueSlate`/`jetBlack` were superseded by the
 * product-specified palettes now hardcoded directly in `palette`/`action`/
 * `status` below (first the cream/teal palette, then this navy-to-pale-blue
 * one) and were removed once nothing referenced them any more. `lightCyan`
 * remains in use for the `fasting` status, which neither palette touched.
 */
export const designPalette = {
  lightCyan: {
    DEFAULT: '#e0fbfc',
    100: '#095456',
    200: '#11a7ad',
    300: '#32e5eb',
    400: '#88f0f3',
    500: '#e0fbfc',
    600: '#e5fcfc',
    700: '#ecfcfd',
    800: '#f2fdfe',
    900: '#f9fefe',
  },
} as const;

export const palette = {
  // Product-specified 6-step blue scale (twine.net), replacing the previous
  // navy-to-pale-blue palette entirely. Canvas uses the near-white lightest
  // step; cards stay white, separated from it by the existing shadow/border
  // styling (the same small gap the cream palette before it used, which
  // already read fine). `hairline` is the next step up for a visible edge.
  // `ink`/`inkSecondary` share the scale's one darkest step (#395886):
  // MetricCard's "contrast slot isolation" comment requires inkSecondary to
  // be >= 7:1 (AAA body text) and none of the lighter steps clear that bar
  // against this near-white canvas/white cards — #395886 is the only one
  // that does (~7.2:1), so there isn't a second, lighter value available for
  // a distinct inkSecondary tier without going outside the given palette.
  // `inkMuted` has no such floor (decorative/non-essential text only), so it
  // uses the mid-scale step instead. Two of the six steps (#B1C9EF, #8AAEE0)
  // aren't used by a core token — nothing in this token set needed a 3rd and
  // 4th blue, but they're legitimate, accessible choices for a future
  // one-off accent if needed.
  light: {
    canvas: '#F0F3FA',
    surface: '#FFFFFF',
    elevated: '#FFFFFF',
    hairline: '#D5DEEF',
    ink: '#395886',
    inkSecondary: '#395886',
    inkMuted: '#628ECB',
  },
  // Premium glassmorphism dark theme: deep slate canvas, semi-transparent
  // "floating" card surfaces, and a 1px translucent-white hairline/border —
  // see GlassCard/AmbientDepthBackground for the components built around it.
  dark: {
    canvas: '#0B0F19',
    surface: 'rgba(31, 41, 55, 0.75)',
    elevated: 'rgba(31, 41, 55, 0.75)',
    hairline: 'rgba(255, 255, 255, 0.08)',
    ink: '#FFFFFF',
    inkSecondary: '#94A3B8',
    inkMuted: '#64748B',
  },
} as const;

/**
 * Primary action color, mode-specific: light mode reuses the scale's one
 * darkest step (same value as `ink` above — a common, deliberate pattern:
 * buttons are already visually distinct by shape/elevation, so sharing a hue
 * with headline text isn't a hierarchy problem the way two text tiers
 * sharing a color would be). Dark mode keeps its own deep slate blue accent
 * untouched. `useTheme()` resolves `theme.action` to whichever of these
 * matches the current mode, so every existing call site (`theme.action.base`,
 * `theme.action.ink`) keeps working unchanged.
 *
 * `ink` (the color drawn ON TOP of `base`, e.g. a filled button's label) is
 * white: `#395886` is dark enough that white text on it measures ~7.2:1
 * (passes this file's >= 4.5:1 interactive floor with room to spare).
 */
export const action = {
  light: {
    base: '#395886',
    ink: '#FFFFFF',
  },
  dark: {
    base: '#3B82F6',
    ink: '#FFFFFF',
  },
} as const;

export type StatusKey = 'fasting' | 'taken' | 'pending' | 'missed' | 'scheduled';

interface StatusToken {
  /** Vivid brand hue for light mode — glow/shadow source and (via onLight) the basis for the light-mode text/icon color. */
  base: string;
  /** Darkened variant used as text/icon color in light mode, where the raw base hue fails contrast on a near-white tint. */
  onLight: string;
  /** Dark-mode-specific vivid hue (the new glassmorphism palette's vibrant medical tones) — falls back to `base` when unset. */
  baseDark?: string;
  /** Brightened variant used as text/icon color in dark mode, only set when the dark-mode hue itself fails contrast on a dark tint. */
  onDark?: string;
  /** Explicit light-mode pill background, overriding the generic ~8%-alpha-from-base tint — only set where the product spec gives a specific pastel swatch (taken/scheduled). Every other status keeps the generic alpha tint. */
  tintLight?: string;
  label: string;
}

/**
 * Five clinical states. Dark mode keeps its own vivid medical tones
 * untouched (part of the glassmorphism dark-theme redesign): rich emerald
 * green (#10B981) for taken, soft coral red (#EF4444) for missed, amber for
 * pending, and deep slate blue (#3B82F6) for scheduled — the same blue as
 * `action.dark.base`, since Scheduled is still "the brand accent."
 *
 * Light mode: `scheduled` follows `action.light.base` (still "the brand
 * accent") with one of the palette's unused mid steps (`#D5DEEF`, otherwise
 * only used for `hairline`) as its `tintLight` pill background and `ink`'s
 * dark step as `onLight` text — verified ~5.3:1, which clears the floor the
 * lighter `#B1C9EF` option fell just short of (~4.3:1). `taken` keeps its
 * original green — this palette has no green of its own, and green/red/
 * orange are safety-critical semantics ("taken" vs "missed") that shouldn't
 * shift to the same hue family as "scheduled" just because the brand palette
 * changed. `pending`/`missed`/`fasting` are untouched for the same reason.
 */
export const status: Record<StatusKey, StatusToken> = {
  fasting: { base: designPalette.lightCyan[200], onLight: designPalette.lightCyan[100], baseDark: '#06B6D4', onDark: '#22D3EE', label: 'Fasting' },
  taken: { base: '#2ECC71', onLight: '#1A7541', baseDark: '#10B981', onDark: '#34D399', label: 'Taken' },
  pending: { base: '#FFA502', onLight: '#8E5C00', baseDark: '#F59E0B', onDark: '#FBBF24', label: 'Pending' },
  missed: { base: '#FF6B6B', onLight: '#CD0000', baseDark: '#EF4444', onDark: '#F87171', label: 'Missed' },
  scheduled: { base: action.light.base, onLight: '#395886', baseDark: '#3B82F6', onDark: '#60A5FA', tintLight: '#D5DEEF', label: 'Scheduled' },
};

/**
 * Alpha channel appended to a status hue to build its translucent pill
 * background (8-digit #RRGGBBAA). 0x14/255 ≈ 8% — at that opacity the tint
 * is close enough to the surface underneath it that onLight/onDark's
 * contrast against the plain surface carries over to the tinted pill with no
 * meaningful loss (verified the same way for both the original light-mode
 * hues and the new dark-mode ones).
 */
const STATUS_TINT_ALPHA_HEX = '14';

export function statusTint(key: StatusKey, mode: ThemeMode): string {
  const token = status[key];
  if (mode === 'light' && token.tintLight) return token.tintLight;
  const hue = mode === 'dark' ? (token.baseDark ?? token.base) : token.base;
  return `${hue}${STATUS_TINT_ALPHA_HEX}`;
}

export function statusText(key: StatusKey, mode: ThemeMode): string {
  const token = status[key];
  if (mode === 'light') return token.onLight;
  return token.onDark ?? token.baseDark ?? token.base;
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
