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
 * Premium glassmorphism card container.
 * Strictly adheres to specifications:
 * Semi-transparent dark surfaces (#1F2937 / rgba(31, 41, 55, 0.75))
 * with a subtle 1px border stroke (rgba(255, 255, 255, 0.08)) and
 * soft ambient drop shadows to create a floating layered hierarchy.
 */
export function GlassCard({
  children,
  style,
  className = '',
  glowColor = '#3B82F6',
  hasGlow = false,
}: GlassCardProps) {
  const theme = useTheme();

  return (
    <View
      className={`rounded-3xl ${className}`}
      style={[
        {
          backgroundColor: theme.mode === 'dark' ? 'rgba(31, 41, 55, 0.75)' : theme.colors.elevated,
          borderWidth: 1,
          borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
          shadowColor: hasGlow ? glowColor : '#000000',
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: theme.mode === 'dark' ? (hasGlow ? 0.35 : 0.35) : 0.08,
          shadowRadius: 20,
          elevation: 8,
        },
        style,
      ]}
    >
      {/* Specular frosted glass highlight on upper edge */}
      {theme.mode === 'dark' ? (
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
