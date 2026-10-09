import { Image } from 'react-native';

export interface AppLogoProps {
  /** Badge edge length in dp. Icon and corner radius scale proportionally. */
  size?: number;
}

/**
 * The product mark supplied for Medicine Reminder. Keeping the source image
 * in one component makes the logo consistent across the home header and
 * future branded surfaces.
 */
export function AppLogo({ size = 40 }: AppLogoProps) {
  return <Image source={require('../../../assets/branding/medicine-reminder-logo.png')} style={{ width: size, height: size }} resizeMode="contain" accessibilityRole="image" accessibilityLabel="Medicine Reminder" />;
}
