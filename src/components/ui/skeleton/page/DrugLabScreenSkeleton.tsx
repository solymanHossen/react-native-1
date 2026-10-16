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
 * World-class full-page skeleton for DrugLabScreen ("Meds").
 * Eliminates the empty state flash during SQLite database priming and medication list hydration.
 */
export function DrugLabScreenSkeleton() {
  const theme = useTheme();

  return (
    <SkeletonProvider>
      <SafeAreaView
        className="flex-1"
        edges={['top', 'left', 'right']}
        style={{ flex: 1, backgroundColor: theme.colors.canvas }}
      >
        {/* Header: Title + Subtitle + 3D Capsule Orb placeholder */}
        <View className="flex-row items-center justify-between px-5 pt-3 pb-3">
          <View className="gap-2">
            <SkeletonBox width={180} height={32} borderRadius={10} />
            <SkeletonBox width={130} height={15} borderRadius={6} />
          </View>
          <SkeletonCircle size={58} />
        </View>

        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-5 px-5 pt-3 pb-8"
          showsVerticalScrollIndicator={false}
        >
          {/* Section: Your Medications Header + Add New Pill */}
          <View className="gap-3.5">
            <View className="flex-row items-center justify-between">
              <SkeletonBox width={160} height={22} borderRadius={8} />
              <SkeletonBox width={100} height={34} borderRadius={17} />
            </View>

            {/* 3x MedicationRow Skeletons */}
            {[1, 2, 3].map((key) => (
              <SkeletonCard
                key={key}
                borderRadius={24}
                padding={18}
                className="gap-3.5"
              >
                {/* Top Row: Icon + Title/Strength + Chevron */}
                <View className="flex-row items-center gap-3.5">
                  <SkeletonBox width={52} height={52} borderRadius={16} />
                  <View className="flex-1 gap-1.5">
                    <SkeletonBox width="60%" height={18} borderRadius={6} />
                    <View className="flex-row gap-2 mt-0.5">
                      <SkeletonBox width={56} height={16} borderRadius={8} />
                      <SkeletonBox width={64} height={16} borderRadius={8} />
                    </View>
                  </View>
                  <SkeletonBox width={18} height={18} borderRadius={9} />
                </View>

                {/* Divider hairline */}
                <View
                  style={{
                    height: 1,
                    backgroundColor:
                      theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : '#EDF2F7',
                  }}
                />

                {/* Bottom Row: Metadata badges + Status pill */}
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <SkeletonBox width={70} height={18} borderRadius={6} />
                    <SkeletonBox width={80} height={18} borderRadius={6} />
                  </View>
                  <SkeletonBox width={68} height={24} borderRadius={12} />
                </View>
              </SkeletonCard>
            ))}
          </View>

          {/* Medication History Card Skeleton */}
          <SkeletonCard borderRadius={24} padding={18}>
            <View className="flex-row items-center gap-4">
              <SkeletonBox width={60} height={60} borderRadius={20} />
              <View className="flex-1 gap-1.5">
                <SkeletonBox width={140} height={18} borderRadius={6} />
                <SkeletonBox width={180} height={14} borderRadius={5} />
              </View>
              <SkeletonBox width={20} height={20} borderRadius={10} />
            </View>
          </SkeletonCard>

          {/* Search bar placeholder */}
          <View className="gap-3">
            <SkeletonBox width={170} height={22} borderRadius={8} />
            <SkeletonBox width="100%" height={54} borderRadius={20} />
          </View>

          {/* Add Manually Card Skeleton */}
          <SkeletonCard borderRadius={24} padding={18}>
            <View className="flex-row items-center gap-4">
              <SkeletonBox width={60} height={60} borderRadius={20} />
              <View className="flex-1 gap-1.5">
                <SkeletonBox width={130} height={18} borderRadius={6} />
                <SkeletonBox width={170} height={14} borderRadius={5} />
              </View>
              <SkeletonBox width={20} height={20} borderRadius={10} />
            </View>
          </SkeletonCard>
        </ScrollView>
      </SafeAreaView>
    </SkeletonProvider>
  );
}
