import { CalendarDays, Trophy } from 'lucide-react-native';
import { useCallback, useRef } from 'react';
import { ScrollView, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  CircadianWaveCanvas,
  DoseActionCard,
  DoseDetailSheet,
  LiquidProgressRing,
  SkipReasonSheet,
  type DoseDetailSheetRef,
  type SkipReasonSheetRef,
} from '../components/dashboard';
import type { DoseEntry } from '../dashboard/types';
import { CircadianDashboardScreenSkeleton } from '../components/ui';
import { useTranslation } from '../i18n';
import { toast, useIntakeQueueStore } from '../store';
import { useLiveDoseSchedule } from '../store/intakeQueueStore';
import { useTheme } from '../theme/useTheme';

/**
 * Skia/Reanimated circadian dashboard for today's real dose schedule —
 * `useLiveDoseSchedule` reads/writes through the shared intake-queue store
 * (`src/store`), which is what actually talks to the database; this screen
 * only renders whatever shape it hands back.
 */
export default function CircadianDashboardScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const { doses, skipReasons, adherenceRatio, markTaken, markSkipped } = useLiveDoseSchedule();
  const { width: windowWidth } = useWindowDimensions();
  const skipSheetRef = useRef<SkipReasonSheetRef>(null);
  const detailSheetRef = useRef<DoseDetailSheetRef>(null);

  const handleRequestSkip = useCallback((dose: DoseEntry) => {
    skipSheetRef.current?.present(dose);
  }, []);

  const handleLongPressDetail = useCallback((dose: DoseEntry) => {
    detailSheetRef.current?.present(dose);
  }, []);

  const handleMarkTaken = useCallback(
    (id: string) => {
      markTaken(id);
      const targetDose = doses.find((d) => d.id === id);
      if (targetDose) {
        toast.success(t('alarmRinging.confirmed', { name: targetDose.medicationName }));
      }
    },
    [doses, markTaken, t],
  );

  const handleSelectReason = useCallback(
    (doseId: string, reason: import('../dashboard/types').SkipReason) => {
      markSkipped(doseId, reason);
      const targetDose = doses.find((d) => d.id === doseId);
      toast.info(`${t('rhythm.skippedPrefix')}${targetDose ? targetDose.medicationName : ''}`);
    },
    [doses, markSkipped, t],
  );

  const intakeLoading = useIntakeQueueStore((state) => state.loading);

  if (intakeLoading && doses.length === 0) {
    return <CircadianDashboardScreenSkeleton />;
  }

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor: theme.colors.canvas }}>
      <View className="border-b px-6 py-6" style={{ borderColor: theme.colors.hairline }}>
        <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
          {t('rhythm.title')}
        </Text>
        <Text className="mt-1 text-caption" style={{ color: theme.colors.inkSecondary }}>
          {t('rhythm.subtitle')}
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-7 px-6 pt-7" showsVerticalScrollIndicator={false}>
        <View className="flex-row items-center justify-between gap-3">
          <Text className="text-caption font-semibold uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            {t('rhythm.todayLabel')} • {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
          </Text>
          {/* Decorative only — there's no calendar/history view to open yet. */}
          <View className="flex-row items-center gap-1.5 rounded-full px-3 py-1.5" style={{ backgroundColor: `${theme.action.base}14` }}>
            <CalendarDays color={theme.action.base} size={14} strokeWidth={2.25} />
            <Text className="text-caption font-semibold" style={{ color: theme.action.base }}>
              {t('rhythm.viewCalendar')}
            </Text>
          </View>
        </View>

        <View className="flex-row items-center justify-center gap-4">
          <LiquidProgressRing ratio={adherenceRatio} label={t('rhythm.adherence')} />
          {doses.length > 0 && adherenceRatio >= 1 ? (
            <View
              className="flex-1 gap-1 rounded-2xl p-3.5"
              style={{
                backgroundColor: theme.statusTint('taken'),
                borderWidth: 1,
                borderColor: theme.mode === 'dark' ? 'rgba(16, 185, 129, 0.28)' : theme.colors.hairline,
              }}
            >
              <View className="flex-row items-center gap-1.5">
                <Trophy color={theme.statusText('taken')} size={16} strokeWidth={2.25} />
                <Text className="text-body-lg font-bold" numberOfLines={1} style={{ color: theme.statusText('taken') }}>
                  {t('rhythm.allDoneTitle')}
                </Text>
              </View>
              <Text className="text-caption font-medium" style={{ color: theme.statusText('taken') }}>
                {t('rhythm.allDoneSubtitle')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* -mx-6 cancels the ScrollView's px-6 so the wave spans the full
            screen width edge-to-edge, matching the reference design, while
            the rest of the page keeps its normal inset padding. Width comes
            straight from the window rather than an onLayout measurement on
            this negative-margined view: a margin-shifted view's first
            layout pass can hand the Skia Canvas a stale/zero width before
            settling, and Canvas doesn't recover from that cleanly. */}
        <View className="-mx-6">
          <CircadianWaveCanvas doses={doses} width={windowWidth} />
        </View>

        <View className="gap-4" style={{ paddingBottom: 32 }}>
          {doses.length === 0 ? (
            <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
              {t('rhythm.noDosesToday')}
            </Text>
          ) : (
            doses.map((dose) => (
              <DoseActionCard
                key={dose.id}
                dose={dose}
                skipReason={skipReasons[dose.id]}
                onMarkTaken={handleMarkTaken}
                onRequestSkip={handleRequestSkip}
                onLongPressDetail={handleLongPressDetail}
              />
            ))
          )}
        </View>
      </ScrollView>

      <SkipReasonSheet ref={skipSheetRef} onSelectReason={handleSelectReason} />
      <DoseDetailSheet ref={detailSheetRef} />
    </SafeAreaView>
  );
}
