import { ChevronRight, FileText, HeartPulse, Moon, RefreshCw, Settings, Sun, SunMoon } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
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
import { SettingsSheet, type SettingsSheetRef } from '../components/settings/SettingsSheet';
import { ActionRow, ActionRowGroup, AppLogo, LargeTextButton, MetricCard, StatusPill } from '../components/ui';
import { useTranslation, type TranslationKey } from '../i18n';
import { triggerHaptic } from '../lib/haptics';
import { useIntakeQueueStore, useSentinelStore, useVitalsStore, type IntakeQueueStatus } from '../store';
import type { StatusKey } from '../theme/tokens';
import { useTheme, useThemePreference, useSetThemePreference, type ThemePreference } from '../theme/useTheme';
import { classifyBloodPressure, type BloodPressureStage } from '../vitals/bpClassification';

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

const STATUS_TRANSLATION_KEY: Record<IntakeQueueStatus, TranslationKey> = {
  TAKEN: 'status.taken',
  MISSED: 'status.missed',
  PENDING: 'status.pending',
  SCHEDULED: 'status.scheduled',
};

const BP_STAGE_KEY: Record<BloodPressureStage, TranslationKey> = {
  NORMAL: 'bpStage.NORMAL',
  ELEVATED: 'bpStage.ELEVATED',
  STAGE_1: 'bpStage.STAGE_1',
  STAGE_2: 'bpStage.STAGE_2',
  CRISIS: 'bpStage.CRISIS',
};

/** Lower sorts first — an imminent dose outranks a merely-upcoming one, and a stale missed one only surfaces once nothing more actionable is left today. */
const STATUS_PRIORITY: Record<IntakeQueueStatus, number> = { PENDING: 0, SCHEDULED: 1, MISSED: 2, TAKEN: 3 };

/** Same spring curve LargeTextButton presses use — one shared "feel" for every press-driven animation in the app, not a per-component guess. */
const PRESS_SPRING = { damping: 16, stiffness: 220, mass: 0.5 };
const REVEAL_SPRING = { damping: 18, stiffness: 180, mass: 0.6 };

function greetingKeyForHour(hour: number): TranslationKey {
  if (hour < 5) return 'home.greetingNight';
  if (hour < 12) return 'home.greetingMorning';
  if (hour < 17) return 'home.greetingAfternoon';
  return 'home.greetingEvening';
}

function formatTimeLabel(timeUtc: string): string {
  const [hours, minutes] = timeUtc.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function hoursAgoLabel(iso: string, t: ReturnType<typeof useTranslation>['t']): string {
  const hours = Math.round((Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60));
  if (hours < 1) return t('home.lastReadingJustNow');
  return t('home.lastReadingHoursAgo', { hours });
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

/**
 * The only remaining un-animated Pressable in the header — gets the same
 * press-scale LargeTextButton uses elsewhere, so every tappable thing on
 * this screen responds the same way. The flat tinted-circle-with-a-border
 * version of this read as a generic icon chip, not a considered control, so
 * two things changed: the hard border is gone in favor of a soft
 * color-matched shadow (a bordered flat tint reads dated; a softly-lifted
 * tint reads like a native modern control), and the icon itself now pops
 * into place — scaling and rotating in from its resting state — every time
 * the preference changes, instead of silently swapping with no transition
 * at all.
 */
function ThemeToggleButton({ preference, onPress }: { preference: ThemePreference; onPress: () => void }) {
  const theme = useTheme();
  const scale = useSharedValue(1);
  const iconEntrance = useSharedValue(1);
  const ThemeIcon = THEME_ICON[preference];

  useEffect(() => {
    iconEntrance.value = 0;
    iconEntrance.value = withSpring(1, { damping: 12, stiffness: 180 });
  }, [preference, iconEntrance]);

  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const iconStyle = useAnimatedStyle(() => ({
    opacity: iconEntrance.value,
    transform: [
      { scale: interpolate(iconEntrance.value, [0, 1], [0.4, 1], Extrapolation.CLAMP) },
      { rotate: `${interpolate(iconEntrance.value, [0, 1], [-50, 0], Extrapolation.CLAMP)}deg` },
    ],
  }));

  return (
    <Animated.View style={pressStyle}>
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
        // Visually smaller than the app's 56dp MIN_HITBOX floor, but not a
        // smaller *touch target* — `hitSlop` pads the invisible tappable
        // area back out to 56dp on every side so the geriatric/low-vision
        // accessibility floor every other interactive control on this
        // screen gets still applies here, it just isn't drawn that large.
        hitSlop={6}
        className="items-center justify-center rounded-full"
        style={{
          width: 44,
          height: 44,
          backgroundColor: `${theme.action.base}14`,
          shadowColor: theme.action.base,
          shadowOffset: { width: 0, height: 3 },
          shadowOpacity: 0.22,
          shadowRadius: 8,
          elevation: 3,
        }}
      >
        <Animated.View style={iconStyle}>
          <ThemeIcon color={theme.action.base} size={20} strokeWidth={2.25} />
        </Animated.View>
      </Pressable>
    </Animated.View>
  );
}

export interface HomeScreenProps {
  /** Opens the Vitals tab — wired from App.tsx's tab state, since this screen has no navigator of its own to ask for it. */
  onNavigateToVitals?: () => void;
}

export default function HomeScreen({ onNavigateToVitals }: HomeScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const preference = useThemePreference();
  const setPreference = useSetThemePreference();
  const healthRecordsRef = useRef<HealthRecordsSheetRef>(null);
  const settingsRef = useRef<SettingsSheetRef>(null);
  const [syncing, setSyncing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const greeting = useMemo(() => t(greetingKeyForHour(new Date().getHours())), [t]);

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
  // The fixed bar "lifts" above the scrolling content with a soft shadow
  // once there's something to lift above — zero elevation at rest (where a
  // shadow would just look like a stray line under an empty bar), growing in
  // over the same 24dp the hairline fades in over so the two depth cues
  // settle together instead of arriving at different moments.
  const headerElevationStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(scrollY.value, [0, 24], [0, 0.12], Extrapolation.CLAMP),
    elevation: interpolate(scrollY.value, [0, 24], [0, 6], Extrapolation.CLAMP),
  }));
  const largeTitleStyle = useAnimatedStyle(() => ({
    opacity: interpolate(scrollY.value, [0, 50], [1, 0], Extrapolation.CLAMP),
    transform: [{ translateY: interpolate(scrollY.value, [0, 50], [0, -8], Extrapolation.CLAMP) }],
  }));

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor: theme.colors.canvas }}>
      {/* Persistent bar: always on screen, same spot a real iOS nav bar's
          trailing button would be. Only the small logo+title lockup cross-
          fades in — the theme toggle never moves or disappears. A soft
          shadow (headerElevationStyle) grows in alongside it so the bar
          reads as lifted above the content scrolling beneath it, not just a
          flat strip with a line under it. */}
      <Animated.View
        style={[
          {
            height: 56,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 24,
            backgroundColor: theme.colors.canvas,
            shadowColor: theme.colors.ink,
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 10,
          },
          headerElevationStyle,
        ]}
      >
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 10 }, compactTitleStyle]}>
          <AppLogo size={30} />
          <Text className="text-title-lg" style={{ color: theme.colors.ink }} numberOfLines={1}>
            {t('home.brand')}
          </Text>
        </Animated.View>
        <ThemeToggleButton preference={preference} onPress={() => setPreference(NEXT_PREFERENCE[preference])} />
      </Animated.View>
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
        <Animated.View style={[{ flexDirection: 'row', alignItems: 'center', gap: 16 }, largeTitleStyle]}>
          <AppLogo size={52} />
          <View style={{ flex: 1, gap: 2 }}>
            <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
              {greeting}
            </Text>
            <Text className="text-display-lg" numberOfLines={1} style={{ color: theme.colors.ink }}>
              {t('home.brand')}
            </Text>
          </View>
        </Animated.View>

        {/* Today's Progress: the same Liquid Progress Ring the Rhythm tab
            uses, reused as-is rather than rebuilt — an Apple Health-style
            "rings" opening beat for the dashboard, and visual continuity
            with the tab that shares this screen's underlying data. The
            per-status breakdown (formerly its own separate "Medication
            Status" section further down the page) now lives in this same
            card as a row of pills below a hairline divider — one score card
            with its breakdown attached, not two sections repeating the same
            counts a scroll apart. */}
        <RevealOnMount delay={0}>
          <View
            className="gap-5 rounded-3xl border p-6 shadow-md"
            style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
          >
            <View className="flex-row items-center gap-5">
              <LiquidProgressRing ratio={overallRatio} size={116} />
              <View className="flex-1 gap-1">
                <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                  {t('home.todaysProgress')}
                </Text>
                <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
                  {t('home.doseCount', { taken: statusCounts.TAKEN, total: intakeItems.length })}
                </Text>
                <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                  {intakeItems.length === 0
                    ? t('home.progressEmpty')
                    : statusCounts.TAKEN === intakeItems.length
                      ? t('home.progressAllDone')
                      : t('home.progressSummary', { pending: statusCounts.PENDING, missed: statusCounts.MISSED })}
                </Text>
              </View>
            </View>
            {intakeItems.length > 0 ? (
              <View className="flex-row flex-wrap gap-2.5 border-t pt-4" style={{ borderColor: theme.colors.hairline }}>
                {(Object.keys(statusCounts) as IntakeQueueStatus[])
                  .filter((key) => statusCounts[key] > 0)
                  .map((key) => (
                    <StatusPill
                      key={key}
                      status={STATUS_TO_KEY[key]}
                      label={`${t(STATUS_TRANSLATION_KEY[key])} · ${statusCounts[key]}`}
                    />
                  ))}
              </View>
            ) : null}
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
                {t('home.nextDose')}
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
                  label={nextDose.status === 'MISSED' ? t('home.markAsTakenLate') : t('home.markAsTaken')}
                  onPress={() => markTaken(nextDose.scheduleId)}
                />
              </>
            ) : (
              <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
                {intakeItems.length === 0 ? t('home.noDoseScheduled') : t('home.allDosesTaken')}
              </Text>
            )}
          </View>
        </RevealOnMount>

        {/* A horizontal carousel of compact cards, not a full-width-plus-2-up
            grid: it scales to more vitals later without the layout needing
            re-balancing (today it's 3 cards, tomorrow a 4th just appends),
            and it scans like a single "today's numbers" strip rather than
            three separately-weighted blocks. Each card keeps its own
            `onPress` through to the Vitals tab so the dashboard stays a
            summary — the detail, history and logging all live over there. */}
        <RevealOnMount delay={120}>
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                {t('home.todaysVitals')}
              </Text>
              {onNavigateToVitals ? (
                <Pressable
                  onPress={onNavigateToVitals}
                  accessibilityRole="button"
                  className="min-h-hit flex-row items-center gap-0.5"
                  hitSlop={8}
                >
                  <Text className="text-caption" style={{ color: theme.action.base, fontWeight: '600' }}>
                    {t('common.seeAll')}
                  </Text>
                  <ChevronRight color={theme.action.base} size={16} strokeWidth={2.5} />
                </Pressable>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <View style={{ width: 182 }}>
                {latestVitals.systolic && latestVitals.diastolic && bloodPressureStage ? (
                  <MetricCard
                    compact
                    onPress={onNavigateToVitals}
                    label={t('home.bloodPressure')}
                    value={`${latestVitals.systolic.value}/${latestVitals.diastolic.value}`}
                    unit="mmHg"
                    caption={t(BP_STAGE_KEY[bloodPressureStage.stage])}
                  />
                ) : (
                  <MetricCard compact onPress={onNavigateToVitals} label={t('home.bloodPressure')} value="—" caption={t('home.noReadingYet')} />
                )}
              </View>
              <View style={{ width: 182 }}>
                {latestVitals.bloodGlucose ? (
                  <MetricCard
                    compact
                    onPress={onNavigateToVitals}
                    label={t('home.bloodGlucose')}
                    value={String(latestVitals.bloodGlucose.value)}
                    unit={latestVitals.bloodGlucose.unit}
                    caption={hoursAgoLabel(latestVitals.bloodGlucose.timestamp, t)}
                    status={latestVitals.bloodGlucose.notes === 'Fasting' ? 'fasting' : undefined}
                  />
                ) : (
                  <MetricCard compact onPress={onNavigateToVitals} label={t('home.bloodGlucose')} value="—" caption={t('home.noReadingYet')} />
                )}
              </View>
              <View style={{ width: 182 }}>
                {latestVitals.weight ? (
                  <MetricCard
                    compact
                    onPress={onNavigateToVitals}
                    label={t('home.weight')}
                    value={String(latestVitals.weight.value)}
                    unit={latestVitals.weight.unit}
                    caption={hoursAgoLabel(latestVitals.weight.timestamp, t)}
                  />
                ) : (
                  <MetricCard compact onPress={onNavigateToVitals} label={t('home.weight')} value="—" caption={t('home.noReadingYet')} />
                )}
              </View>
            </ScrollView>
          </View>
        </RevealOnMount>

        {medicationAlerts.length > 0 ? (
          <RevealOnMount delay={180}>
            <View className="gap-4">
              <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                {t('home.refillAndExpiry')}
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
                      {alert.kind === 'LOW_STOCK'
                        ? t('home.alertLeft', { count: alert.value })
                        : alert.kind === 'EXPIRED'
                          ? t('home.alertExpiredDaysAgo', { days: alert.value })
                          : alert.value === 0
                            ? t('home.alertExpiresToday')
                            : t('home.alertExpiresInDays', { days: alert.value })}
                    </Text>
                  </View>
                ))}
              </View>
            </View>
          </RevealOnMount>
        ) : null}

        {/* Menu rows, not stacked LargeTextButtons: every entry here is
            navigation ("go open X"), not a commitment the way Mark as Taken
            or Confirm is, so a repeated full-width colored pill per row gave
            each one the same maximum visual weight and ate far more vertical
            space than a scannable list needs. The old "Unavailable Offline"
            entry — a permanently-disabled button with no real feature behind
            it — is dropped rather than carried forward in the new style; a
            dead control that can never be pressed doesn't earn a place in a
            cleaned-up menu just because it existed before. */}
        <RevealOnMount delay={300}>
          <View className="gap-4">
            <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
              {t('home.actions')}
            </Text>
            <ActionRowGroup>
              <ActionRow
                icon={HeartPulse}
                label={t('home.logAReading')}
                caption={t('home.logAReadingCaption')}
                onPress={onNavigateToVitals}
              />
              <ActionRow
                icon={RefreshCw}
                label={syncing ? t('home.syncing') : t('home.syncWithClinic')}
                loading={syncing}
                onPress={handleSync}
                showChevron={false}
              />
            </ActionRowGroup>
          </View>
        </RevealOnMount>

        <RevealOnMount delay={360}>
          <View className="gap-4">
            <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
              {t('home.healthRecords')}
            </Text>
            <ActionRowGroup>
              <ActionRow
                icon={FileText}
                label={t('home.healthRecordsAndBackup')}
                caption={t('home.healthRecordsCaption')}
                onPress={() => healthRecordsRef.current?.present()}
              />
              <ActionRow icon={Settings} label={t('home.settings')} onPress={() => settingsRef.current?.present()} />
            </ActionRowGroup>
          </View>
        </RevealOnMount>
      </Animated.ScrollView>

      <HealthRecordsSheet ref={healthRecordsRef} />
      <SettingsSheet ref={settingsRef} />
    </SafeAreaView>
  );
}
