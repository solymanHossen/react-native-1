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
 * World-class full-page skeleton for CircadianDashboardScreen ("Rhythm").
 * Matches the circadian wave and adherence visual layout with zero layout jumps.
 */
export function CircadianDashboardScreenSkeleton() {
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
          className="border-b px-6 py-6"
          style={{ borderColor: theme.colors.hairline }}
        >
          <SkeletonBox width={180} height={26} borderRadius={8} />
          <View className="mt-2">
            <SkeletonBox width={240} height={14} borderRadius={5} />
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-7 px-6 pt-7 pb-8"
          showsVerticalScrollIndicator={false}
        >
          {/* Today & Date Bar */}
          <View className="flex-row items-center justify-between">
            <SkeletonBox width={140} height={14} borderRadius={6} />
            <SkeletonBox width={100} height={28} borderRadius={14} />
          </View>

          {/* Adherence Ring Row */}
          <View className="flex-row items-center justify-center gap-4">
            <SkeletonCircle size={118} />
            <SkeletonCard borderRadius={20} padding={16} style={{ flex: 1 }}>
              <View className="gap-2">
                <SkeletonBox width={80} height={14} borderRadius={6} />
                <SkeletonBox width={120} height={22} borderRadius={7} />
                <SkeletonBox width={90} height={12} borderRadius={5} />
              </View>
            </SkeletonCard>
          </View>

          {/* Circadian Wave Canvas Placeholder Card */}
          <SkeletonCard borderRadius={28} padding={20} className="gap-4">
            <View className="flex-row items-center justify-between">
              <SkeletonBox width={140} height={16} borderRadius={6} />
              <SkeletonBox width={60} height={16} borderRadius={6} />
            </View>
            <SkeletonBox width="100%" height={160} borderRadius={20} />
            <View className="flex-row items-center justify-between">
              <SkeletonBox width={45} height={12} borderRadius={5} />
              <SkeletonBox width={45} height={12} borderRadius={5} />
              <SkeletonBox width={45} height={12} borderRadius={5} />
              <SkeletonBox width={45} height={12} borderRadius={5} />
            </View>
          </SkeletonCard>

          {/* Dose Action Cards */}
          <View className="gap-3.5">
            <SkeletonBox width={130} height={15} borderRadius={6} />
            {[1, 2].map((key) => (
              <SkeletonCard key={key} borderRadius={24} padding={18}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3.5 flex-1">
                    <SkeletonBox width={50} height={50} borderRadius={16} />
                    <View className="flex-1 gap-1.5">
                      <SkeletonBox width="65%" height={17} borderRadius={6} />
                      <SkeletonBox width="40%" height={12} borderRadius={5} />
                    </View>
                  </View>
                  <SkeletonBox width={84} height={36} borderRadius={18} />
                </View>
              </SkeletonCard>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SkeletonProvider>
  );
}
