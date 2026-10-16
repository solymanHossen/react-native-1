import React, { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import {
  Easing,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

export interface SkeletonContextValue {
  /** 0 to 1 linear/bezier progress for specular shimmer beam sweep across elements */
  shimmerProgress: SharedValue<number>;
  /** 0 to 1 breathing pulse progress for subtle ambient depth */
  pulseProgress: SharedValue<number>;
}

const SkeletonContext = createContext<SkeletonContextValue | null>(null);

export interface SkeletonProviderProps {
  children: ReactNode;
  /** Duration of shimmer beam sweep in milliseconds (default: 1400ms) */
  shimmerDuration?: number;
  /** Duration of breathing pulse in milliseconds (default: 1100ms) */
  pulseDuration?: number;
}

/**
 * World-class centralized skeleton animation coordinator.
 * Shares a single Reanimated 60fps/120fps clock on the UI thread across all skeleton
 * elements on the screen, guaranteeing zero CPU/battery thrashing and absolute specular
 * harmony across cards, pills, and text lines.
 */
export function SkeletonProvider({
  children,
  shimmerDuration = 1400,
  pulseDuration = 1100,
}: SkeletonProviderProps) {
  const shimmerProgress = useSharedValue(0);
  const pulseProgress = useSharedValue(0);

  useEffect(() => {
    shimmerProgress.value = withRepeat(
      withTiming(1, {
        duration: shimmerDuration,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      }),
      -1,
      false,
    );

    pulseProgress.value = withRepeat(
      withTiming(1, {
        duration: pulseDuration,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [shimmerDuration, pulseDuration, shimmerProgress, pulseProgress]);

  const value = useMemo(
    () => ({ shimmerProgress, pulseProgress }),
    [shimmerProgress, pulseProgress],
  );

  return <SkeletonContext.Provider value={value}>{children}</SkeletonContext.Provider>;
}

/**
 * Hook to consume the shared skeleton animation driver.
 * Gracefully falls back to a self-contained driver if rendered outside a SkeletonProvider.
 */
export function useSkeletonAnimation(): SkeletonContextValue {
  const context = useContext(SkeletonContext);
  const localShimmer = useSharedValue(0);
  const localPulse = useSharedValue(0);

  useEffect(() => {
    if (context) return;
    localShimmer.value = withRepeat(
      withTiming(1, {
        duration: 1400,
        easing: Easing.bezier(0.4, 0, 0.2, 1),
      }),
      -1,
      false,
    );
    localPulse.value = withRepeat(
      withTiming(1, {
        duration: 1100,
        easing: Easing.inOut(Easing.quad),
      }),
      -1,
      true,
    );
  }, [context, localShimmer, localPulse]);

  if (context) return context;
  return { shimmerProgress: localShimmer, pulseProgress: localPulse };
}
