import { Image, View } from 'react-native';

export interface AppLogoProps {
  /** Badge edge length in dp. Icon and corner radius scale proportionally. */
  size?: number;
}

/**
 * The product mark supplied for Medicine Reminder. Keeping the source image
 * in one component makes the logo consistent across the home header and
 * future branded surfaces. The source file is a flat, opaque square tile
 * (the same artwork used for the app icon), so it's clipped to a rounded
 * square here — the same treatment iOS/Android apply to the launcher icon —
 * rather than rendered as a plain white box against the app's background.
 */
export function AppLogo({ size = 40 }: AppLogoProps) {
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.22, overflow: 'hidden' }}>
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
