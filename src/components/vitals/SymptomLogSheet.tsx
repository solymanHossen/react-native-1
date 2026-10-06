import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { initializeDatabase } from '../../db';
import type { RecentIntakeContext, SymptomSeverity } from '../../db/types';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';
import { LargeTextButton } from '../ui';

const COMMON_SYMPTOMS = ['Nausea', 'Dizziness', 'Acid Reflux', 'Headache', 'Fatigue', 'Rash'];
const SEVERITIES: SymptomSeverity[] = ['MILD', 'MODERATE', 'SEVERE'];

export interface SymptomLogSheetRef {
  present: () => void;
}

/**
 * Rapid logging: tap a symptom chip, tap a severity, save — no free-text
 * required for the common case. "Automatic relational association" is
 * literal: saving immediately queries which medications were taken in the
 * trailing 4 hours and shows them back, rather than asking the person to
 * remember and type them in themselves.
 */
export const SymptomLogSheet = forwardRef<SymptomLogSheetRef, Record<string, unknown>>(function SymptomLogSheetImpl(_props, ref) {
  const theme = useTheme();
  const modalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['70%'], []);
  const [symptom, setSymptom] = useState<string | null>(null);
  const [severity, setSeverity] = useState<SymptomSeverity>('MILD');
  const [relatedMeds, setRelatedMeds] = useState<RecentIntakeContext[] | null>(null);
  const [saving, setSaving] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        setSymptom(null);
        setSeverity('MILD');
        setRelatedMeds(null);
        modalRef.current?.present();
      },
    }),
    [],
  );

  const handleSave = useCallback(async () => {
    if (!symptom) return;
    setSaving(true);
    try {
      const database = await initializeDatabase();
      const timestamp = new Date().toISOString();
      await database.symptoms.record({ timestamp, symptom, severity, notes: null });
      const recent = await database.symptoms.listRecentIntakesAround(timestamp);
      setRelatedMeds(recent);
      triggerHaptic('notificationSuccess');
    } finally {
      setSaving(false);
    }
  }, [symptom, severity]);

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.hairline }}
    >
      <BottomSheetView style={{ flex: 1 }}>
        <View className="gap-1 px-6 pb-4">
          <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
            Log a Symptom
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
            Tap what you're feeling — we'll check which medications you took in the last 4 hours.
          </Text>
        </View>

        {relatedMeds === null ? (
          <View className="gap-6 px-6">
            <View className="flex-row flex-wrap gap-3">
              {COMMON_SYMPTOMS.map((option) => {
                const isActive = symptom === option;
                return (
                  <Pressable
                    key={option}
                    onPress={() => setSymptom(option)}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    className="min-h-hit items-center justify-center rounded-full border px-6"
                    style={{
                      backgroundColor: isActive ? theme.action.base : theme.colors.elevated,
                      borderColor: isActive ? theme.action.base : theme.colors.hairline,
                    }}
                  >
                    <Text className="text-body-lg" style={{ color: isActive ? theme.action.ink : theme.colors.ink }}>
                      {option}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View className="gap-3">
              <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                Severity
              </Text>
              <View className="flex-row gap-3">
                {SEVERITIES.map((level) => {
                  const isActive = severity === level;
                  return (
                    <Pressable
                      key={level}
                      onPress={() => setSeverity(level)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      className="min-h-hit flex-1 items-center justify-center rounded-full border"
                      style={{
                        backgroundColor: isActive ? theme.action.base : theme.colors.elevated,
                        borderColor: isActive ? theme.action.base : theme.colors.hairline,
                      }}
                    >
                      <Text className="text-body-lg" style={{ color: isActive ? theme.action.ink : theme.colors.ink }}>
                        {level.charAt(0) + level.slice(1).toLowerCase()}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <LargeTextButton label="Save Symptom" onPress={handleSave} disabled={!symptom} loading={saving} />
          </View>
        ) : (
          <View className="gap-4 px-6">
            <Text className="text-body-lg" style={{ color: theme.colors.ink, fontWeight: '600' }}>
              {relatedMeds.length === 0 ? 'Logged. No medications were taken in the last 4 hours.' : 'Logged. Taken in the last 4 hours:'}
            </Text>
            {relatedMeds.map((med, index) => (
              <View
                key={`${med.medicationName}-${index}`}
                className="rounded-2xl border p-4"
                style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
              >
                <Text className="text-body-lg" style={{ color: theme.colors.ink }}>
                  {med.medicationName}
                </Text>
                <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                  Taken at {new Date(med.takenTime).toLocaleTimeString()}
                </Text>
              </View>
            ))}
            <LargeTextButton label="Done" variant="secondary" onPress={() => modalRef.current?.dismiss()} />
          </View>
        )}
      </BottomSheetView>
    </BottomSheetModal>
  );
});
