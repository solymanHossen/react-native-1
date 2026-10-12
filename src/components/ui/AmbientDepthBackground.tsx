import { StyleSheet, View } from 'react-native';

/**
 * Atmospheric background depth layer.
 * Creates rich optical depth with deep slate blue, emerald, and cyan ambient auras,
 * completely eliminating flat grey surfaces and giving Apple iOS & Material You vibrancy.
 */
export function AmbientDepthBackground() {
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
