import { Moon, Sun, SunMoon } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HealthRecordsSheet, type HealthRecordsSheetRef } from '../components/records/HealthRecordsSheet';
import { LargeTextButton, MetricCard, StatusPill } from '../components/ui';
import { useIntakeQueueStore, useSentinelStore, useVitalsStore, type IntakeQueueStatus } from '../store';
import type { StatusKey } from '../theme/tokens';
import { useTheme, useThemePreference, useSetThemePreference, type ThemePreference } from '../theme/useTheme';
import { classifyBloodPressure } from '../vitals/bpClassification';

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

const STATUS_TO_KEY: Record<IntakeQueueStatus, StatusKey> = {
  TAKEN: 'taken',
  MISSED: 'missed',
  PENDING: 'pending',
  SCHEDULED: 'scheduled',
};

/** Lower sorts first — an imminent dose outranks a merely-upcoming one, and a stale missed one only surfaces once nothing more actionable is left today. */
const STATUS_PRIORITY: Record<IntakeQueueStatus, number> = { PENDING: 0, SCHEDULED: 1, MISSED: 2, TAKEN: 3 };

function greetingForHour(hour: number): string {
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function formatTimeLabel(timeUtc: string): string {
  const [hours, minutes] = timeUtc.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function hoursAgoLabel(iso: string): string {
  const hours = Math.round((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
  if (hours < 1) return 'Last reading just now';
  return `Last reading ${hours}h ago`;
}

export default function HomeScreen() {
  const theme = useTheme();
  const preference = useThemePreference();
  const setPreference = useSetThemePreference();
  const healthRecordsRef = useRef<HealthRecordsSheetRef>(null);
  const [syncing, setSyncing] = useState(false);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);
  const ThemeIcon = THEME_ICON[preference];

  const intakeItems = useIntakeQueueStore((state) => state.items);
  const refreshIntakeQueue = useIntakeQueueStore((state) => state.refresh);
  const markTaken = useIntakeQueueStore((state) => state.markTaken);
  const latestVitals = useVitalsStore((state) => state.latest);
  const refreshVitals = useVitalsStore((state) => state.refresh);
  const medicationAlerts = useSentinelStore((state) => state.alerts);
  const refreshAlerts = useSentinelStore((state) => state.refresh);

  // Re-reads on every mount (i.e. every time this tab is switched back to),
  // not just once at app startup — the alarm engine's own NFC/vision-verified
  // intake writes go straight to SQLite without touching this store, so
  // "whatever the store already holds in memory" can go stale the moment the
  // user resolves a dose from an alarm instead of from this screen.
  useEffect(() => {
    refreshIntakeQueue().catch(() => {});
    refreshVitals().catch(() => {});
    refreshAlerts().catch(() => {});
  }, [refreshIntakeQueue, refreshVitals, refreshAlerts]);

  const nextDose = useMemo(() => {
    const actionable = intakeItems.filter((item) => item.status !== 'TAKEN');
    if (actionable.length === 0) return null;
    return [...actionable].sort(
      (a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || a.timeUtc.localeCompare(b.timeUtc),
    )[0];
  }, [intakeItems]);

  const statusCounts = useMemo(() => {
    const counts: Record<IntakeQueueStatus, number> = { TAKEN: 0, MISSED: 0, PENDING: 0, SCHEDULED: 0 };
    for (const item of intakeItems) counts[item.status] += 1;
    return counts;
  }, [intakeItems]);

  const bloodPressureStage =
    latestVitals.systolic && latestVitals.diastolic
      ? classifyBloodPressure(latestVitals.systolic.value, latestVitals.diastolic.value)
      : null;

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
            visual priority with the vitals grid below it. Real data from
            the shared intake-queue store, not a fixed placeholder — the
            same store the Rhythm tab's dashboard reads and writes, so
            marking a dose taken from either screen is reflected on both. */}
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
          {nextDose ? (
            <>
              <View className="flex-row items-end justify-between">
                <View>
                  <Text className="text-display-lg" style={{ color: theme.colors.ink }}>
                    {formatTimeLabel(nextDose.timeUtc)}
                  </Text>
                  <Text className="mt-1 text-body-lg" style={{ color: theme.colors.inkSecondary }}>
                    {nextDose.medicationName} · {nextDose.dosageLabel}
                  </Text>
                </View>
                <StatusPill status={STATUS_TO_KEY[nextDose.status]} />
              </View>
              <LargeTextButton
                label={nextDose.status === 'MISSED' ? 'Mark as Taken (Late)' : 'Mark as Taken'}
                onPress={() => markTaken(nextDose.scheduleId)}
              />
            </>
          ) : (
            <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
              {intakeItems.length === 0
                ? 'No doses scheduled for today yet — add one from the Medications or Alarms tab.'
                : "Every dose for today is marked taken. Nicely done."}
            </Text>
          )}
        </View>

        <View className="gap-4">
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            Today's Vitals
          </Text>
          {/* Full width, not a half-width slot in the grid below: "120/80
              mmHg" at display-lg size needs more room than a 2-up card can
              give it without truncating — a three-digit "126"/"70" doesn't
              have that problem, which is why only this one gets its own row. */}
          {latestVitals.systolic && latestVitals.diastolic && bloodPressureStage ? (
            <MetricCard
              label="Blood Pressure"
              value={`${latestVitals.systolic.value}/${latestVitals.diastolic.value}`}
              unit="mmHg"
              caption={bloodPressureStage.label}
            />
          ) : (
            <MetricCard label="Blood Pressure" value="—" caption="No reading yet" />
          )}
          <View className="flex-row gap-4">
            <View className="flex-1">
              {latestVitals.bloodGlucose ? (
                <MetricCard
                  label="Blood Glucose"
                  value={String(latestVitals.bloodGlucose.value)}
                  unit={latestVitals.bloodGlucose.unit}
                  caption={hoursAgoLabel(latestVitals.bloodGlucose.timestamp)}
                  status={latestVitals.bloodGlucose.notes === 'Fasting' ? 'fasting' : undefined}
                />
              ) : (
                <MetricCard label="Blood Glucose" value="—" caption="No reading yet" />
              )}
            </View>
            <View className="flex-1">
              {latestVitals.weight ? (
                <MetricCard
                  label="Weight"
                  value={String(latestVitals.weight.value)}
                  unit={latestVitals.weight.unit}
                  caption={hoursAgoLabel(latestVitals.weight.timestamp)}
                />
              ) : (
                <MetricCard label="Weight" value="—" caption="No reading yet" />
              )}
            </View>
          </View>
        </View>

        {medicationAlerts.length > 0 ? (
          <View className="gap-4">
            <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
              Refill &amp; Expiry
            </Text>
            <View
              className="gap-3 rounded-3xl border p-5"
              style={{ backgroundColor: theme.statusTint('missed'), borderColor: theme.colors.hairline }}
            >
              {medicationAlerts.map((alert) => (
                <View key={`${alert.medicationId}-${alert.kind}`} className="flex-row items-center justify-between gap-3">
                  <Text className="flex-1 text-body-lg" numberOfLines={1} style={{ color: theme.colors.ink }}>
                    {alert.medicationName}
                  </Text>
                  <Text className="text-caption" style={{ color: theme.statusText('missed'), fontWeight: '600' }}>
                    {alert.detail}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        <View className="gap-4">
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            Medication Status
          </Text>
          <View className="flex-row flex-wrap gap-2.5">
            {intakeItems.length === 0 ? (
              <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
                No schedule yet today.
              </Text>
            ) : (
              (Object.keys(statusCounts) as IntakeQueueStatus[])
                .filter((key) => statusCounts[key] > 0)
                .map((key) => (
                  <StatusPill
                    key={key}
                    status={STATUS_TO_KEY[key]}
                    label={`${theme.status[STATUS_TO_KEY[key]].label} · ${statusCounts[key]}`}
                  />
                ))
            )}
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
