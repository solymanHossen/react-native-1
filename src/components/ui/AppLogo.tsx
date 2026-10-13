import { Image, View, type StyleProp, type ViewStyle } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export interface AppLogoProps {
  /** Badge edge length in dp. Icon and corner radius scale proportionally. */
  size?: number;
  style?: StyleProp<ViewStyle>;
}

/**
 * App mark for Medicine Reminder. The source image is already a self-contained
 * squircle icon (its own continuous-corner mask + pale backdrop + ring baked
 * in as real alpha transparency around the edges), so it's rendered as-is
 * rather than clipped by a separately computed radius here. Dark mode adds
 * the glassmorphism redesign's subtle blue-glow depth via a drop shadow only
 * (no hard border, since one drawn at a slightly different curve than the
 * icon's own mask would show as a mismatched seam through the transparent
 * corners).
 */
export function AppLogo({ size = 40, style }: AppLogoProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          shadowColor: isDark ? theme.action.base : undefined,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: isDark ? 0.3 : 0,
          shadowRadius: 8,
          elevation: isDark ? 4 : 0,
        },
        style,
      ]}
    >
      <Image
        source={require('../../../assets/branding/medicine-reminder-icon.png')}
        style={{ width: size, height: size }}
        resizeMode="contain"
        accessibilityRole="image"
        accessibilityLabel="Medicine Reminder"
      />
    </View>
  );
}
