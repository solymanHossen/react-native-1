import { useCallback, useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { BloodPressureCard } from '../components/vitals/BloodPressureCard';
import { Sparkline } from '../components/vitals/Sparkline';
import { SymptomLogSheet, type SymptomLogSheetRef } from '../components/vitals/SymptomLogSheet';
import { VitalStepperCard } from '../components/vitals/VitalStepperCard';
import { LargeTextButton } from '../components/ui';
import { initializeDatabase } from '../db';
import type { Vital, VitalType } from '../db/types';
import { useTranslation, type TranslationKey } from '../i18n';
import { triggerHaptic } from '../lib/haptics';
import { useVitalsStore } from '../store';
import { useTheme } from '../theme/useTheme';

type GlucoseContext = 'Fasting' | 'Post-prandial';
type TrendRange = 7 | 30;

const SPARKLINE_OPTIONS: Array<{ type: VitalType; labelKey: TranslationKey; unit: string; color: string }> = [
  { type: 'BP_SYS', labelKey: 'vitals.systolicShort', unit: 'mmHg', color: '#0077B6' },
  { type: 'BLOOD_SUGAR', labelKey: 'vitals.glucoseShort', unit: 'mmol/L', color: '#00A3A3' },
  { type: 'WEIGHT', labelKey: 'vitals.weightShort', unit: 'kg', color: '#8E5C00' },
  { type: 'TEMPERATURE', labelKey: 'vitals.tempShort', unit: '°F', color: '#CD0000' },
];

const GLUCOSE_CONTEXT_KEY: Record<GlucoseContext, TranslationKey> = {
  Fasting: 'vitals.fasting',
  'Post-prandial': 'vitals.postPrandial',
};

function isoDaysAgo(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return date.toISOString();
}

/**
 * Pending entry state lives here, independent per vital — a caregiver might
 * log blood pressure now and weight later, so each card saves on its own
 * rather than one combined "save everything" action.
 */
export default function VitalsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const symptomSheetRef = useRef<SymptomLogSheetRef>(null);
  const refreshLatestVitals = useVitalsStore((state) => state.refresh);

  const [systolic, setSystolic] = useState(120);
  const [diastolic, setDiastolic] = useState(80);
  const [glucose, setGlucose] = useState(5.5);
  const [glucoseContext, setGlucoseContext] = useState<GlucoseContext>('Fasting');
  const [weight, setWeight] = useState(70);
  const [temperature, setTemperature] = useState(98.6);
  const [status, setStatus] = useState<string | null>(null);

  const [trendType, setTrendType] = useState<VitalType>('BP_SYS');
  const [trendRange, setTrendRange] = useState<TrendRange>(7);
  const [trendPoints, setTrendPoints] = useState<Vital[]>([]);
  const [canvasWidth, setCanvasWidth] = useState(0);

  const refreshTrend = useCallback(async (type: VitalType, range: TrendRange) => {
    const database = await initializeDatabase();
    const points = await database.vitals.listByTypeSince(type, isoDaysAgo(range));
    setTrendPoints(points);
  }, []);

  useEffect(() => {
    refreshTrend(trendType, trendRange).catch((error: unknown) => {
      console.warn('[VitalsScreen] failed to load trend', error);
    });
  }, [trendType, trendRange, refreshTrend]);

  const saveVital = useCallback(
    async (type: VitalType, value: number, unit: string, notes: string | null, savedMessageKey: TranslationKey) => {
      const database = await initializeDatabase();
      await database.vitals.record({ timestamp: new Date().toISOString(), type, value, unit, notes });
      triggerHaptic('notificationSuccess');
      setStatus(t(savedMessageKey));
      if (type === trendType) {
        refreshTrend(trendType, trendRange).catch(() => {});
      }
      // Home's metric cards read from the same shared store — without this
      // they'd keep showing whatever was latest the last time Home mounted.
      refreshLatestVitals().catch(() => {});
    },
    [trendType, trendRange, refreshTrend, refreshLatestVitals, t],
  );

  const handleSaveBloodPressure = useCallback(async () => {
    const database = await initializeDatabase();
    const timestamp = new Date().toISOString();
    // Both readings share one timestamp — they're the same cuff reading, not two independent events.
    await database.vitals.record({ timestamp, type: 'BP_SYS', value: systolic, unit: 'mmHg', notes: null });
    await database.vitals.record({ timestamp, type: 'BP_DIA', value: diastolic, unit: 'mmHg', notes: null });
    triggerHaptic('notificationSuccess');
    setStatus(t('vitals.bloodPressureSaved'));
    if (trendType === 'BP_SYS' || trendType === 'BP_DIA') {
      refreshTrend(trendType, trendRange).catch(() => {});
    }
    refreshLatestVitals().catch(() => {});
  }, [systolic, diastolic, trendType, trendRange, refreshTrend, refreshLatestVitals, t]);

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor: theme.colors.canvas }}>
      <View className="border-b px-6 py-6" style={{ borderColor: theme.colors.hairline }}>
        <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
          {t('vitals.title')}
        </Text>
        {status ? (
          <Text className="mt-2 text-caption" style={{ color: theme.statusText('taken') }}>
            {status}
          </Text>
        ) : null}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-7 px-6 py-7" showsVerticalScrollIndicator={false}>
        <BloodPressureCard systolic={systolic} diastolic={diastolic} onChangeSystolic={setSystolic} onChangeDiastolic={setDiastolic} />
        <LargeTextButton label={t('vitals.saveBloodPressure')} variant="secondary" onPress={handleSaveBloodPressure} />

        <View className="gap-3">
          <View className="flex-row gap-3">
            {(['Fasting', 'Post-prandial'] as const).map((option) => {
              const isActive = glucoseContext === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setGlucoseContext(option)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  className="min-h-hit flex-1 items-center justify-center rounded-full border"
                  style={{ backgroundColor: isActive ? theme.action.base : theme.colors.elevated, borderColor: isActive ? theme.action.base : theme.colors.hairline }}
                >
                  <Text className="text-body-lg" style={{ color: isActive ? theme.action.ink : theme.colors.ink }}>
                    {t(GLUCOSE_CONTEXT_KEY[option])}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <VitalStepperCard label={t('vitals.bloodGlucose')} value={glucose} unit="mmol/L" step={0.1} min={1} max={30} decimals={1} onChange={setGlucose} />
          <LargeTextButton
            label={t('vitals.saveBloodGlucose')}
            variant="secondary"
            onPress={() => saveVital('BLOOD_SUGAR', glucose, 'mmol/L', glucoseContext, 'vitals.bloodGlucoseSaved')}
          />
        </View>

        <View className="gap-3">
          <VitalStepperCard label={t('vitals.bodyWeight')} value={weight} unit="kg" step={0.1} min={2} max={300} decimals={1} onChange={setWeight} />
          <LargeTextButton
            label={t('vitals.saveWeight')}
            variant="secondary"
            onPress={() => saveVital('WEIGHT', weight, 'kg', null, 'vitals.weightSaved')}
          />
        </View>

        <View className="gap-3">
          <VitalStepperCard
            label={t('vitals.bodyTemperature')}
            value={temperature}
            unit="°F"
            step={0.1}
            min={90}
            max={110}
            decimals={1}
            onChange={setTemperature}
          />
          <LargeTextButton
            label={t('vitals.saveTemperature')}
            variant="secondary"
            onPress={() => saveVital('TEMPERATURE', temperature, '°F', null, 'vitals.temperatureSaved')}
          />
        </View>

        <View className="gap-4">
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            {t('vitals.trend')}
          </Text>
          <View className="flex-row flex-wrap gap-2">
            {SPARKLINE_OPTIONS.map((option) => {
              const isActive = trendType === option.type;
              return (
                <Pressable
                  key={option.type}
                  onPress={() => setTrendType(option.type)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  className="min-h-hit items-center justify-center rounded-full border px-5"
                  style={{ backgroundColor: isActive ? theme.action.base : theme.colors.elevated, borderColor: isActive ? theme.action.base : theme.colors.hairline }}
                >
                  <Text className="text-caption" style={{ color: isActive ? theme.action.ink : theme.colors.ink, fontWeight: '600' }}>
                    {t(option.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="flex-row gap-2">
            {([7, 30] as const).map((range) => {
              const isActive = trendRange === range;
              return (
                <Pressable
                  key={range}
                  onPress={() => setTrendRange(range)}
                  accessibilityRole="button"
                  accessibilityState={{ selected: isActive }}
                  className="min-h-hit items-center justify-center rounded-full border px-5"
                  style={{ backgroundColor: isActive ? theme.colors.hairline : 'transparent', borderColor: theme.colors.hairline }}
                >
                  <Text className="text-caption" style={{ color: theme.colors.ink, fontWeight: '600' }}>
                    {range === 7 ? t('vitals.days7') : t('vitals.days30')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View
            onLayout={(event) => setCanvasWidth(event.nativeEvent.layout.width)}
            className="rounded-3xl border p-5"
            style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
          >
            {canvasWidth > 0 ? (
              <Sparkline
                points={trendPoints.map((vital) => ({ timestamp: vital.timestamp, value: vital.value }))}
                width={canvasWidth - 40}
                color={SPARKLINE_OPTIONS.find((option) => option.type === trendType)?.color}
                unit={SPARKLINE_OPTIONS.find((option) => option.type === trendType)?.unit}
              />
            ) : null}
          </View>
        </View>

        <View className="gap-4" style={{ paddingBottom: 32 }}>
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            {t('vitals.adverseSymptoms')}
          </Text>
          <LargeTextButton label={t('vitals.logASymptom')} onPress={() => symptomSheetRef.current?.present()} />
        </View>
      </ScrollView>

      <SymptomLogSheet ref={symptomSheetRef} />
    </SafeAreaView>
  );
}
