import { Moon, Sun, SunMoon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
} from 'react-native-reanimated';
import { HealthRecordsSheet, type HealthRecordsSheetRef } from '../components/records/HealthRecordsSheet';
import { LiquidProgressRing } from '../components/dashboard/LiquidProgressRing';
import { LargeTextButton, MetricCard, StatusPill } from '../components/ui';
import { triggerHaptic } from '../lib/haptics';
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

/** Same spring curve LargeTextButton presses use — one shared "feel" for every press-driven animation in the app, not a per-component guess. */
const PRESS_SPRING = { damping: 16, stiffness: 220, mass: 0.5 };
const REVEAL_SPRING = { damping: 18, stiffness: 180, mass: 0.6 };

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

/**
 * Every section fades and lifts into place on a staggered delay instead of
 * popping in all at once — the single cheapest change that makes a screen
 * read as "designed" rather than "rendered". Plain `useEffect` + `withDelay`
 * per instance, not a shared orchestrator: each section mounts once and
 * never needs to replay, so there's nothing to coordinate centrally.
 */
function RevealOnMount({ delay, children }: { delay: number; children: ReactNode }) {
  const progress = useSharedValue(0);

  useEffect(() => {
    progress.value = withDelay(delay, withSpring(1, REVEAL_SPRING));
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 18 }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

/** The only remaining un-animated Pressable in the header — gets the same press-scale LargeTextButton uses elsewhere, so every tappable thing on this screen responds the same way. */
function ThemeToggleButton({ preference, onPress }: { preference: ThemePreference; onPress: () => void }) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const ThemeIcon = THEME_ICON[preference];

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={style}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.92, PRESS_SPRING);
        }}
        onPressOut={() => {
          scale.value = withSpring(1, PRESS_SPRING);
        }}
        onPress={() => {
          triggerHaptic('selection');
          onPress();
        }}
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
    </Animated.View>
  );
}

export default function HomeScreen() {
  const theme = useTheme();
  const preference = useThemePreference();
  const setPreference = useSetThemePreference();
  const healthRecordsRef = useRef<HealthRecordsSheetRef>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const greeting = useMemo(() => greetingForHour(new Date().getHours()), []);

  const intakeItems = useIntakeQueueStore((state) => state.items);
  const refreshIntakeQueue = useIntakeQueueStore((state) => state.refresh);
  const markTaken = useIntakeQueueStore((state) => state.markTaken);
  const latestVitals = useVitalsStore((state) => state.latest);
  const refreshVitals = useVitalsStore((state) => state.refresh);
  const medicationAlerts = useSentinelStore((state) => state.alerts);
  const refreshAlerts = useSentinelStore((state) => state.refresh);

  const refreshEverything = useCallback(
    () => Promise.all([refreshIntakeQueue(), refreshVitals(), refreshAlerts()]),
    [refreshIntakeQueue, refreshVitals, refreshAlerts],
  );

  // Re-reads on every mount (i.e. every time this tab is switched back to),
  // not just once at app startup — the alarm engine's own NFC/vision-verified
  // intake writes go straight to SQLite without touching this store, so
  // "whatever the store already holds in memory" can go stale the moment the
  // user resolves a dose from an alarm instead of from this screen.
  useEffect(() => {
    refreshEverything().catch(() => {});
  }, [refreshEverything]);

  const handlePullToRefresh = useCallback(() => {
    setRefreshing(true);
    triggerHaptic('impactLight');
    refreshEverything()
      .catch(() => {})
      .finally(() => setRefreshing(false));
  }, [refreshEverything]);

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

  const overallRatio = intakeItems.length === 0 ? 0 : statusCounts.TAKEN / intakeItems.length;

  const bloodPressureStage =
    latestVitals.systolic && latestVitals.diastolic
      ? classifyBloodPressure(latestVitals.systolic.value, latestVitals.diastolic.value)
      : null;

  const handleSync = () => {
    setSyncing(true);
    setTimeout(() => setSyncing(false), 1500);
  };

  // Large-title-collapse: the greeting/title block lives in the scrollable
  // content (not pinned), so it naturally scrolls away as the user scrolls
  // down — exactly how iOS's own large titles behave, they aren't fixed in
  // place and shrunk, they scroll off and a small title takes over in the
  // bar above. Only the small title + theme toggle live in that fixed bar.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });
  const compactTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [24, 64], [0, 1], Extrapolation.CLAMP),
  }));
  const headerHairlineStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 24], [0, 1], Extrapolation.CLAMP),
  }));
  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 50], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 50], [0, -8], Extrapolation.CLAMP) }],
  }));

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor: theme.colors.canvas }}>
      {/* Persistent bar: always on screen, same spot a real iOS nav bar's
          trailing button would be. Only the small title cross-fades in —
          the theme toggle never moves or disappears. */}
      <View style={{ height: 56, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 }}>
        <Animated.Text className="text-title-lg" style={[{ color: theme.colors.ink }, compactTitleStyle]} numberOfLines={1}>
          Medius Health
        </Animated.Text>
        <ThemeToggleButton preference={preference} onPress={() => setPreference(NEXT_PREFERENCE[preference])} />
      </View>
      <Animated.View style={[{ height: 1, backgroundColor: theme.colors.hairline }, headerHairlineStyle]} />

      <Animated.ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 32, gap: 36 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor={theme.action.base} colors={[theme.action.base]} />
        }
      >
        <Animated.View style={[{ gap: 2 }, largeTitleStyle]}>
          <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
            {greeting}
          </Text>
          <Text className="text-display-lg" style={{ color: theme.colors.ink }}>
            Medius Health
          </Text>
        </Animated.View>

        {/* Today's Progress: the same Liquid Progress Ring the Rhythm tab
            uses, reused as-is rather than rebuilt — an Apple Health-style
            "rings" opening beat for the dashboard, and visual continuity
            with the tab that shares this screen's underlying data. */}
        <RevealOnMount delay={0}>
          <View
            className="flex-row items-center gap-5 rounded-3xl border p-6 shadow-md"
            style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
          >
            <LiquidProgressRing ratio={overallRatio} size={108} />
            <View className="flex-1 gap-1">
              <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                Today's Progress
              </Text>
              <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
                {statusCounts.TAKEN} of {intakeItems.length} doses
              </Text>
              <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                {intakeItems.length === 0
                  ? 'Nothing scheduled yet today'
                  : statusCounts.TAKEN === intakeItems.length
                    ? 'All done for today'
                    : `${statusCounts.PENDING} due soon · ${statusCounts.MISSED} missed`}
              </Text>
            </View>
          </View>
        </RevealOnMount>

        {/* Hero: the single most important thing on the screen, sized and
            weighted accordingly (Display Large for the time), not sharing
            visual priority with the vitals grid below it. Real data from
            the shared intake-queue store, not a fixed placeholder — the
            same store the Rhythm tab's dashboard reads and writes, so
            marking a dose taken from either screen is reflected on both. */}
        <RevealOnMount delay={60}>
          <View
            className="gap-5 rounded-[28px] border p-8 shadow-lg"
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
                {/* `flex-1` + `numberOfLines` on the text column, not just
                    `justify-between` — without a width constraint on this
                    side, a long medication name grows the column past the
                    card's edge and pushes the StatusPill off it (and off the
                    screen) instead of the text wrapping/truncating. The pill
                    itself is left at its natural size so it never shrinks. */}
                <View className="flex-row items-end justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-display-lg" numberOfLines={1} style={{ color: theme.colors.ink }}>
                      {formatTimeLabel(nextDose.timeUtc)}
                    </Text>
                    <Text className="mt-1 text-body-lg" numberOfLines={1} style={{ color: theme.colors.inkSecondary }}>
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
                  : 'Every dose for today is marked taken. Nicely done.'}
              </Text>
            )}
          </View>
        </RevealOnMount>

        <RevealOnMount delay={120}>
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
        </RevealOnMount>

        {medicationAlerts.length > 0 ? (
          <RevealOnMount delay={180}>
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
          </RevealOnMount>
        ) : null}

        <RevealOnMount delay={240}>
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
        </RevealOnMount>

        <RevealOnMount delay={300}>
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
        </RevealOnMount>

        <RevealOnMount delay={360}>
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
        </RevealOnMount>
      </Animated.ScrollView>

      <HealthRecordsSheet ref={healthRecordsRef} />
    </SafeAreaView>
  );
}
