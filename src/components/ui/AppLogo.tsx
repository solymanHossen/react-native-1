import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export interface AppLogoProps {
  /** Badge edge length in dp. Icon and corner radius scale proportionally. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * Perfectly proportioned app mark for Medicine Reminder, following Apple iOS
 * continuous-squircle curvature. The source image is a flat, opaque tile (the
 * same artwork used for the app icon), so it's clipped to a rounded square
 * here rather than rendered as a plain box. Dark mode adds the glassmorphism
 * redesign's subtle luminescent border + blue-glow depth; light mode stays
 * a plain clipped mark (as it always was) so it doesn't pick up a dark-tinted
 * frame against a light canvas.
 */
export function AppLogo({ size = 40, style }: AppLogoProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const borderRadius = Math.round(size * 0.24);

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          borderRadius,
          overflow: 'hidden',
          backgroundColor: isDark ? '#1E293B' : theme.colors.surface,
          borderWidth: isDark ? 1 : 0,
          borderColor: 'rgba(255, 255, 255, 0.12)',
          shadowColor: isDark ? theme.action.base : undefined,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: isDark ? 0.25 : 0,
          shadowRadius: 8,
          elevation: isDark ? 4 : 0,
        },
        style,
      ]}
    >
      <Image
        source={require('../../../assets/branding/medicine-reminder-logo.png')}
        style={{ width: size, height: size }}
        resizeMode="cover"
        accessibilityRole="image"
        accessibilityLabel="Medicine Reminder"
      />
    </View>
  );
}
