import { ChevronRight, FileText, HeartPulse, RefreshCw, Settings } from 'lucide-react-native';
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
import { LiquidProgressRing, TodayStatusCard } from '../components/dashboard';
import { ActionRow, ActionRowGroup, AmbientDepthBackground, AppLogo, LargeTextButton, MetricCard, StatusPill } from '../components/ui';
import { useTranslation, type TranslationKey } from '../i18n';
import { triggerHaptic } from '../lib/haptics';
import { generateClinicalReportPdf, shareClinicalReportPdf } from '../reports/pdfService';
import { useIntakeQueueStore, useSentinelStore, useVitalsStore, type IntakeQueueStatus } from '../store';
import type { VitalType } from '../db/types';
import type { StatusKey } from '../theme/tokens';
import { useTheme } from '../theme/useTheme';
import { classifyBloodPressure, type BloodPressureStage } from '../vitals/bpClassification';

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
 *
 * "Once" means once per app session, not once per mount: App.tsx's tab
 * switcher fully unmounts/remounts the active screen on every tab change
 * (HomeScreen's own data-refresh effect below relies on that remount to
 * re-read stores on every revisit), so without this module-level flag the
 * whole stagger would replay — cards sliding/fading in again — every single
 * time someone tabs back to Home, not just on first launch.
 */
let homeRevealedThisSession = false;

function RevealOnMount({ delay, children }: { delay: number; children: ReactNode }) {
  const progress = useSharedValue(homeRevealedThisSession ? 1 : 0);

  useEffect(() => {
    if (homeRevealedThisSession) return;
    progress.value = withDelay(delay, withSpring(1, REVEAL_SPRING));
  }, [delay, progress]);

  const style = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 18 }],
  }));

  return <Animated.View style={style}>{children}</Animated.View>;
}

export interface HomeScreenProps {
  /** Opens the Vitals tab — wired from App.tsx's tab state, since this screen has no navigator of its own to ask for it. */
  onNavigateToVitals?: (focus?: VitalType) => void;
  onOpenSettings?: () => void;
}

export default function HomeScreen({ onNavigateToVitals, onOpenSettings }: HomeScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const healthRecordsRef = useRef<HealthRecordsSheetRef>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<string | null>(null);
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

  // Marks the entrance stagger (see RevealOnMount above) as already played
  // for the rest of this app session, so tabbing back to Home later shows
  // the cards in place immediately instead of re-animating them in.
  useEffect(() => {
    homeRevealedThisSession = true;
  }, []);

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

  const statusRows = useMemo(() => {
    const active = (Object.keys(statusCounts) as IntakeQueueStatus[]).filter(
      (key) => statusCounts[key] > 0,
    );
    if (active.length === 0) return [];
    if (active.length === 1) return [[active[0]]];
    if (active.length === 2) return [[active[0], active[1]]];
    if (active.length === 3) return [[active[0], active[1]], [active[2]]];
    const rows: IntakeQueueStatus[][] = [];
    for (let i = 0; i < active.length; i += 2) {
      if (i + 1 < active.length) {
        rows.push([active[i], active[i + 1]]);
      } else {
        rows.push([active[i]]);
      }
    }
    return rows;
  }, [statusCounts]);

  const overallRatio = intakeItems.length === 0 ? 0 : statusCounts.TAKEN / intakeItems.length;

  const bloodPressureStage =
    latestVitals.systolic && latestVitals.diastolic
      ? classifyBloodPressure(latestVitals.systolic.value, latestVitals.diastolic.value)
      : null;

  // There is no clinic server this app talks to — it's zero-cloud by design
  // (see the vault/report features elsewhere in this app, all on-device).
  // "Sync with Clinic" previously faked that with a 1.5s timeout that did
  // nothing at all. The honest, actually-useful version of "sync" for an
  // offline-first app is the same thing Health Records already does for the
  // same data: generate the current clinical PDF and hand it to the OS share
  // sheet, so the person can actually get it to their clinic over whatever
  // channel they already use (email, WhatsApp, their portal's upload form).
  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncStatus(null);
    try {
      const filePath = await generateClinicalReportPdf();
      await shareClinicalReportPdf(filePath);
      setSyncStatus(t('healthRecords.reportGenerated'));
      triggerHaptic('notificationSuccess');
    } catch (error) {
      setSyncStatus(t('healthRecords.reportFailed', { error: error instanceof Error ? error.message : String(error) }));
    } finally {
      setSyncing(false);
    }
  }, [t]);

  // Large-title-collapse: the greeting/title block lives in the scrollable
  // content (not pinned), so it naturally scrolls away as the user scrolls
  // down — exactly how iOS's own large titles behave, they aren't fixed in
  // place and shrunk, they scroll off and a small title takes over in the
  // bar above. Only the small title + theme toggle live in that fixed bar.
  const scrollY = useSharedValue(0);
  const scrollHandler = useAnimatedScrollHandler((event) => {
    scrollY.value = event.contentOffset.y;
  });

  const headerElevationStyle = useAnimatedStyle(() => ({
    shadowOpacity: interpolate(scrollY.value, [0, 24], [0, 0.4], Extrapolation.CLAMP),
    elevation: interpolate(scrollY.value, [0, 24], [0, 8], Extrapolation.CLAMP),
  }));

  const seeAllScale = useSharedValue(1);
  const seeAllPressStyle = useAnimatedStyle(() => ({ transform: [{ scale: seeAllScale.value }] }));

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor: theme.colors.canvas }}>
      <AmbientDepthBackground />

      {/* World-class persistent header strictly adhering to Apple HIG & Material You */}
      <Animated.View
        style={[
          {
            height: 64,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            backgroundColor: theme.mode === 'dark' ? 'rgba(11, 15, 25, 0.92)' : theme.colors.canvas,
            borderBottomWidth: 1,
            borderBottomColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 4 },
            shadowRadius: 12,
          },
          headerElevationStyle,
        ]}
      >
        {/* Top-left branding: perfectly proportioned squircle mark cleanly aligned with zero awkward spacing */}
        <View className="flex-row items-center gap-3">
          <AppLogo size={42} />
          <View className="justify-center">
            <Text
              className="text-caption font-semibold uppercase tracking-wider"
              style={{ color: theme.colors.inkSecondary, fontSize: 11, letterSpacing: 0.8 }}
            >
              {greeting}
            </Text>
            <Text
              className="text-title-lg font-extrabold"
              style={{ color: theme.colors.ink, fontSize: 21, lineHeight: 25 }}
              numberOfLines={1}
            >
              {t('home.brand')}
            </Text>
          </View>
        </View>

        {/* Top-right quick actions: frosted glass circular buttons in dark mode, the original tinted-action-color buttons in light mode */}
        <View className="flex-row items-center gap-2.5">
          <Pressable
            onPress={handleSync}
            disabled={syncing}
            accessibilityRole="button"
            accessibilityLabel={t('home.syncWithClinic')}
            hitSlop={6}
            className="items-center justify-center rounded-full"
            style={{
              width: 40,
              height: 40,
              backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : `${theme.action.base}14`,
              borderWidth: theme.mode === 'dark' ? 1 : 0,
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }}
          >
            {syncing ? (
              <RefreshCw color={theme.action.base} size={18} />
            ) : (
              <FileText color={theme.mode === 'dark' ? theme.colors.inkSecondary : theme.action.base} size={19} strokeWidth={2} />
            )}
          </Pressable>
          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            accessibilityLabel={t('home.settings')}
            hitSlop={6}
            className="items-center justify-center rounded-full"
            style={{
              width: 40,
              height: 40,
              backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.06)' : `${theme.action.base}14`,
              borderWidth: theme.mode === 'dark' ? 1 : 0,
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }}
          >
            <Settings color={theme.mode === 'dark' ? theme.colors.inkSecondary : theme.action.base} size={19} strokeWidth={2} />
          </Pressable>
        </View>
      </Animated.View>

      <Animated.ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36, gap: 20 }}
        showsVerticalScrollIndicator={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handlePullToRefresh} tintColor={theme.action.base} colors={[theme.action.base]} />
        }
      >
        {/* Today's Progress Card: Glassmorphism with rich emerald adherence ring and vibrant status badges */}
        <RevealOnMount delay={0}>
          <View
            className="gap-5 rounded-3xl p-6"
            style={{
              backgroundColor: theme.mode === 'dark' ? 'rgba(31, 41, 55, 0.75)' : theme.colors.elevated,
              borderWidth: 1,
              borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 10 },
              shadowOpacity: theme.mode === 'dark' ? 0.35 : 0.08,
              shadowRadius: 20,
              elevation: 8,
            }}
          >
            {theme.mode === 'dark' ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 20,
                  right: 20,
                  height: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }}
              />
            ) : null}
            <View className="flex-row items-center gap-5">
              <LiquidProgressRing ratio={overallRatio} size={118} />
              <View className="flex-1 gap-1">
                <Text className="text-caption font-semibold uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                  {t('home.todaysProgress')}
                </Text>
                <Text className="text-title-lg font-bold" style={{ color: theme.colors.ink, fontSize: 24 }}>
                  {t('home.doseCount', { taken: statusCounts.TAKEN, total: intakeItems.length })}
                </Text>
                <Text className="text-caption font-medium" style={{ color: theme.colors.inkSecondary }}>
                  {intakeItems.length === 0
                    ? t('home.progressEmpty')
                    : statusCounts.TAKEN === intakeItems.length
                      ? t('home.progressAllDone')
                      : t('home.progressSummary', { pending: statusCounts.PENDING, missed: statusCounts.MISSED })}
                </Text>
              </View>
            </View>
            {statusRows.length > 0 ? (
              <View
                className="gap-2.5 pt-4"
                style={{
                  borderTopWidth: 1,
                  borderTopColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
                }}
              >
                {statusRows.map((row, rowIndex) => (
                  <View key={rowIndex} className="flex-row gap-2.5">
                    {row.map((key) => (
                      <TodayStatusCard
                        key={key}
                        status={STATUS_TO_KEY[key]}
                        label={t(STATUS_TRANSLATION_KEY[key])}
                        count={statusCounts[key]}
                      />
                    ))}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        </RevealOnMount>

        {/* Hero Next Dose Card: Glassmorphism with crisp typography and glowing action */}
        <RevealOnMount delay={60}>
          <View
            className="gap-5 rounded-[28px] p-7"
            style={{
              backgroundColor: theme.mode === 'dark' ? 'rgba(31, 41, 55, 0.75)' : theme.colors.elevated,
              borderWidth: 1,
              borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
              shadowColor: '#000000',
              shadowOffset: { width: 0, height: 12 },
              shadowOpacity: theme.mode === 'dark' ? 0.4 : 0.08,
              shadowRadius: 24,
              elevation: 10,
            }}
          >
            {theme.mode === 'dark' ? (
              <View
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 20,
                  right: 20,
                  height: 1,
                  backgroundColor: 'rgba(255, 255, 255, 0.1)',
                }}
              />
            ) : null}
            <View className="flex-row items-center gap-2">
              <View
                className="h-2.5 w-2.5 rounded-full"
                style={[
                  { backgroundColor: theme.action.base },
                  theme.mode === 'dark'
                    ? { shadowColor: theme.action.base, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.9, shadowRadius: 6, elevation: 2 }
                    : null,
                ]}
              />
              <Text className="text-caption font-semibold uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                {t('home.nextDose')}
              </Text>
            </View>
            {nextDose ? (
              <>
                <View className="flex-row items-end justify-between gap-3">
                  <View className="flex-1">
                    <Text className="text-display-lg font-extrabold" numberOfLines={1} style={{ color: theme.colors.ink, fontSize: 38 }}>
                      {formatTimeLabel(nextDose.timeUtc)}
                    </Text>
                    <Text className="mt-1 text-body-lg font-medium" numberOfLines={1} style={{ color: theme.colors.inkSecondary }}>
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
              <Text className="text-body-lg font-medium" style={{ color: theme.colors.inkSecondary }}>
                {intakeItems.length === 0 ? t('home.noDoseScheduled') : t('home.allDosesTaken')}
              </Text>
            )}
          </View>
        </RevealOnMount>

        {/* Today's Vitals: Horizontal strip of glassmorphism MetricCards */}
        <RevealOnMount delay={120}>
          <View className="gap-4">
            <View className="flex-row items-center justify-between">
              <Text className="text-caption font-semibold uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                {t('home.todaysVitals')}
              </Text>
              {onNavigateToVitals ? (
                <Animated.View style={seeAllPressStyle}>
                  <Pressable
                    onPress={() => onNavigateToVitals?.()}
                    onPressIn={() => {
                      seeAllScale.value = withSpring(0.92, PRESS_SPRING);
                    }}
                    onPressOut={() => {
                      seeAllScale.value = withSpring(1, PRESS_SPRING);
                    }}
                    accessibilityRole="button"
                    className="min-h-hit flex-row items-center gap-0.5"
                    hitSlop={8}
                  >
                    <Text className="text-caption font-semibold" style={{ color: theme.action.base }}>
                      {t('common.seeAll')}
                    </Text>
                    <ChevronRight color={theme.action.base} size={16} strokeWidth={2.5} />
                  </Pressable>
                </Animated.View>
              ) : null}
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
              <View style={{ width: 182 }}>
                {latestVitals.systolic && latestVitals.diastolic && bloodPressureStage ? (
                  <MetricCard
                    compact
                    onPress={() => onNavigateToVitals?.('BP_SYS')}
                    label={t('home.bloodPressure')}
                    value={`${latestVitals.systolic.value}/${latestVitals.diastolic.value}`}
                    unit="mmHg"
                    caption={t(BP_STAGE_KEY[bloodPressureStage.stage])}
                  />
                ) : (
                  <MetricCard compact onPress={() => onNavigateToVitals?.('BP_SYS')} label={t('home.bloodPressure')} value="—" caption={t('home.noReadingYet')} />
                )}
              </View>
              <View style={{ width: 182 }}>
                {latestVitals.bloodGlucose ? (
                  <MetricCard
                    compact
                    onPress={() => onNavigateToVitals?.('BLOOD_SUGAR')}
                    label={t('home.bloodGlucose')}
                    value={String(latestVitals.bloodGlucose.value)}
                    unit={latestVitals.bloodGlucose.unit}
                    caption={hoursAgoLabel(latestVitals.bloodGlucose.timestamp, t)}
                    status={latestVitals.bloodGlucose.notes === 'Fasting' ? 'fasting' : undefined}
                  />
                ) : (
                  <MetricCard compact onPress={() => onNavigateToVitals?.('BLOOD_SUGAR')} label={t('home.bloodGlucose')} value="—" caption={t('home.tapToLog')} />
                )}
              </View>
              <View style={{ width: 182 }}>
                {latestVitals.weight ? (
                  <MetricCard
                    compact
                    onPress={() => onNavigateToVitals?.('WEIGHT')}
                    label={t('home.weight')}
                    value={String(latestVitals.weight.value)}
                    unit={latestVitals.weight.unit}
                    caption={hoursAgoLabel(latestVitals.weight.timestamp, t)}
                  />
                ) : (
                  <MetricCard compact onPress={() => onNavigateToVitals?.('WEIGHT')} label={t('home.weight')} value="—" caption={t('home.tapToLog')} />
                )}
              </View>
            </ScrollView>
          </View>
        </RevealOnMount>

        {/* Refill and Expiry Alerts */}
        {medicationAlerts.length > 0 ? (
          <RevealOnMount delay={180}>
            <View className="gap-3.5">
              <Text className="text-caption font-semibold uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                {t('home.refillAndExpiry')}
              </Text>
              <View
                className="gap-3 rounded-3xl p-5"
                style={{
                  backgroundColor: theme.statusTint('missed'),
                  borderWidth: 1,
                  borderColor: theme.mode === 'dark' ? 'rgba(239, 68, 68, 0.28)' : theme.colors.hairline,
                  shadowColor: theme.mode === 'dark' ? theme.statusText('missed') : '#000000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: theme.mode === 'dark' ? 0.25 : 0,
                  shadowRadius: 12,
                  elevation: theme.mode === 'dark' ? 4 : 0,
                }}
              >
                {medicationAlerts.map((alert) => (
                  <View key={`${alert.medicationId}-${alert.kind}`} className="flex-row items-center justify-between gap-3">
                    <Text className="flex-1 text-body-lg font-semibold" numberOfLines={1} style={{ color: theme.colors.ink }}>
                      {alert.medicationName}
                    </Text>
                    <Text className="text-caption font-semibold" style={{ color: theme.statusText('missed') }}>
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

        {/* Quick Clinical Actions */}
        <RevealOnMount delay={300}>
          <View className="gap-3.5">
            <Text className="text-caption font-semibold uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
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
                caption={t('home.syncWithClinicCaption')}
                loading={syncing}
                onPress={handleSync}
                showChevron={false}
              />
            </ActionRowGroup>
            {syncStatus ? (
              <Text className="text-caption font-medium" style={{ color: theme.colors.inkSecondary }}>
                {syncStatus}
              </Text>
            ) : null}
          </View>
        </RevealOnMount>

        {/* Health Records */}
        <RevealOnMount delay={360}>
          <View className="gap-3.5">
            <Text className="text-caption font-semibold uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
              {t('home.healthRecords')}
            </Text>
            <ActionRowGroup>
              <ActionRow
                icon={FileText}
                label={t('home.healthRecordsAndBackup')}
                caption={t('home.healthRecordsCaption')}
                onPress={() => healthRecordsRef.current?.present()}
              />
            </ActionRowGroup>
          </View>
        </RevealOnMount>
      </Animated.ScrollView>

      <HealthRecordsSheet ref={healthRecordsRef} />
    </SafeAreaView>
  );
}
