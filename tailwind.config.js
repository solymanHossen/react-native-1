/** @type {import('tailwindcss').Config} */
// Keep these hex values in sync with src/theme/tokens.ts — Tailwind's config
// is evaluated by a plain Node build step and can't import that TS module
// directly, so the palette is intentionally duplicated between the two.
module.exports = {
    // NOTE: Update this to include the paths to all files that contain Nativewind classes.
    content: ["./App.tsx", "./src/**/*.{js,jsx,ts,tsx}"],
    presets: [require("nativewind/preset")],
    theme: {
        extend: {
            colors: {
                // Theme-INDEPENDENT tokens only. NativeWind's `dark:` variant
                // resolves via RN's Appearance.setColorScheme(), which on
                // Android calls AppCompatDelegate.setDefaultNightMode() — that
                // only repaints the app if the native Activity/theme is wired
                // for AppCompat day/night switching, which this bare RN
                // template isn't, and patching that is a native-project change
                // out of proportion to a color toggle. Verified on-device: a
                // manual light/dark override left `dark:` classes unchanged
                // while components reading src/theme/useTheme.ts's `mode`
                // (Zustand, not NativeWind) repainted instantly. So every
                // theme-dependent color in this app — light AND dark — is
                // consumed via useTheme() + an inline `style`, never via a
                // `dark:` className. These tokens are therefore the
                // theme-agnostic ones only.
                // Pomegranate — primary action, same value in both themes
                action: "#C0392B",
                "action-ink": "#FFFFFF",
                // Semantic status codes (vivid/base hue — see tokens.ts for
                // the per-theme text/tint variants StatusPill resolves at runtime)
                fasting: "#00B4D8",
                taken: "#2ECC71",
                pending: "#FFA502",
                missed: "#FF6B6B",
                // Five-step sequential red ramp for ordered severity states
                // (e.g. drug interaction risk) — see tokens.ts `severity`.
                severity: {
                    low: "#F1948A",
                    moderate: "#EC7063",
                    high: "#E74C3C",
                    severe: "#C0392B",
                    critical: "#A50021",
                },
            },
            // Geriatric/low-vision type scale — mirrors src/theme/tokens.ts `typography`.
            fontSize: {
                "display-lg": ["44px", { lineHeight: "50px", fontWeight: "800" }],
                "title-lg": ["30px", { lineHeight: "36px", fontWeight: "700" }],
                "body-lg": ["20px", { lineHeight: "28px", fontWeight: "400" }],
                caption: ["15px", { lineHeight: "21px", fontWeight: "500" }],
            },
            // Absolute minimum interactive hitbox (56x56dp), usable as
            // min-h-hit / min-w-hit on any touchable boundary.
            minHeight: {
                hit: "56px",
            },
            minWidth: {
                hit: "56px",
            },
        },
    },
    plugins: [],
}
