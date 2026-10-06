import { Moon, Sun, SunMoon } from 'lucide-react-native';
import { useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HealthRecordsSheet, type HealthRecordsSheetRef } from '../components/records/HealthRecordsSheet';
import { LargeTextButton, MetricCard, StatusPill } from '../components/ui';
import type { StatusKey } from '../theme/tokens';
import { useTheme, useThemePreference, useSetThemePreference, type ThemePreference } from '../theme/useTheme';

const ALL_STATUSES: StatusKey[] = ['fasting', 'taken', 'pending', 'missed', 'scheduled'];

const NEXT_PREFERENCE: Record<ThemePreference, ThemePreference> = {
  system: 'light',
  light: 'dark',
  dark: 'system',
};

// Real vector icons, not a Unicode glyph: a glyph rendered through a
// symbol-fallback font with unpredictable line-height once made the toggle
// button grow into a pill instead of staying a circle (see LargeTextButton's
// git history / the earlier fixed-size workaround this replaces).
const THEME_ICON: Record<ThemePreference, typeof Sun> = {
  system: SunMoon,
  light: Sun,
  dark: Moon,
};

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export default function HomeScreen() {
  const theme = useTheme();
  const preference = useThemePreference();
  const setPreference = useSetThemePreference();
  const healthRecordsRef = useRef<HealthRecordsSheetRef>(null);
  const [syncing, setSyncing] = useState(false);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const ThemeIcon = THEME_ICON[preference];

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1500);
  };

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor: theme.colors.canvas }}>
      <View
        className="flex-row items-center justify-between border-b px-6 py-6"
        style={{ borderColor: theme.colors.hairline }}
      >
        <View className="gap-1">
          <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
            {greeting}
          </Text>
          <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
            Medius Health
          </Text>
        </View>
        <Pressable
          onPress={() => setPreference(NEXT_PREFERENCE[preference])}
          accessibilityRole="button"
          accessibilityLabel={`Theme: ${preference}. Tap to change.`}
          className="min-h-hit min-w-hit items-center justify-center rounded-full border"
          style={{
            width: 56,
            height: 56,
            backgroundColor: `${theme.action.base}14`,
            borderColor: `${theme.action.base}33`,
          }}
        >
          <ThemeIcon color={theme.action.base} size={24} strokeWidth={2.25} />
        </Pressable>
      </View>

      {/* Padding lives on contentContainerStyle, not the ScrollView's own
          style: padding on the outer style only shrinks the scrollable
          viewport, it doesn't reserve room inside the scrollable content, so
          the last button still ends up flush against — or hidden behind —
          the device's bottom edge/gesture bar. */}
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-9 px-6 pt-8"
        contentContainerStyle={{ paddingBottom: 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Hero: the single most important thing on the screen, sized and
            weighted accordingly (Display Large for the time), not sharing
            visual priority with the vitals grid below it. */}
        <View
          className="gap-5 rounded-3xl border p-8 shadow-lg"
          style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
        >
          <View className="flex-row items-center gap-2">
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: theme.action.base }} />
            <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
              Next Dose
            </Text>
          </View>
          <View className="flex-row items-end justify-between">
            <View>
              <Text className="text-display-lg" style={{ color: theme.colors.ink }}>
                8:00 AM
              </Text>
              <Text className="mt-1 text-body-lg" style={{ color: theme.colors.inkSecondary }}>
                Metformin · 500mg
              </Text>
            </View>
            <StatusPill status="scheduled" />
          </View>
          <LargeTextButton label="Mark as Taken" onPress={() => {}} />
        </View>

        <View className="gap-4">
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            Today's Vitals
          </Text>
          <View className="flex-row gap-4">
            <View className="flex-1">
              <MetricCard
                label="Blood Glucose"
                value="126"
                unit="mg/dL"
                caption="Last reading 2h ago"
                status="fasting"
              />
            </View>
            <View className="flex-1">
              <MetricCard label="Heart Rate" value="72" unit="bpm" caption="Resting" />
            </View>
          </View>
        </View>

        <View className="gap-4">
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            Medication Status
          </Text>
          <View className="flex-row flex-wrap gap-2.5">
            {ALL_STATUSES.map((key) => (
              <StatusPill key={key} status={key} />
            ))}
          </View>
        </View>

        <View className="gap-4">
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            Actions
          </Text>
          <View className="gap-4">
            <LargeTextButton label="Log a Reading" onPress={() => {}} />
            <LargeTextButton
              label={syncing ? 'Syncing…' : 'Sync with Clinic'}
              variant="secondary"
              loading={syncing}
              onPress={handleSync}
            />
            <LargeTextButton label="Unavailable Offline" disabled onPress={() => {}} />
          </View>
        </View>

        <View className="gap-4">
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            Health Records
          </Text>
          <LargeTextButton
            label="Health Records & Backup"
            variant="secondary"
            onPress={() => healthRecordsRef.current?.present()}
          />
        </View>
      </ScrollView>

      <HealthRecordsSheet ref={healthRecordsRef} />
    </SafeAreaView>
  );
}
