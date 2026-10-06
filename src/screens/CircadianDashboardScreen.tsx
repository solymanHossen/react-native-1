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
import { useDoseSchedule } from '../dashboard/doseSchedule';
import type { DoseEntry } from '../dashboard/types';
import { useTheme } from '../theme/useTheme';

/**
 * Showcase screen for the Skia/Reanimated circadian dashboard — a fixed
 * demo regimen, same "no live DB, not a real deliverable screen" convention
 * as DrugLabScreen, wired in behind App.tsx's dev-only tab switcher.
 */
export default function CircadianDashboardScreen() {
  const theme = useTheme();
  const { doses, skipReasons, adherenceRatio, markTaken, markSkipped } = useDoseSchedule();
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
          Today's Rhythm
        </Text>
        <Text className="mt-1 text-caption" style={{ color: theme.colors.inkSecondary }}>
          Swipe right to mark taken, left to skip, hold for details.
        </Text>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-7 px-6 pt-7" showsVerticalScrollIndicator={false}>
        <View className="items-center">
          <LiquidProgressRing ratio={adherenceRatio} label="Adherence" />
        </View>

        <View onLayout={handleMeasureCanvas}>
          {canvasWidth > 0 ? <CircadianWaveCanvas doses={doses} width={canvasWidth} /> : null}
        </View>

        <View className="gap-4" style={{ paddingBottom: 32 }}>
          {doses.map((dose) => (
            <DoseActionCard
              key={dose.id}
              dose={dose}
              skipReason={skipReasons[dose.id]}
              onMarkTaken={markTaken}
              onRequestSkip={handleRequestSkip}
              onLongPressDetail={handleLongPressDetail}
            />
          ))}
        </View>
      </ScrollView>

      <SkipReasonSheet ref={skipSheetRef} onSelectReason={markSkipped} />
      <DoseDetailSheet ref={detailSheetRef} />
    </SafeAreaView>
  );
}
