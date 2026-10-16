import React, { useId, useState, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  type DimensionValue,
  type LayoutChangeEvent,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  interpolate,
  useAnimatedStyle,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { useTheme } from '../../../theme/useTheme';
import { useSkeletonAnimation } from './SkeletonContext';

export interface SkeletonBoxProps {
  width?: DimensionValue;
  height?: number;
  borderRadius?: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
  testID?: string;
  children?: ReactNode;
}

/**
 * World-class atomic skeleton building block.
 * Renders an accessible, fluid shape with hardware-accelerated specular shimmer sweep
 * and micro-pulse ambient breathing, strictly synchronized with the design token palette.
 */
export function SkeletonBox({
  width = '100%',
  height = 16,
  borderRadius = 8,
  style,
  className,
  testID,
  children,
}: SkeletonBoxProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const { shimmerProgress, pulseProgress } = useSkeletonAnimation();
  const [layoutWidth, setLayoutWidth] = useState<number>(typeof width === 'number' ? width : 200);
  const rawId = useId();
  const gradientId = `sk_grad_${rawId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

  const handleLayout = (event: LayoutChangeEvent) => {
    const w = event.nativeEvent.layout.width;
    if (w > 0 && w !== layoutWidth) {
      setLayoutWidth(w);
    }
  };

  const baseColor = isDark ? 'rgba(255, 255, 255, 0.07)' : '#E2E8F4';
  const highlightColor = isDark ? 'rgba(255, 255, 255, 0.16)' : '#F6F9FE';

  const containerAnimatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(pulseProgress.value, [0, 1], [0.72, 0.98]),
  }));

  const beamAnimatedStyle = useAnimatedStyle(() => {
    const translateX = interpolate(
      shimmerProgress.value,
      [0, 1],
      [-layoutWidth, layoutWidth * 1.25],
    );
    return {
      transform: [{ translateX }],
    };
  });

  return (
    <Animated.View
      testID={testID}
      onLayout={handleLayout}
      className={className}
      style={[
        {
          width,
          height,
          borderRadius,
          backgroundColor: baseColor,
          overflow: 'hidden',
          position: 'relative',
        },
        containerAnimatedStyle,
        style,
      ]}
    >
      {/* Specular shimmer beam */}
      <Animated.View
        pointerEvents="none"
        style={[
          StyleSheet.absoluteFill,
          { width: layoutWidth * 1.5 },
          beamAnimatedStyle,
        ]}
      >
        <Svg width="100%" height="100%">
          <Defs>
            <LinearGradient id={gradientId} x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor={highlightColor} stopOpacity="0" />
              <Stop offset="50%" stopColor={highlightColor} stopOpacity={isDark ? 0.8 : 0.9} />
              <Stop offset="100%" stopColor={highlightColor} stopOpacity="0" />
            </LinearGradient>
          </Defs>
          <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${gradientId})`} />
        </Svg>
      </Animated.View>
      {children}
    </Animated.View>
  );
}

export interface SkeletonCircleProps {
  size: number;
  style?: StyleProp<ViewStyle>;
  className?: string;
  testID?: string;
}

/**
 * Circular skeleton primitive for icons, avatars, buttons, and progress rings.
 */
export function SkeletonCircle({ size, style, className, testID }: SkeletonCircleProps) {
  return (
    <SkeletonBox
      testID={testID}
      width={size}
      height={size}
      borderRadius={size / 2}
      className={className}
      style={style}
    />
  );
}

export interface SkeletonTextProps {
  lines?: number;
  lineHeight?: number;
  gap?: number;
  lastLineWidth?: DimensionValue;
  style?: StyleProp<ViewStyle>;
  className?: string;
}

/**
 * Multiline typographic skeleton that mimics realistic paragraphs and titles.
 */
export function SkeletonText({
  lines = 2,
  lineHeight = 14,
  gap = 8,
  lastLineWidth = '68%',
  style,
  className,
}: SkeletonTextProps) {
  return (
    <View className={className} style={[{ gap }, style]}>
      {Array.from({ length: lines }).map((_, index) => {
        const isLast = index === lines - 1;
        const width = isLast && lines > 1 ? lastLineWidth : '100%';
        return (
          <SkeletonBox
            key={index}
            width={width}
            height={lineHeight}
            borderRadius={lineHeight / 2.5}
          />
        );
      })}
    </View>
  );
}

export interface SkeletonCardProps {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  className?: string;
  borderRadius?: number;
  padding?: number;
}

/**
 * Container card skeleton adhering to the app's elevated/glassmorphic surface tokens.
 */
export function SkeletonCard({
  children,
  style,
  className,
  borderRadius = 28,
  padding = 20,
}: SkeletonCardProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';

  return (
    <View
      className={className}
      style={[
        {
          borderRadius,
          padding,
          backgroundColor: isDark ? 'rgba(31, 41, 55, 0.65)' : 'rgba(255, 255, 255, 0.88)',
          borderWidth: 1,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2EDFB',
          shadowColor: '#000000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: isDark ? 0.35 : 0.06,
          shadowRadius: 12,
          elevation: 2,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export interface SkeletonCrossFadeProps {
  loading: boolean;
  skeleton: ReactNode;
  children: ReactNode;
  duration?: number;
}

/**
 * Ultra-smooth animated cross-fade between skeleton state and actual loaded content.
 * Prevents abrupt layout pops and eliminates Cumulative Layout Shift (CLS).
 */
export function SkeletonCrossFade({
  loading,
  skeleton,
  children,
  duration = 240,
}: SkeletonCrossFadeProps) {
  const contentStyle = useAnimatedStyle(() => ({
    opacity: withTiming(loading ? 0 : 1, { duration }),
    transform: [{ translateY: withTiming(loading ? 6 : 0, { duration }) }],
  }));

  const skeletonStyle = useAnimatedStyle(() => ({
    opacity: withTiming(loading ? 1 : 0, { duration }),
  }));

  if (loading) {
    return <Animated.View style={skeletonStyle}>{skeleton}</Animated.View>;
  }

  return <Animated.View style={contentStyle}>{children}</Animated.View>;
}
