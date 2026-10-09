import { BottomSheetModal, BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { CalendarDays, Clock3, History, Package, Pill, X } from 'lucide-react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { initializeDatabase, type Medication, type Schedule } from '../../db';
import { useTranslation } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

export interface MedicationDetailsSheetRef {
  present: (medication: Medication) => void;
}

interface MedicationDetailsSheetProps {
  onMedicationUpdated?: (medication: Medication) => void;
}

function formatSchedule(schedule: Schedule): string {
  return `${schedule.time_utc} · ${schedule.dose_quantity} ${schedule.dose_quantity === 1 ? 'dose' : 'doses'}`;
}

export const MedicationDetailsSheet = forwardRef<MedicationDetailsSheetRef, MedicationDetailsSheetProps>(function MedicationDetailsSheetImpl(
  { onMedicationUpdated },
  ref,
) {
  const theme = useTheme();
  const { t } = useTranslation();
  const modalRef = useRef<BottomSheetModal>(null);
  const [medication, setMedication] = useState<Medication | null>(null);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState(false);
  const snapPoints = useMemo(() => ['78%'], []);

  const loadDetails = useCallback(async (selected: Medication) => {
    setMedication(selected);
    setLoading(true);
    try {
      const database = await initializeDatabase();
      setSchedules(await database.schedules.listForMedication(selected.id));
    } catch {
      setSchedules([]);
      triggerHaptic('notificationError');
    } finally {
      setLoading(false);
    }
  }, []);

  const choosePhoto = useCallback(async (source: 'camera' | 'library') => {
    if (!medication || photoBusy) return;
    setPhotoBusy(true);
    setPhotoError(false);
    try {
      const result =
        source === 'camera'
          ? await launchCamera({ mediaType: 'photo', cameraType: 'back', quality: 0.8, saveToPhotos: false })
          : await launchImageLibrary({ mediaType: 'photo', quality: 0.8, selectionLimit: 1 });
      const uri = result.assets?.[0]?.uri;
      if (!uri || result.didCancel) return;
      const database = await initializeDatabase();
      const updated = await database.medications.updatePhoto(medication.id, uri);
      setMedication(updated);
      onMedicationUpdated?.(updated);
      triggerHaptic('notificationSuccess');
    } catch {
      setPhotoError(true);
      triggerHaptic('notificationError');
    } finally {
      setPhotoBusy(false);
    }
  }, [medication, onMedicationUpdated, photoBusy]);

  const removePhoto = useCallback(async () => {
    if (!medication || photoBusy || !medication.photo_uri) return;
    setPhotoBusy(true);
    setPhotoError(false);
    try {
      const database = await initializeDatabase();
      const updated = await database.medications.updatePhoto(medication.id, null);
      setMedication(updated);
      onMedicationUpdated?.(updated);
      triggerHaptic('notificationSuccess');
    } catch {
      setPhotoError(true);
      triggerHaptic('notificationError');
    } finally {
      setPhotoBusy(false);
    }
  }, [medication, onMedicationUpdated, photoBusy]);

  useImperativeHandle(ref, () => ({
    present: (selected) => {
      modalRef.current?.present();
      loadDetails(selected).catch(() => {
        setSchedules([]);
        triggerHaptic('notificationError');
      });
    },
  }), [loadDetails]);

  if (!medication) return null;
  const FormIcon = medication.form === 'tablet' || medication.form === 'capsule' ? Pill : Package;

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.hairline }}
    >
      <BottomSheetScrollView contentContainerStyle={{ paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        <View className="gap-5 px-6">
          <View className="flex-row items-start gap-4">
            <View className="items-center justify-center rounded-2xl" style={{ width: 52, height: 52, backgroundColor: `${theme.action.base}18` }}>
              <FormIcon color={theme.action.base} size={26} strokeWidth={2.25} />
            </View>

            <View className="flex-1 gap-1">
              <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
                {medication.name}
              </Text>
              <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
                {[medication.strength, t(`medications.forms.${medication.form}` as never)].filter(Boolean).join(' · ')}
              </Text>
            </View>
            <Pressable onPress={() => modalRef.current?.dismiss()} accessibilityRole="button" accessibilityLabel={t('medications.detailsClose')} className="min-h-hit min-w-hit items-center justify-center">
              <X color={theme.colors.inkMuted} size={22} />
            </Pressable>
          </View>

          <View className="gap-3 rounded-3xl border p-4" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
              <View className="overflow-hidden rounded-2xl" style={{ backgroundColor: theme.colors.surface }}>
                {medication.photo_uri ? (
                  <Image source={{ uri: medication.photo_uri }} className="h-36 w-full" resizeMode="cover" accessibilityLabel={t('medications.photoPreview')} />
                ) : (
                  <View className="h-28 items-center justify-center">
                    <Pill color={theme.colors.inkMuted} size={30} />
                    <Text className="mt-2 text-caption" style={{ color: theme.colors.inkMuted }}>{t('medications.photoEmpty')}</Text>
                  </View>
                )}
                {photoBusy ? (
                  <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: `${theme.colors.canvas}CC` }}>
                    <ActivityIndicator color={theme.action.base} />
                  </View>
                ) : null}
              </View>
              <View className="flex-row gap-3">
                <Pressable onPress={() => choosePhoto('camera')} disabled={photoBusy} accessibilityRole="button" className="min-h-hit flex-1 items-center justify-center rounded-2xl" style={{ backgroundColor: theme.action.base }}>
                  <Text className="text-body" style={{ color: theme.action.ink, fontWeight: '700' }}>{t('medications.takePhoto')}</Text>
                </Pressable>
                <Pressable onPress={() => choosePhoto('library')} disabled={photoBusy} accessibilityRole="button" className="min-h-hit flex-1 items-center justify-center rounded-2xl border" style={{ borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface }}>
                  <Text className="text-body" style={{ color: theme.colors.ink, fontWeight: '700' }}>{t('medications.choosePhoto')}</Text>
                </Pressable>
              </View>
              {medication.photo_uri ? (
                <Pressable onPress={removePhoto} disabled={photoBusy} accessibilityRole="button" className="items-center py-1">
                  <Text className="text-caption" style={{ color: theme.statusText('missed') }}>{t('medications.removePhoto')}</Text>
                </Pressable>
              ) : null}
              {photoError ? (
                <Text className="text-caption" style={{ color: theme.statusText('missed') }}>
                  {t('medications.photoError')}
                </Text>
              ) : null}
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-1 rounded-2xl border p-4" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
              <Package color={theme.colors.inkMuted} size={18} />
              <Text className="text-title-lg" style={{ color: theme.colors.ink }}>{medication.current_stock}</Text>
              <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>{t('medications.detailsStock')}</Text>
            </View>
            <View className="flex-1 gap-1 rounded-2xl border p-4" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
              <Clock3 color={theme.colors.inkMuted} size={18} />
              <Text className="text-title-lg" style={{ color: theme.colors.ink }}>{schedules.length}</Text>
              <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>{t('medications.detailsSchedules')}</Text>
            </View>
          </View>

          <View className="gap-3 rounded-2xl border p-4" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
            <View className="flex-row items-center gap-2">
              <CalendarDays color={theme.action.base} size={19} />
              <Text className="text-body-lg" style={{ color: theme.colors.ink, fontWeight: '700' }}>{t('medications.detailsCourse')}</Text>
            </View>
            <Text className="text-body" style={{ color: theme.colors.inkSecondary }}>
              {medication.course_start_date && medication.course_end_date
                ? t('medications.detailsCourseRange', { start: medication.course_start_date, end: medication.course_end_date })
                : t('medications.detailsOngoing')}
            </Text>
          </View>

          <View className="gap-3">
            <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>{t('medications.detailsScheduleTitle')}</Text>
            {loading ? <ActivityIndicator color={theme.action.base} /> : schedules.length === 0 ? (
              <Text className="text-body" style={{ color: theme.colors.inkSecondary }}>{t('medications.detailsNoSchedules')}</Text>
            ) : schedules.map((schedule) => (
              <View key={schedule.id} className="flex-row items-center gap-3 rounded-2xl border p-4" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
                <Clock3 color={theme.action.base} size={19} />
                <Text className="text-body-lg" style={{ color: theme.colors.ink }}>{formatSchedule(schedule)}</Text>
                <Text className="ml-auto text-caption" style={{ color: schedule.is_active ? theme.statusText('taken') : theme.colors.inkMuted }}>
                  {schedule.is_active ? t('medications.detailsActive') : t('medications.detailsPaused')}
                </Text>
              </View>
            ))}
          </View>

          <View className="flex-row items-center gap-3 rounded-2xl border p-4" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
            <History color={theme.action.base} size={20} />
            <Text className="flex-1 text-body" style={{ color: theme.colors.inkSecondary }}>{t('medications.detailsHistoryHint')}</Text>
          </View>
        </View>
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
