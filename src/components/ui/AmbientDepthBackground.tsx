import { StyleSheet, View, type ViewStyle } from 'react-native';
import { Clock, HeartPulse, Pill, type LucideIcon } from 'lucide-react-native';
import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';
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
 * smudges on a light, opaque surface) it pairs oversized medicine-motif
 * silhouettes (the same pill/clock/heartbeat marks as the app icon) with a
 * soft radial-gradient glow behind each one. The gradient (color fading to
 * fully transparent, rather than the dark-mode orbs' hard-edged circle) is
 * what makes this read as a smooth ambient wash instead of a flat sticker;
 * each motif gets its own brand hue so the three read as a deliberate,
 * varied system rather than one repeated shape.
 */
interface MedicineMotifProps {
  Icon: LucideIcon;
  size: number;
  glowColor: string;
  glowOpacity: number;
  iconColor: string;
  iconOpacity: number;
  strokeWidth: number;
  rotateDeg: number;
  style: ViewStyle;
}

function MedicineMotif({ Icon, size, glowColor, glowOpacity, iconColor, iconOpacity, strokeWidth, rotateDeg, style }: MedicineMotifProps) {
  const glowSize = size * 1.7;
  const gradientId = `motif-glow-${Icon.displayName ?? Icon.name}`;

  return (
    <View style={[{ position: 'absolute', width: glowSize, height: glowSize }, style]}>
      <Svg width={glowSize} height={glowSize} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={gradientId} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={glowColor} stopOpacity={glowOpacity} />
            <Stop offset="1" stopColor={glowColor} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={glowSize / 2} cy={glowSize / 2} r={glowSize / 2} fill={`url(#${gradientId})`} />
      </Svg>
      <View
        style={{
          position: 'absolute',
          top: (glowSize - size) / 2,
          left: (glowSize - size) / 2,
          opacity: iconOpacity,
          transform: [{ rotate: `${rotateDeg}deg` }],
        }}
      >
        <Icon color={iconColor} size={size} strokeWidth={strokeWidth} />
      </View>
    </View>
  );
}

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

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {/* Top right — oversized, rotated pill in brand blue, cropped by the screen edge */}
      <MedicineMotif
        Icon={Pill}
        size={260}
        strokeWidth={1.5}
        rotateDeg={-18}
        glowColor="#3B82F6"
        glowOpacity={0.22}
        iconColor={theme.action.base}
        iconOpacity={0.16}
        style={{ top: -70, right: -100 }}
      />
      {/* Mid left — ink-navy clock face echoing the app mark */}
      <MedicineMotif
        Icon={Clock}
        size={240}
        strokeWidth={1.25}
        rotateDeg={12}
        glowColor={theme.colors.ink}
        glowOpacity={0.14}
        iconColor={theme.colors.ink}
        iconOpacity={0.13}
        style={{ top: 310, left: -120 }}
      />
      {/* Lower right — coral heartbeat line for a vitals/pulse cue */}
      <MedicineMotif
        Icon={HeartPulse}
        size={220}
        strokeWidth={1.25}
        rotateDeg={-8}
        glowColor="#F87171"
        glowOpacity={0.18}
        iconColor="#DC2626"
        iconOpacity={0.14}
        style={{ bottom: 30, right: -94 }}
      />
    </View>
  );
}
