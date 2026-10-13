import type { ReactNode } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export interface GlassCardProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  glowColor?: string;
  hasGlow?: boolean;
}

/**
 * Premium glassmorphism card container — the shared floating-glass surface
 * for Home's hero cards. Both themes get a translucent fill (not just dark
 * mode) so the ambient background behind it actually shows through; a flat
 * opaque fill in light mode would defeat the point of a glass system. Dark
 * additionally gets the specular top-edge highlight a glass surface picks
 * up under a light source — light mode skips it, since the same light-on
 * line reads as a stray artifact rather than a sheen against a pale canvas.
 *
 * Shadows are a layered contact + ambient pair via the cross-platform
 * `boxShadow` style (Fabric), not the old shadow-prop + elevation combo —
 * `elevation` alone renders a crude, flat Material drop shadow on Android
 * that ignores color/blur entirely (see MetricCard, which this mirrors).
 */
export function GlassCard({
  children,
  style,
  className = '',
  glowColor = '#3B82F6',
  hasGlow = false,
}: GlassCardProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const ambientColor = hasGlow ? `${glowColor}59` : isDark ? 'rgba(0, 0, 0, 0.35)' : 'rgba(57, 88, 134, 0.12)';
  const contactColor = hasGlow ? `${glowColor}26` : isDark ? 'rgba(0, 0, 0, 0.3)' : 'rgba(57, 88, 134, 0.08)';

  return (
    <View
      className={`rounded-3xl ${className}`}
      style={[
        {
          backgroundColor: isDark ? 'rgba(31, 41, 55, 0.75)' : 'rgba(255, 255, 255, 0.70)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
          boxShadow: isDark
            ? [
                { offsetX: 0, offsetY: 2, blurRadius: 4, color: contactColor },
                { offsetX: 0, offsetY: 12, blurRadius: 28, spreadDistance: -4, color: ambientColor },
              ]
            : [
                { offsetX: 0, offsetY: 1, blurRadius: 3, color: contactColor },
                { offsetX: 0, offsetY: 10, blurRadius: 24, spreadDistance: -4, color: ambientColor },
              ],
        },
        style,
      ]}
    >
      {/* Specular frosted glass highlight on upper edge */}
      {isDark ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 20,
            right: 20,
            height: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.12)',
          }}
        />
      ) : null}
      {children}
    </View>
  );
}
