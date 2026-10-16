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
 * World-class full-page skeleton for AlarmsScreen.
 * Prevents the jarring flash of the AlarmsEmptyState while the database
 * schedule queries and caregiver settings are being read.
 */
export function AlarmsScreenSkeleton() {
  const theme = useTheme();

  return (
    <SkeletonProvider>
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right']}
        style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      >
        {/* Screen Header */}
        <View className="flex-row items-center justify-between px-6 pt-3 pb-3">
          <View className="gap-2">
            <SkeletonBox width={200} height={32} borderRadius={10} />
            <SkeletonBox width={140} height={15} borderRadius={6} />
          </View>
          <View className="flex-row items-center gap-2">
            <SkeletonBox width={96} height={34} borderRadius={17} />
            <SkeletonCircle size={40} />
          </View>
        </View>

        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 24,
            paddingVertical: 18,
            gap: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* Emergency Caregiver Card Skeleton */}
          <SkeletonCard borderRadius={28} padding={20}>
            <View className="flex-row items-center gap-4">
              <SkeletonCircle size={48} />
              <View className="flex-1 gap-1.5">
                <SkeletonBox width={130} height={17} borderRadius={6} />
                <SkeletonBox width={160} height={13} borderRadius={5} />
              </View>
              <SkeletonBox width={64} height={32} borderRadius={16} />
            </View>
          </SkeletonCard>

          {/* Your Medicines Banner & Rows Skeleton */}
          <SkeletonCard borderRadius={28} padding={20} className="gap-4">
            <View className="flex-row items-center justify-between pb-1">
              <View className="flex-row items-center gap-3">
                <SkeletonCircle size={40} />
                <SkeletonBox width={120} height={18} borderRadius={6} />
              </View>
              <SkeletonBox width={90} height={24} borderRadius={12} />
            </View>

            {/* Medicine rows preview */}
            {[1, 2].map((idx) => (
              <View
                key={idx}
                className="flex-row items-center gap-3 pt-2"
                style={{
                  borderTopWidth: 1,
                  borderTopColor:
                    theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : '#F1F5F9',
                }}
              >
                <SkeletonBox width={44} height={44} borderRadius={16} />
                <View className="flex-1 gap-1.5">
                  <SkeletonBox width="50%" height={16} borderRadius={6} />
                  <SkeletonBox width="30%" height={12} borderRadius={5} />
                </View>
                <SkeletonBox width={64} height={28} borderRadius={14} />
              </View>
            ))}
          </SkeletonCard>

          {/* Section: Active Alarm Schedules */}
          <View className="gap-3.5">
            <SkeletonBox width={160} height={20} borderRadius={7} />

            {/* 3x ScheduleCard Skeletons */}
            {[1, 2, 3].map((key) => (
              <SkeletonCard
                key={key}
                borderRadius={24}
                padding={18}
                className="gap-3"
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3.5 flex-1">
                    {/* Time Badge box */}
                    <SkeletonBox width={64} height={64} borderRadius={18} />
                    <View className="flex-1 gap-1.5">
                      <SkeletonBox width="65%" height={18} borderRadius={6} />
                      <SkeletonBox width="45%" height={13} borderRadius={5} />
                      <View className="flex-row gap-2 mt-1">
                        <SkeletonBox width={60} height={18} borderRadius={6} />
                        <SkeletonBox width={70} height={18} borderRadius={6} />
                      </View>
                    </View>
                  </View>
                  {/* Toggle switch placeholder */}
                  <SkeletonBox width={50} height={30} borderRadius={15} />
                </View>
              </SkeletonCard>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </SkeletonProvider>
  );
}
