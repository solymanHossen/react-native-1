import { StyleSheet, View } from 'react-native';
import { Clock, HeartPulse, Pill } from 'lucide-react-native';
import { useTheme } from '../../theme/useTheme';

/**
 * Atmospheric background depth layer.
 *
 * Dark mode: rich optical depth via deep slate blue, emerald, and cyan
 * ambient auras, eliminating flat grey surfaces for Apple iOS & Material
 * You vibrancy.
 *
 * Light mode has no equivalent depth cue by default — a flat canvas reads
 * as empty rather than calm — so instead of glow orbs (which read as dirty
 * smudges on a light, opaque surface) it gets oversized medicine-motif
 * silhouettes (the same pill/clock/heartbeat marks as the app icon) at
 * brand-ink opacity, clearly visible as a deliberate watermark pattern in
 * the gaps between cards without sitting under card text (cards are opaque,
 * so none of this shows through them).
 */
export function AmbientDepthBackground() {
  const theme = useTheme();

  if (theme.mode === 'dark') {
    return (
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {/* Top right deep slate-blue ambient glow */}
        <View
          style={{
            position: 'absolute',
            top: -60,
            right: -50,
            width: 340,
            height: 340,
            borderRadius: 170,
            backgroundColor: 'rgba(59, 130, 246, 0.08)',
          }}
        />
        {/* Mid left medical emerald ambient aura */}
        <View
          style={{
            position: 'absolute',
            top: 280,
            left: -80,
            width: 300,
            height: 300,
            borderRadius: 150,
            backgroundColor: 'rgba(16, 185, 129, 0.05)',
          }}
        />
        {/* Lower right subtle radiance */}
        <View
          style={{
            position: 'absolute',
            bottom: 80,
            right: -60,
            width: 280,
            height: 280,
            borderRadius: 140,
            backgroundColor: 'rgba(6, 182, 212, 0.04)',
          }}
        />
      </View>
    );
  }

  const tint = theme.colors.ink;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Top right — oversized, rotated pill, cropped by the screen edge */}
      <View style={{ position: 'absolute', top: -40, right: -70, opacity: 0.12, transform: [{ rotate: '-18deg' }] }}>
        <Pill color={tint} size={260} strokeWidth={1.5} />
      </View>
      {/* Mid left — clock face echoing the app mark */}
      <View style={{ position: 'absolute', top: 340, left: -90, opacity: 0.1, transform: [{ rotate: '12deg' }] }}>
        <Clock color={tint} size={240} strokeWidth={1.25} />
      </View>
      {/* Lower right — heartbeat line for a subtle vitals/medical cue */}
      <View style={{ position: 'absolute', bottom: 60, right: -60, opacity: 0.1, transform: [{ rotate: '-8deg' }] }}>
        <HeartPulse color={tint} size={220} strokeWidth={1.25} />
      </View>
    </View>
  );
}
