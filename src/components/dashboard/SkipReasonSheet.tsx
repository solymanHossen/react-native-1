import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { CalendarX, PackageX, Stethoscope, ThumbsUp, TriangleAlert, X, type LucideIcon } from 'lucide-react-native';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SKIP_REASONS, type DoseEntry, type SkipReason } from '../../dashboard/types';
import { useTranslation, type TranslationKey } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import type { StatusKey } from '../../theme/tokens';
import { useTheme } from '../../theme/useTheme';

const SKIP_REASON_KEY: Record<SkipReason, TranslationKey> = {
  'Feeling better': 'rhythm.skipSheet.reasons.Feeling better',
  'Side effects': 'rhythm.skipSheet.reasons.Side effects',
  'Forgot dose': 'rhythm.skipSheet.reasons.Forgot dose',
  'Out of stock': 'rhythm.skipSheet.reasons.Out of stock',
  'Doctor advised': 'rhythm.skipSheet.reasons.Doctor advised',
};

/** Icon + existing status-color token per reason — reusing the app's established hues (green/red/blue/teal) rather than inventing new ones, plus brand navy for the one reason that isn't a status color at all. */
const SKIP_REASON_ICON: Record<SkipReason, LucideIcon> = {
  'Feeling better': ThumbsUp,
  'Side effects': TriangleAlert,
  'Forgot dose': CalendarX,
  'Out of stock': PackageX,
  'Doctor advised': Stethoscope,
};

const SKIP_REASON_STATUS: Record<SkipReason, StatusKey | null> = {
  'Feeling better': 'taken',
  'Side effects': 'missed',
  'Forgot dose': 'pending',
  'Out of stock': 'fasting',
  'Doctor advised': null, // no status color fits "doctor advised" — falls back to brand navy below
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
  const snapPoints = useMemo(() => ['50%'], []);

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
        <View className="flex-row items-start justify-between gap-3 px-6 pb-4">
          <View className="flex-1 gap-1">
            <Text className="text-title-lg font-bold" style={{ color: theme.colors.ink }}>
              {t('rhythm.skipSheet.titlePrefix')}
              {dose?.medicationName ?? t('rhythm.skipSheet.titleFallback')}?
            </Text>
            <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
              {t('rhythm.skipSheet.subtitle')}
            </Text>
          </View>
          <Pressable
            onPress={() => modalRef.current?.dismiss()}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            className="min-h-hit min-w-hit items-center justify-center rounded-full"
            style={{ width: 32, height: 32, backgroundColor: theme.colors.elevated }}
          >
            <X color={theme.colors.inkSecondary} size={16} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View className="flex-row flex-wrap gap-3 px-6 pb-8">
          {SKIP_REASONS.map((reason) => {
            const Icon = SKIP_REASON_ICON[reason];
            const statusKey = SKIP_REASON_STATUS[reason];
            const iconColor = statusKey ? theme.statusText(statusKey) : theme.action.base;
            const iconBg = statusKey ? theme.statusTint(statusKey) : `${theme.action.base}18`;

            return (
              <Pressable
                key={reason}
                onPress={() => handleSelect(reason)}
                accessibilityRole="button"
                className="min-h-hit basis-[31%] items-center gap-2 rounded-2xl py-2"
              >
                <View
                  className="items-center justify-center rounded-full"
                  style={{ width: 48, height: 48, backgroundColor: iconBg }}
                >
                  <Icon color={iconColor} size={22} strokeWidth={2.25} />
                </View>
                <Text
                  numberOfLines={2}
                  className="text-caption font-medium"
                  style={{ color: theme.colors.ink, textAlign: 'center' }}
                >
                  {t(SKIP_REASON_KEY[reason])}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
