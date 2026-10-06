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
        <View className="items-center">
          <LiquidProgressRing ratio={adherenceRatio} label={t('rhythm.adherence')} />
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
