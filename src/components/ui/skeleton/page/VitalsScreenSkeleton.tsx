import React from 'react';
import { View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../../../theme/useTheme';
import { SkeletonProvider } from '../SkeletonContext';
import {
  SkeletonBox,
  SkeletonCard,
  SkeletonCircle,
} from '../SkeletonPrimitives';

/**
 * World-class full-page skeleton for VitalsScreen.
 * Prevents layout shift while historical trend sparkline data and latest vitals load.
 */
export function VitalsScreenSkeleton() {
  const theme = useTheme();

  return (
    <SkeletonProvider>
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right']}
        style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      >
        {/* Screen Header */}
        <View
          className="border-b px-6 py-5"
          style={{ borderColor: theme.colors.hairline }}
        >
          <SkeletonBox width={190} height={26} borderRadius={8} />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-7 px-6 py-7"
          showsVerticalScrollIndicator={false}
        >
          {/* Section 1: Log A Vital (2x2 Grid) */}
          <View className="gap-4">
            <SkeletonBox width={100} height={14} borderRadius={6} />
            <View className="flex-row flex-wrap gap-3">
              {[1, 2, 3, 4].map((item) => (
                <SkeletonCard
                  key={item}
                  borderRadius={20}
                  padding={14}
                  style={{ minWidth: '46%', flex: 1, flexBasis: '46%' }}
                >
                  <View className="flex-row items-center gap-3">
                    <SkeletonBox width={40} height={40} borderRadius={12} />
                    <View className="flex-1 gap-1.5">
                      <SkeletonBox width="80%" height={15} borderRadius={5} />
                      <SkeletonBox width="50%" height={11} borderRadius={4} />
                    </View>
                  </View>
                </SkeletonCard>
              ))}
            </View>
          </View>

          {/* Section 2: Trend & Sparkline Chart Skeleton */}
          <View className="gap-4">
            <SkeletonBox width={130} height={14} borderRadius={6} />

            {/* Metric pill tabs */}
            <View className="flex-row gap-2">
              <SkeletonBox width="23%" height={34} borderRadius={17} />
              <SkeletonBox width="23%" height={34} borderRadius={17} />
              <SkeletonBox width="23%" height={34} borderRadius={17} />
              <SkeletonBox width="23%" height={34} borderRadius={17} />
            </View>

            {/* Time range tabs */}
            <View className="flex-row gap-2">
              <SkeletonBox width="48%" height={32} borderRadius={16} />
              <SkeletonBox width="48%" height={32} borderRadius={16} />
            </View>

            {/* Sparkline canvas placeholder card */}
            <SkeletonCard borderRadius={24} padding={20} className="gap-4">
              <View className="flex-row items-center justify-between">
                <SkeletonBox width={110} height={16} borderRadius={6} />
                <SkeletonBox width={60} height={16} borderRadius={6} />
              </View>
              <SkeletonBox width="100%" height={140} borderRadius={16} />
              <View className="flex-row items-center justify-between">
                <SkeletonBox width={50} height={12} borderRadius={5} />
                <SkeletonBox width={50} height={12} borderRadius={5} />
                <SkeletonBox width={50} height={12} borderRadius={5} />
              </View>
            </SkeletonCard>
          </View>

          {/* Section 3: Adverse Symptoms Button Skeleton */}
          <View className="gap-4 pb-8">
            <SkeletonBox width={150} height={14} borderRadius={6} />
            <SkeletonBox width="100%" height={56} borderRadius={24} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </SkeletonProvider>
  );
}
