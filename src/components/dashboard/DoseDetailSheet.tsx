import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { AlertTriangle, Pill } from 'lucide-react-native';
import { forwardRef, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import type { DoseEntry } from '../../dashboard/types';
import { useTheme } from '../../theme/useTheme';

export interface DoseDetailSheetRef {
  present: (dose: DoseEntry) => void;
  dismiss: () => void;
}

const LOW_STOCK_THRESHOLD = 7;

/** Opened by DoseActionCard's long-press — read-only reference info, no actions to take here. */
export const DoseDetailSheet = forwardRef<DoseDetailSheetRef, Record<string, unknown>>(function DoseDetailSheetImpl(_props, ref) {
  const theme = useTheme();
  const modalRef = useRef<BottomSheetModal>(null);
  const [dose, setDose] = useState<DoseEntry | null>(null);
  const snapPoints = useMemo(() => ['55%'], []);

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

  const isLowStock = (dose?.stockRemaining ?? Infinity) <= LOW_STOCK_THRESHOLD;

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.hairline }}
    >
      <BottomSheetView style={{ flex: 1 }}>
        <View className="gap-6 px-6 pb-8">
          {/* No real package photography exists for the demo regimen — an
              icon placeholder is honest about that, rather than faking a
              product photo. */}
          <View
            className="h-28 w-28 items-center justify-center self-center rounded-3xl border"
            style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
          >
            <Pill color={theme.action.base} size={44} strokeWidth={1.75} />
          </View>

          <View className="items-center gap-1">
            <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
              {dose?.medicationName ?? ''}
            </Text>
            <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
              {dose?.dosage} · {dose?.label} ({dose?.labelBn})
            </Text>
          </View>

          <View className="gap-2 rounded-3xl border p-5" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
            <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
              Interactions
            </Text>
            <Text className="text-body-lg" style={{ color: theme.colors.ink }}>
              {dose?.interactionNote}
            </Text>
          </View>

          <View
            className="flex-row items-center gap-3 rounded-3xl border p-5"
            style={{
              backgroundColor: isLowStock ? theme.statusTint('missed') : theme.colors.elevated,
              borderColor: isLowStock ? `${theme.status.missed.base}55` : theme.colors.hairline,
            }}
          >
            {isLowStock ? <AlertTriangle color={theme.statusText('missed')} size={22} /> : null}
            <View className="flex-1">
              <Text className="text-caption uppercase tracking-wider" style={{ color: isLowStock ? theme.statusText('missed') : theme.colors.inkSecondary }}>
                Stock Remaining
              </Text>
              <Text className="text-body-lg" style={{ color: isLowStock ? theme.statusText('missed') : theme.colors.ink, fontWeight: '600' }}>
                {dose?.stockRemaining} tablet{dose?.stockRemaining === 1 ? '' : 's'}
                {isLowStock ? ' — refill soon' : ''}
              </Text>
            </View>
          </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
