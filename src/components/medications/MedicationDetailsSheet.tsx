import {
  BottomSheetBackdrop,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';
import { CalendarDays, Camera, Clock3, History, ImagePlus, Package, Pill, X } from 'lucide-react-native';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import { initializeDatabase, type Medication, type Schedule } from '../../db';
import { runSentinelCheckForMedication } from '../../alarms/sentinel';
import { useTranslation } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { SkeletonBox, SkeletonCircle } from '../ui';
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

function formatStock(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, '').replace(/\.$/, '');
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
  const [stockDraft, setStockDraft] = useState('');
  const [stockError, setStockError] = useState(false);
  const [stockBusy, setStockBusy] = useState(false);
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

  // One tappable photo + a floating camera badge, rather than two permanent
  // "Take Photo"/"Choose Photo" buttons sitting under it always — Alert's
  // native action sheet is the same pattern this screen already uses for
  // "Remove medication" (see DrugLabScreen's remove confirm), so this isn't
  // a new interaction style, just this card catching up to it.
  const handleEditPhoto = useCallback(() => {
    if (!medication || photoBusy) return;
    Alert.alert(t('medications.photoActionTitle'), undefined, [
      { text: t('medications.takePhoto'), onPress: () => choosePhoto('camera') },
      { text: t('medications.choosePhoto'), onPress: () => choosePhoto('library') },
      ...(medication.photo_uri
        ? [{ text: t('medications.removePhoto'), style: 'destructive' as const, onPress: () => removePhoto() }]
        : []),
      { text: t('common.cancel'), style: 'cancel' as const },
    ]);
  }, [medication, photoBusy, t, choosePhoto, removePhoto]);

  const saveStock = useCallback(async () => {
    if (!medication || stockBusy) return;
    const units = Number(stockDraft.trim());
    if (!/^(?:\d+)(?:\.\d{1,2})?$/.test(stockDraft.trim()) || !Number.isFinite(units) || units < 0) {
      setStockError(true);
      return;
    }
    setStockBusy(true);
    setStockError(false);
    try {
      const database = await initializeDatabase();
      const updated = await database.medications.setStock(medication.id, units);
      setMedication(updated);
      setStockDraft(formatStock(updated.current_stock));
      onMedicationUpdated?.(updated);
      await runSentinelCheckForMedication(updated.id).catch((error: unknown) => {
        console.warn('[MedicationDetailsSheet] failed to refresh stock alert', error);
      });
      triggerHaptic('notificationSuccess');
    } catch {
      setStockError(true);
      triggerHaptic('notificationError');
    } finally {
      setStockBusy(false);
    }
  }, [medication, onMedicationUpdated, stockBusy, stockDraft]);

  useImperativeHandle(ref, () => ({
    present: (selected) => {
      modalRef.current?.present();
      setStockDraft(formatStock(Math.max(0, selected.current_stock)));
      setStockError(false);
      loadDetails(selected).catch(() => {
        setSchedules([]);
        triggerHaptic('notificationError');
      });
    },
  }), [loadDetails]);

  const FormIcon = medication?.form === 'tablet' || medication?.form === 'capsule' ? Pill : Package;

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={theme.mode === 'dark' ? 0.75 : 0.5}
        pressBehavior="close"
      />
    ),
    [theme.mode],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: theme.mode === 'dark' ? 1 : 0,
        borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.22)' : theme.colors.hairline,
        width: 36,
        height: 4.5,
        borderRadius: 3,
      }}
    >
      {medication ? (
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

          <View className="gap-2 rounded-3xl border p-4" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
            <Pressable
              onPress={handleEditPhoto}
              disabled={photoBusy}
              accessibilityRole="button"
              accessibilityLabel={t('medications.editPhotoAccessibility')}
            >
              <View
                className="overflow-hidden rounded-2xl"
                style={{
                  backgroundColor: theme.colors.surface,
                  borderWidth: medication.photo_uri ? 0 : 1.5,
                  borderStyle: 'dashed',
                  borderColor: theme.colors.hairline,
                }}
              >
                {medication.photo_uri ? (
                  <Image source={{ uri: medication.photo_uri }} className="h-40 w-full" resizeMode="cover" accessibilityLabel={t('medications.photoPreview')} />
                ) : (
                  <View className="h-36 items-center justify-center gap-2">
                    <View className="items-center justify-center rounded-full" style={{ width: 48, height: 48, backgroundColor: `${theme.action.base}14` }}>
                      <ImagePlus color={theme.action.base} size={24} strokeWidth={2.25} />
                    </View>
                    <Text className="text-body text-center font-semibold" style={{ color: theme.colors.ink }}>{t('medications.photoEmptyTitle')}</Text>
                    <Text className="text-caption text-center px-6" style={{ color: theme.colors.inkMuted }}>{t('medications.photoEmptyHint')}</Text>
                  </View>
                )}
                {photoBusy ? (
                  <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: `${theme.colors.canvas}CC` }}>
                    <ActivityIndicator color={theme.action.base} />
                  </View>
                ) : null}
              </View>
              {/* Floating edit badge — overlaps the preview's bottom-right corner like a
                  profile-photo editor, so changing an existing photo doesn't need its own
                  permanent row of buttons. Only once a photo exists: the empty dashed-box
                  state already has its own big centered icon + "Add a photo" text, so a
                  second camera badge there would be redundant — and sat right on top of
                  the hint text at some widths, cutting it off. */}
              {medication.photo_uri ? (
                <View
                  pointerEvents="none"
                  className="absolute items-center justify-center rounded-full"
                  style={{
                    right: 10,
                    bottom: 10,
                    width: 40,
                    height: 40,
                    backgroundColor: theme.action.base,
                    borderWidth: 3,
                    borderColor: theme.colors.elevated,
                  }}
                >
                  <Camera color={theme.action.ink} size={18} strokeWidth={2.25} />
                </View>
              ) : null}
            </Pressable>
            {photoError ? (
              <Text className="text-caption" style={{ color: theme.statusText('missed') }}>
                {t('medications.photoError')}
              </Text>
            ) : null}
          </View>

          <View className="flex-row gap-3">
            <View className="flex-1 gap-1 rounded-2xl border p-4" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
              <Package color={theme.colors.inkMuted} size={18} />
              <Text className="text-title-lg" style={{ color: theme.colors.ink }}>{formatStock(Math.max(0, medication.current_stock))}</Text>
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
              <Package color={theme.action.base} size={19} />
              <Text className="text-body-lg" style={{ color: theme.colors.ink, fontWeight: '700' }}>
                {t('medications.detailsStockLabel')}
              </Text>
              <Text className="ml-auto text-body-lg" style={{ color: medication.current_stock <= medication.refill_threshold ? theme.statusText('missed') : theme.colors.ink }}>
                {t('medications.detailsStockUnits', {
                  count: formatStock(Math.max(0, medication.current_stock)),
                  unit: medication.current_stock === 1 ? t('medications.detailsStockUnit') : t('medications.detailsStockUnitsPlural'),
                })}
              </Text>
            </View>
            <View className="flex-row items-center gap-3">
              <BottomSheetTextInput
                value={stockDraft}
                onChangeText={(value) => {
                  // Keeps digits and a decimal point — saveStock's own validation
                  // regex (/^(?:\d+)(?:\.\d{1,2})?$/) explicitly allows a fractional
                  // value (e.g. "12.5" units of syrup), which a digits-only filter
                  // made impossible to ever type.
                  setStockDraft(value.replace(/[^\d.]/g, ''));
                  setStockError(false);
                }}
                keyboardType="decimal-pad"
                placeholder={t('medications.detailsStockPlaceholder')}
                placeholderTextColor={theme.colors.inkMuted}
                accessibilityLabel={t('medications.detailsStockLabel')}
                className="min-h-hit flex-1 rounded-2xl border px-4 text-body-lg"
                style={{ backgroundColor: theme.colors.surface, borderColor: stockError ? theme.statusText('missed') : theme.colors.hairline, color: theme.colors.ink }}
              />
              <Pressable
                onPress={saveStock}
                disabled={stockBusy}
                accessibilityRole="button"
                className="min-h-hit rounded-2xl px-4 items-center justify-center"
                style={{ backgroundColor: theme.action.base, opacity: stockBusy ? 0.6 : 1 }}
              >
                {stockBusy ? <ActivityIndicator color={theme.action.ink} /> : <Text className="text-body" style={{ color: theme.action.ink, fontWeight: '700' }}>{t('medications.detailsStockSave')}</Text>}
              </Pressable>
            </View>
            {stockError ? <Text className="text-caption" style={{ color: theme.statusText('missed') }}>{t('medications.detailsStockInvalid')}</Text> : null}
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
            {loading ? (
              <View className="gap-2.5">
                {[1, 2].map((key) => (
                  <View
                    key={key}
                    className="flex-row items-center gap-3 rounded-2xl border p-4"
                    style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
                  >
                    <SkeletonCircle size={22} />
                    <SkeletonBox width="50%" height={16} borderRadius={5} />
                    <SkeletonBox width={50} height={16} borderRadius={8} style={{ marginLeft: 'auto' }} />
                  </View>
                ))}
              </View>
            ) : schedules.length === 0 ? (
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
      ) : null}
    </BottomSheetModal>
  );
});
