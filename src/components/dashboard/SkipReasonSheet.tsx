import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SKIP_REASONS, type DoseEntry, type SkipReason } from '../../dashboard/types';
import { useTranslation, type TranslationKey } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

const SKIP_REASON_KEY: Record<SkipReason, TranslationKey> = {
  'Feeling better': 'rhythm.skipSheet.reasons.Feeling better',
  'Side effects': 'rhythm.skipSheet.reasons.Side effects',
  'Forgot dose': 'rhythm.skipSheet.reasons.Forgot dose',
  'Out of stock': 'rhythm.skipSheet.reasons.Out of stock',
  'Doctor advised': 'rhythm.skipSheet.reasons.Doctor advised',
};

export interface SkipReasonSheetRef {
  present: (dose: DoseEntry) => void;
  dismiss: () => void;
}

export interface SkipReasonSheetProps {
  onSelectReason: (doseId: string, reason: SkipReason) => void;
}

/** Opened by DoseActionCard's left-swipe — a skip is never committed from the gesture alone, it needs a reason first. */
export const SkipReasonSheet = forwardRef<SkipReasonSheetRef, SkipReasonSheetProps>(function SkipReasonSheetImpl(
  { onSelectReason },
  ref,
) {
  const theme = useTheme();
  const { t } = useTranslation();
  const modalRef = useRef<BottomSheetModal>(null);
  const [dose, setDose] = useState<DoseEntry | null>(null);
  const snapPoints = useMemo(() => ['45%'], []);

  useImperativeHandle(
    ref,
    () => ({
      present: (nextDose) => {
        setDose(nextDose);
        modalRef.current?.present();
      },
      dismiss: () => modalRef.current?.dismiss(),
    }),
    [],
  );

  const handleSelect = useCallback(
    (reason: SkipReason) => {
      if (!dose) return;
      triggerHaptic('impactMedium');
      onSelectReason(dose.id, reason);
      modalRef.current?.dismiss();
    },
    [dose, onSelectReason],
  );

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
            {t('rhythm.skipSheet.titlePrefix')}
            {dose?.medicationName ?? t('rhythm.skipSheet.titleFallback')}?
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
            {t('rhythm.skipSheet.subtitle')}
          </Text>
        </View>
        <View className="gap-3 px-6 pb-8">
          {SKIP_REASONS.map((reason) => (
            <Pressable
              key={reason}
              onPress={() => handleSelect(reason)}
              accessibilityRole="button"
              className="min-h-hit justify-center rounded-2xl border px-5"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
            >
              <Text className="text-body-lg" style={{ color: theme.colors.ink }}>
                {t(SKIP_REASON_KEY[reason])}
              </Text>
            </Pressable>
          ))}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
