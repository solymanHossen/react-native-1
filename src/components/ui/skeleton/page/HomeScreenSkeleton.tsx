import React from 'react';
import { View, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../../../theme/useTheme';
import { SkeletonProvider } from '../SkeletonContext';
import {
  SkeletonBox,
  SkeletonCard,
  SkeletonCircle,
  SkeletonText,
} from '../SkeletonPrimitives';

/**
 * World-class full-page skeleton for HomeScreen.
 * Matches the exact proportions, paddings, border radii, and visual hierarchy
 * of the live dashboard to guarantee zero Cumulative Layout Shift (CLS = 0).
 */
export function HomeScreenSkeleton() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const isDark = theme.mode === 'dark';

  return (
    <SkeletonProvider>
      <View
        className="flex-1"
        style={{
          backgroundColor: theme.colors.canvas,
        }}
      >
        {/* Sticky Header Skeleton matching live header height & glass hairline */}
        <View
          style={{
            paddingTop: insets.top,
            backgroundColor: isDark ? 'rgba(11, 15, 25, 0.8)' : 'rgba(240, 243, 250, 0.82)',
            borderBottomWidth: 1,
            borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
          }}
        >
          <View
            style={{
              height: 64,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 20,
            }}
          >
            {/* Brand squircle + title */}
            <View className="flex-row items-center gap-3">
              <SkeletonBox width={42} height={42} borderRadius={14} />
              <View className="gap-1.5 justify-center">
                <SkeletonBox width={72} height={10} borderRadius={5} />
                <SkeletonBox width={130} height={18} borderRadius={6} />
              </View>
            </View>

            {/* Quick action buttons */}
            <View className="flex-row items-center gap-2.5">
              <SkeletonCircle size={40} />
              <SkeletonCircle size={40} />
            </View>
          </View>
        </View>

        {/* Scrollable Dashboard Body */}
        <ScrollView
          className="flex-1"
          contentContainerStyle={{
            paddingHorizontal: 20,
            paddingTop: 16,
            paddingBottom: 36,
            gap: 20,
          }}
          showsVerticalScrollIndicator={false}
        >
          {/* 1. Today's Progress Card Skeleton */}
          <SkeletonCard borderRadius={28} padding={20} className="gap-5">
            <View className="flex-row items-center gap-4">
              <SkeletonCircle size={116} />
              <View className="flex-1 gap-2.5">
                <SkeletonBox width={100} height={12} borderRadius={6} />
                <SkeletonBox width={140} height={26} borderRadius={8} />
                <SkeletonBox width="85%" height={14} borderRadius={6} />
              </View>
            </View>

            {/* 2x2 Status Cards Grid */}
            <View className="gap-3">
              <View className="flex-row gap-3">
                <SkeletonBox width="48%" height={68} borderRadius={18} />
                <SkeletonBox width="48%" height={68} borderRadius={18} />
              </View>
              <View className="flex-row gap-3">
                <SkeletonBox width="48%" height={68} borderRadius={18} />
                <SkeletonBox width="48%" height={68} borderRadius={18} />
              </View>
            </View>
          </SkeletonCard>

          {/* 2. Hero Next Dose Card Skeleton */}
          <SkeletonCard borderRadius={28} padding={20} className="gap-4">
            <View className="flex-row items-center justify-between">
              <View className="flex-row items-center gap-3.5 flex-1">
                <SkeletonBox width={54} height={54} borderRadius={18} />
                <View className="flex-1 gap-1.5">
                  <SkeletonBox width={140} height={20} borderRadius={6} />
                  <SkeletonBox width={90} height={13} borderRadius={5} />
                </View>
              </View>
              <SkeletonBox width={72} height={26} borderRadius={13} />
            </View>

            {/* Dose timing / instructions highlight pill */}
            <SkeletonBox width="100%" height={46} borderRadius={16} />

            {/* Primary Action Button */}
            <SkeletonBox width="100%" height={52} borderRadius={26} />
          </SkeletonCard>

          {/* 3. Today's Vitals Strip Skeleton */}
          <View className="gap-3.5">
            <View className="flex-row items-center justify-between">
              <SkeletonBox width={110} height={14} borderRadius={6} />
              <SkeletonBox width={64} height={14} borderRadius={6} />
            </View>

            <View className="flex-row gap-3.5">
              <SkeletonCard
                borderRadius={24}
                padding={16}
                style={{ flex: 1 }}
                className="gap-3"
              >
                <View className="flex-row items-center justify-between">
                  <SkeletonCircle size={36} />
                  <SkeletonBox width={50} height={18} borderRadius={9} />
                </View>
                <View className="gap-1.5">
                  <SkeletonBox width={70} height={12} borderRadius={6} />
                  <SkeletonBox width={90} height={22} borderRadius={7} />
                  <SkeletonBox width={50} height={11} borderRadius={5} />
                </View>
              </SkeletonCard>

              <SkeletonCard
                borderRadius={24}
                padding={16}
                style={{ flex: 1 }}
                className="gap-3"
              >
                <View className="flex-row items-center justify-between">
                  <SkeletonCircle size={36} />
                  <SkeletonBox width={50} height={18} borderRadius={9} />
                </View>
                <View className="gap-1.5">
                  <SkeletonBox width={70} height={12} borderRadius={6} />
                  <SkeletonBox width={90} height={22} borderRadius={7} />
                  <SkeletonBox width={50} height={11} borderRadius={5} />
                </View>
              </SkeletonCard>
            </View>
          </View>

          {/* 4. Action Row Group Skeleton */}
          <SkeletonCard borderRadius={24} padding={16} className="gap-4">
            <View className="flex-row items-center gap-3.5">
              <SkeletonCircle size={40} />
              <View className="flex-1 gap-1.5">
                <SkeletonBox width="60%" height={15} borderRadius={6} />
                <SkeletonBox width="40%" height={11} borderRadius={5} />
              </View>
              <SkeletonBox width={18} height={18} borderRadius={9} />
            </View>
            <View
              style={{
                height: 1,
                backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#EBF0F8',
              }}
            />
            <View className="flex-row items-center gap-3.5">
              <SkeletonCircle size={40} />
              <View className="flex-1 gap-1.5">
                <SkeletonBox width="55%" height={15} borderRadius={6} />
                <SkeletonBox width="35%" height={11} borderRadius={5} />
              </View>
              <SkeletonBox width={18} height={18} borderRadius={9} />
            </View>
          </SkeletonCard>
        </ScrollView>
      </View>
    </SkeletonProvider>
  );
}
