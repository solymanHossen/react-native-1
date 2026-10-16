import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
} from '@gorhom/bottom-sheet';
import { ArrowLeft, Bell, CircleCheck, Pencil, Search, ShieldCheck } from 'lucide-react-native';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Image, Keyboard, Pressable, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DOSAGE_FORM_ASSETS } from '../dashboard';
import type { Medication } from '../../db/types';
import { useTranslation, type TranslationKey } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';
import { LargeTextButton } from '../ui';
import { CourseDateFields } from './CourseDateFields';

const FORMS: Medication['form'][] = ['tablet', 'capsule', 'syrup', 'drop', 'injection'];

const FORM_LABEL_KEY: Record<Medication['form'], TranslationKey> = {
  tablet: 'medications.forms.tablet',
  capsule: 'medications.forms.capsule',
  syrup: 'medications.forms.syrup',
  drop: 'medications.forms.drop',
  injection: 'medications.forms.injection',
};

type Step = 'details' | 'review' | 'added';

export interface ManualMedicationInput {
  name: string;
  strength: string | null;
  form: Medication['form'];
  courseStartDate: string | null;
  courseEndDate: string | null;
  /** Whether to also create a default daily reminder for this medication — see the "Set a Reminder" toggle on the review step. */
  setReminder: boolean;
}

export interface ManualMedicationSaveResult {
  ok: boolean;
  /** Only meaningful when `ok` is false — lets the review step show "already added" inline instead of silently failing. */
  reason?: 'duplicate';
}

export interface ManualMedicationSheetRef {
  /** `prefillName` carries over whatever was already typed into the search box, so re-typing isn't needed when search comes up empty. */
  present: (prefillName?: string) => void;
}

export interface ManualMedicationSheetProps {
  onSave: (input: ManualMedicationInput) => Promise<ManualMedicationSaveResult>;
}


function FormPicker({ value, onChange }: { value: Medication['form']; onChange: (form: Medication['form']) => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.mode === 'dark';

  return (
    <View className="flex-row flex-wrap gap-3">
      {FORMS.map((option) => {
        const isActive = value === option;
        const colors = theme.formColor(option);
        return (
          <Pressable
            key={option}
            onPress={() => onChange(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            className="min-h-hit flex-row items-center gap-2.5 rounded-2xl border px-4 py-3"
            style={{
              width: '47%',
              backgroundColor: isActive
                ? isDark
                  ? '#1E2D4A'
                  : colors.badgeBg
                : theme.colors.elevated,
              borderColor: isActive ? colors.iconColor : theme.colors.hairline,
              borderWidth: isActive ? 1.5 : 1,
            }}
          >
            <View
              className="items-center justify-center rounded-xl"
              style={{
                width: 36,
                height: 36,
                backgroundColor: isActive
                  ? isDark
                    ? '#131B2E'
                    : theme.colors.surface
                  : isDark
                    ? '#25334D'
                    : colors.badgeBg,
              }}
            >
              <Image source={DOSAGE_FORM_ASSETS[option]} style={{ width: 24, height: 24 }} resizeMode="contain" />
            </View>
            <Text className="flex-1 text-body font-semibold" numberOfLines={1} style={{ color: isActive ? colors.iconColor : theme.colors.ink }}>
              {t(FORM_LABEL_KEY[option])}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  const theme = useTheme();
  return (
    <View className="flex-row items-center justify-between gap-3 py-2.5">
      <Text className="text-body" style={{ color: theme.colors.inkSecondary }}>
        {label}
      </Text>
      <Text className="text-body font-semibold" numberOfLines={1} style={{ color: theme.colors.ink }}>
        {value}
      </Text>
    </View>
  );
}

/**
 * Fallback for the on-device drug directory's real gap: it's an 8-drug demo
 * dataset (see src/db/seed-data), so most real medications won't turn up in
 * search, and OCR scanning a prescription isn't always possible either
 * (no prescription in hand, poor lighting, a damaged pack). Without this,
 * such a medication would have no way into the app at all. Collects just
 * enough to be useful (name, optional strength, form) and defers everything
 * else (stock, refill threshold) to the same defaults DrugLabScreen's
 * search-add path already uses — this is a deliberate "I'm starting this
 * medication" entry, same intent as search-add, just typed instead of
 * searched, not an uncertain OCR guess.
 *
 * A 3-step wizard (Enter Details → Review → Added) rather than one long
 * form: the review step is what lets "Clear all" and "Edit" exist at all,
 * and it's where the reminder toggle lives, since offering to schedule a
 * reminder only makes sense once the medication itself is fully specified.
 */
export const ManualMedicationSheet = forwardRef<ManualMedicationSheetRef, ManualMedicationSheetProps>(
  function ManualMedicationSheetImpl({ onSave }, ref) {
    const theme = useTheme();
    const { t } = useTranslation();
    const insets = useSafeAreaInsets();
    const modalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['92%'], []);
    const bottomPadding = Math.max(insets.bottom, 16) + 24;
    const [step, setStep] = useState<Step>('details');
    const [name, setName] = useState('');
    const [strength, setStrength] = useState('');
    const [form, setForm] = useState<Medication['form']>('tablet');
    const [courseStartDate, setCourseStartDate] = useState('');
    const [courseEndDate, setCourseEndDate] = useState('');
    const [ongoing, setOngoing] = useState(false);
    const [setReminder, setSetReminder] = useState(true);
    const [dateError, setDateError] = useState(false);
    const [duplicateError, setDuplicateError] = useState(false);
    const [saving, setSaving] = useState(false);

    const resetFields = useCallback((prefillName?: string) => {
      setName(prefillName ?? '');
      setStrength('');
      setForm('tablet');
      setCourseStartDate('');
      setCourseEndDate('');
      setOngoing(false);
      setSetReminder(true);
      setDateError(false);
      setDuplicateError(false);
      setSaving(false);
    }, []);

    useImperativeHandle(
      ref,
      () => ({
        present: (prefillName) => {
          resetFields(prefillName);
          setStep('details');
          modalRef.current?.present();
        },
      }),
      [resetFields],
    );

    const handleContinue = useCallback(() => {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      const start = courseStartDate.trim();
      const end = ongoing ? '' : courseEndDate.trim();
      const hasValidDates =
        (!start && !end) ||
        (!!start && !!end && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end);
      if (!hasValidDates) {
        setDateError(true);
        return;
      }
      setDateError(false);
      Keyboard.dismiss();
      triggerHaptic('selection');
      setStep('review');
    }, [courseEndDate, courseStartDate, name, ongoing]);

    const handleClearAll = useCallback(() => {
      triggerHaptic('impactLight');
      resetFields();
      setStep('details');
    }, [resetFields]);

    const handleConfirmAdd = useCallback(async () => {
      setSaving(true);
      setDuplicateError(false);
      const result = await onSave({
        name: name.trim(),
        strength: strength.trim() || null,
        form,
        courseStartDate: ongoing ? null : courseStartDate.trim() || null,
        courseEndDate: ongoing ? null : courseEndDate.trim() || null,
        setReminder,
      });
      setSaving(false);
      if (!result.ok) {
        if (result.reason === 'duplicate') {
          triggerHaptic('notificationWarning');
          setDuplicateError(true);
        }
        return;
      }
      triggerHaptic('notificationSuccess');
      setStep('added');
    }, [courseEndDate, courseStartDate, form, name, ongoing, onSave, setReminder, strength]);

    const handleBack = useCallback(() => {
      if (step === 'review') {
        setStep('details');
        return;
      }
      modalRef.current?.dismiss();
    }, [step]);

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

    const ongoingLabel = ongoing ? t('medications.manualSheet.reviewOngoingYes') : t('medications.manualSheet.reviewOngoingNo');

    return (
      <BottomSheetModal
        ref={modalRef}
        snapPoints={snapPoints}
        enablePanDownToClose
        enableBlurKeyboardOnGesture
        keyboardBehavior="interactive"
        keyboardBlurBehavior="restore"
        android_keyboardInputMode="adjustResize"
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
        {step !== 'added' ? (
          <View className="flex-row items-center justify-between px-6 pb-2">
            <Pressable
              onPress={handleBack}
              accessibilityRole="button"
              accessibilityLabel={t('medications.manualSheet.backAccessibility')}
              hitSlop={10}
              className="min-h-hit min-w-hit items-center justify-center"
            >
              <ArrowLeft color={theme.colors.ink} size={24} strokeWidth={2.25} />
            </Pressable>
            <Pressable
              onPress={step === 'details' ? () => modalRef.current?.dismiss() : handleClearAll}
              accessibilityRole="button"
              hitSlop={10}
              className="min-h-hit items-center justify-center px-1"
            >
              <Text className="text-body font-semibold" style={{ color: step === 'details' ? theme.action.base : theme.statusText('missed') }}>
                {step === 'details' ? t('medications.manualSheet.addLater') : t('medications.manualSheet.clearAll')}
              </Text>
            </Pressable>
          </View>
        ) : null}

        <BottomSheetScrollView
          contentContainerStyle={{ paddingBottom: bottomPadding }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          <View className="gap-1 px-6 pb-4">
            <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
              {t('medications.manualSheet.title')}
            </Text>
            <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
              {step === 'review' ? t('medications.manualSheet.reviewSubtitle') : t('medications.manualSheet.subtitle')}
            </Text>
          </View>

          {step === 'details' ? (
            <View className="gap-4 px-6">
              <View
                className="flex-row items-center gap-3 rounded-2xl p-4"
                style={{
                  backgroundColor: theme.mode === 'dark' ? 'rgba(16, 185, 129, 0.16)' : '#DCFCE7',
                  borderWidth: 1,
                  borderColor: theme.mode === 'dark' ? 'rgba(52, 211, 153, 0.28)' : '#86EFAC',
                }}
              >
                <ShieldCheck color={theme.mode === 'dark' ? '#34D399' : '#16A34A'} size={22} strokeWidth={2.25} />
                <View className="flex-1 gap-0.5">
                  <Text className="text-body font-bold" style={{ color: theme.mode === 'dark' ? '#34D399' : '#16A34A' }}>
                    {t('medications.manualSheet.keepTrackTitle')}
                  </Text>
                  <Text className="text-caption" style={{ color: theme.mode === 'dark' ? '#34D399' : '#16A34A' }}>
                    {t('medications.manualSheet.keepTrackBody')}
                  </Text>
                </View>
              </View>

              <View className="gap-2">
                <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                  {t('medications.manualSheet.nameLabel')}
                </Text>
                <View
                  className="min-h-hit flex-row items-center gap-2 rounded-2xl border px-4"
                  style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
                >
                  <Search color={theme.colors.inkMuted} size={18} />
                  <BottomSheetTextInput
                    value={name}
                    onChangeText={setName}
                    placeholder={t('medications.manualSheet.namePlaceholder')}
                    placeholderTextColor={theme.colors.inkMuted}
                    className="flex-1 text-body-lg"
                    style={{ color: theme.colors.ink }}
                  />
                </View>
                <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
                  {t('medications.manualSheet.nameHint')}
                </Text>
              </View>

              <View className="gap-2">
                <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                  {t('medications.manualSheet.strengthLabel')}
                </Text>
                <BottomSheetTextInput
                  value={strength}
                  onChangeText={setStrength}
                  placeholder={t('medications.manualSheet.strengthPlaceholder')}
                  placeholderTextColor={theme.colors.inkMuted}
                  className="min-h-hit rounded-2xl border px-4 text-body-lg"
                  style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
                />
              </View>

              <View className="gap-3">
                <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                  {t('medications.manualSheet.formLabel')}
                </Text>
                <FormPicker value={form} onChange={setForm} />
              </View>

              <CourseDateFields
                label={t('medications.manualSheet.courseDatesLabel')}
                startDate={courseStartDate || null}
                endDate={ongoing ? null : courseEndDate || null}
                startPlaceholder={t('medications.manualSheet.startDatePlaceholder')}
                endPlaceholder={t('medications.manualSheet.endDatePlaceholder')}
                startAccessibility={t('medications.manualSheet.startDateAccessibility')}
                endAccessibility={t('medications.manualSheet.endDateAccessibility')}
                clearAccessibility={(dateLabel) => t('medications.manualSheet.clearDateAccessibility', { date: dateLabel })}
                hint={t('medications.manualSheet.courseDatesHint')}
                error={dateError ? t('medications.manualSheet.invalidDates') : undefined}
                onChange={(dates) => {
                  if (dates.startDate !== undefined) setCourseStartDate(dates.startDate ?? '');
                  if (dates.endDate !== undefined) setCourseEndDate(dates.endDate ?? '');
                  setDateError(false);
                }}
              />

              <Pressable
                onPress={() => {
                  triggerHaptic('selection');
                  setOngoing((prev) => !prev);
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: ongoing }}
                className="min-h-hit flex-row items-center justify-between gap-3 rounded-2xl border px-4 py-3.5"
                style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
              >
                <Text className="flex-1 text-body font-medium" style={{ color: theme.colors.ink }}>
                  {t('medications.manualSheet.ongoingToggle')}
                </Text>
                <Switch
                  value={ongoing}
                  onValueChange={setOngoing}
                  trackColor={{ false: theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#E2E8F0', true: theme.action.base }}
                  thumbColor="#FFFFFF"
                />
              </Pressable>

              <View style={{ marginTop: 8, marginBottom: 8 }}>
                <LargeTextButton label={t('medications.manualSheet.save')} onPress={handleContinue} disabled={!name.trim()} />
              </View>
            </View>
          ) : null}

          {step === 'review' ? (
            <View className="gap-4 px-6">
              <View className="gap-3 rounded-3xl border p-4" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-2">
                    <View
                      className="items-center justify-center rounded-xl"
                      style={{ width: 32, height: 32, backgroundColor: `${theme.action.base}14` }}
                    >
                      <Pencil color={theme.action.base} size={16} strokeWidth={2.25} />
                    </View>
                    <Text className="text-body font-bold" style={{ color: theme.colors.ink }}>
                      {t('medications.manualSheet.reviewDetailsTitle')}
                    </Text>
                  </View>
                  <Pressable onPress={() => setStep('details')} accessibilityRole="button" hitSlop={8}>
                    <Text className="text-body font-semibold" style={{ color: theme.action.base }}>
                      {t('medications.manualSheet.reviewEdit')}
                    </Text>
                  </Pressable>
                </View>
                <View style={{ height: 1, backgroundColor: theme.colors.hairline }} />
                <View>
                  <ReviewRow label={t('medications.manualSheet.nameLabel')} value={name.trim()} />
                  <ReviewRow label={t('medications.manualSheet.strengthLabel')} value={strength.trim() || '—'} />
                  <ReviewRow label={t('medications.manualSheet.formLabel')} value={t(FORM_LABEL_KEY[form])} />
                  <ReviewRow label={t('medications.manualSheet.reviewStartDate')} value={courseStartDate.trim() || '—'} />
                  <ReviewRow label={t('medications.manualSheet.reviewEndDate')} value={ongoing ? '—' : courseEndDate.trim() || '—'} />
                  <ReviewRow label={t('medications.manualSheet.ongoingToggle')} value={ongoingLabel} />
                </View>
              </View>

              <Pressable
                onPress={() => {
                  triggerHaptic('selection');
                  setSetReminder((prev) => !prev);
                }}
                accessibilityRole="switch"
                accessibilityState={{ checked: setReminder }}
                className="min-h-hit flex-row items-center gap-3 rounded-2xl border p-4"
                style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
              >
                <View
                  className="items-center justify-center rounded-xl"
                  style={{ width: 40, height: 40, backgroundColor: `${theme.action.base}14` }}
                >
                  <Bell color={theme.action.base} size={20} strokeWidth={2.25} />
                </View>
                <View className="flex-1 gap-0.5">
                  <Text className="text-body font-bold" style={{ color: theme.colors.ink }}>
                    {t('medications.manualSheet.setReminderTitle')}
                  </Text>
                  <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                    {t('medications.manualSheet.setReminderBody')}
                  </Text>
                </View>
                <Switch
                  value={setReminder}
                  onValueChange={setSetReminder}
                  trackColor={{ false: theme.mode === 'dark' ? 'rgba(255,255,255,0.12)' : '#E2E8F0', true: theme.action.base }}
                  thumbColor="#FFFFFF"
                />
              </Pressable>

              {duplicateError ? (
                <Text className="text-caption" style={{ color: theme.statusText('missed') }}>
                  {t('medications.alreadyAdded', { name: name.trim() })}
                </Text>
              ) : null}

              <View style={{ marginTop: 4, gap: 10 }}>
                <LargeTextButton label={t('medications.manualSheet.save')} onPress={handleConfirmAdd} loading={saving} />
                <Text className="text-caption text-center" style={{ color: theme.colors.inkMuted }}>
                  {t('medications.manualSheet.editLaterNote')}
                </Text>
              </View>
            </View>
          ) : null}

          {step === 'added' ? (
            <View className="items-center gap-4 px-6 pt-6">
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 84, height: 84, backgroundColor: theme.mode === 'dark' ? 'rgba(16, 185, 129, 0.18)' : '#DCFCE7' }}
              >
                <CircleCheck color={theme.mode === 'dark' ? '#34D399' : '#16A34A'} size={48} strokeWidth={2} />
              </View>
              <Text className="text-title-lg text-center" style={{ color: theme.colors.ink }}>
                {t('medications.manualSheet.addedTitle')}
              </Text>
              <Text className="text-body text-center" style={{ color: theme.colors.inkSecondary }}>
                {t('medications.manualSheet.addedBody', { name: name.trim() })}
              </Text>
              <View style={{ width: '100%', marginTop: 12 }}>
                <LargeTextButton label={t('medications.manualSheet.doneLabel')} onPress={() => modalRef.current?.dismiss()} />
              </View>
            </View>
          ) : null}

        </BottomSheetScrollView>
      </BottomSheetModal>
    );
  },
);
