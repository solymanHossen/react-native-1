import { Activity } from 'lucide-react-native';
import { View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

export interface AppLogoProps {
  /** Badge edge length in dp. Icon and corner radius scale proportionally. */
  size?: number;
}

/**
 * The app's one brand mark — a rounded-square "app icon" badge (not a plain
 * circle: a squircle reads as a product icon, which is the point, whereas a
 * circle reads as a generic avatar/status dot like the ones already used
 * elsewhere on this screen). Built from a single lucide icon rather than an
 * image asset: there was no existing logo file anywhere in the repo to
 * reuse, and a vector mark recolors for free across light/dark mode and
 * scales to any size without shipping multiple PNG densities.
 *
 * Activity (a heartbeat/pulse line) was picked over a pill or cross glyph —
 * generic medication/clinical icons already cover those roles elsewhere in
 * this app (DoseDetailSheet's Pill icon, StatusPill's dot), so the one mark
 * that represents the *product itself* reads more distinctly as "vitals/
 * rhythm" than as "yet another medication icon."
 */
export function AppLogo({ size = 40 }: AppLogoProps) {
  const theme = useTheme();
  const radius = size * 0.28;
  const iconSize = size * 0.56;

  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: theme.action.base,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: theme.action.base,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 6,
      }}
    >
      <Activity color={theme.action.ink} size={iconSize} strokeWidth={2.5} />
    </View>
  );
}
