import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { CheckCircle2, Clock3, History, XCircle } from 'lucide-react-native';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { initializeDatabase, type MedicationHistoryItem } from '../../db';
import { useTranslation } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

export interface MedicationHistorySheetRef {
  present: () => void;
}

function formatDateTime(iso: string): string {
  const date = new Date(iso);
  return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })} · ${date.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  })}`;
}

function HistoryRow({ item }: { item: MedicationHistoryItem }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isTaken = item.status === 'TAKEN';
  const isMissed = item.status === 'MISSED';
  const color = isTaken ? theme.statusText('taken') : isMissed ? theme.statusText('missed') : theme.statusText('pending');
  const Icon = isTaken ? CheckCircle2 : isMissed ? XCircle : Clock3;
  const statusLabel = isTaken ? t('status.taken') : isMissed ? t('status.missed') : t('status.pending');

  return (
    <View className="flex-row gap-3">
      <View className="items-center">
        <View className="items-center justify-center rounded-full" style={{ width: 34, height: 34, backgroundColor: `${color}18` }}>
          <Icon color={color} size={18} strokeWidth={2.25} />
        </View>
        <View className="mt-1 w-px flex-1" style={{ backgroundColor: theme.colors.hairline }} />
      </View>
      <View className="flex-1 gap-1 pb-5">
        <View className="flex-row items-start justify-between gap-3">
          <Text className="flex-1 text-body-lg" style={{ color: theme.colors.ink, fontWeight: '700' }}>
            {item.medication_strength ? `${item.medication_name} · ${item.medication_strength}` : item.medication_name}
          </Text>
          <Text className="text-caption" style={{ color }}>
            {statusLabel}
          </Text>
        </View>
        <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
          {formatDateTime(item.taken_time ?? item.scheduled_time)}
        </Text>
        <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
          {t('medications.historyScheduledFor', { time: item.time_node.toLowerCase() })}
        </Text>
      </View>
    </View>
  );
}

export const MedicationHistorySheet = forwardRef<MedicationHistorySheetRef>(function MedicationHistorySheetImpl(_props, ref) {
  const theme = useTheme();
  const { t } = useTranslation();
  const modalRef = useRef<BottomSheetModal>(null);
  const [items, setItems] = useState<MedicationHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);

  const snapPoints = useMemo(() => ['88%'], []);
  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const database = await initializeDatabase();
      setItems(await database.intakeLogs.listMedicationHistory());
    } finally {
      setLoading(false);
    }
  }, []);

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        modalRef.current?.present();
        loadHistory().catch(() => {
          setItems([]);
          triggerHaptic('notificationError');
        });
      },
    }),
    [loadHistory],
  );

  const taken = items.filter((item) => item.status === 'TAKEN').length;
  const missed = items.filter((item) => item.status === 'MISSED').length;
  const tracked = taken + missed;
  const adherence = tracked === 0 ? 0 : Math.round((taken / tracked) * 100);

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.hairline }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 32 }} showsVerticalScrollIndicator={false}>
        <View className="gap-1 px-6 pb-5">
          <View className="flex-row items-center gap-3">
            <View className="items-center justify-center rounded-2xl" style={{ width: 44, height: 44, backgroundColor: `${theme.action.base}18` }}>
              <History color={theme.action.base} size={23} strokeWidth={2.25} />
            </View>
            <View className="flex-1">
              <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
                {t('medications.historyTitle')}
              </Text>
              <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                {t('medications.historySubtitle')}
              </Text>
            </View>
          </View>
        </View>

        <View className="mx-6 mb-6 flex-row gap-3">
          {[
            [String(adherence), t('medications.historyAdherence')],
            [String(taken), t('medications.historyTaken')],
            [String(missed), t('medications.historyMissed')],
          ].map(([value, label]) => (
            <View key={label} className="flex-1 gap-1 rounded-2xl border p-4" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
              <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
                {value}{label === t('medications.historyAdherence') ? '%' : ''}
              </Text>
              <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                {label}
              </Text>
            </View>
          ))}
        </View>

        <View className="border-t px-6 pt-6" style={{ borderColor: theme.colors.hairline }}>
          <Text className="mb-4 text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            {t('medications.historyTimeline')}
          </Text>
          {loading ? (
            <View className="items-center py-10">
              <ActivityIndicator color={theme.action.base} />
            </View>
          ) : items.length === 0 ? (
            <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
              {t('medications.historyEmpty')}
            </Text>
          ) : (
            items.map((item) => <HistoryRow key={item.id} item={item} />)
          )}
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
