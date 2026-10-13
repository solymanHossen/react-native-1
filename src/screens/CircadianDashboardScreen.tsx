import { Trophy } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View, type LayoutChangeEvent } from 'react-native';
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
import { useTranslation } from '../i18n';
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
  const [canvasWidth, setCanvasWidth] = useState(0);
  const skipSheetRef = useRef<SkipReasonSheetRef>(null);
  const detailSheetRef = useRef<DoseDetailSheetRef>(null);

  const handleMeasureCanvas = useCallback((event: LayoutChangeEvent) => {
    setCanvasWidth(event.nativeEvent.layout.width);
  }, []);

  const handleRequestSkip = useCallback((dose: DoseEntry) => {
    skipSheetRef.current?.present(dose);
  }, []);

  const handleLongPressDetail = useCallback((dose: DoseEntry) => {
    detailSheetRef.current?.present(dose);
  }, []);

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
        <Text className="text-caption font-semibold uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
          {t('rhythm.todayLabel')} • {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
        </Text>

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

        <View onLayout={handleMeasureCanvas}>
          {canvasWidth > 0 ? <CircadianWaveCanvas doses={doses} width={canvasWidth} /> : null}
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
                onMarkTaken={markTaken}
                onRequestSkip={handleRequestSkip}
                onLongPressDetail={handleLongPressDetail}
              />
            ))
          )}
        </View>
      </ScrollView>

      <SkipReasonSheet ref={skipSheetRef} onSelectReason={markSkipped} />
      <DoseDetailSheet ref={detailSheetRef} />
    </SafeAreaView>
  );
}
