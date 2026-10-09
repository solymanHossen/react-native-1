import { BottomSheetModal, BottomSheetTextInput, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import type { Medication } from '../../db/types';
import { useTranslation, type TranslationKey } from '../../i18n';
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

export interface ManualMedicationInput {
  name: string;
  strength: string | null;
  form: Medication['form'];
  courseStartDate: string | null;
  courseEndDate: string | null;
}

export interface ManualMedicationSheetRef {
  /** `prefillName` carries over whatever was already typed into the search box, so re-typing isn't needed when search comes up empty. */
  present: (prefillName?: string) => void;
}

export interface ManualMedicationSheetProps {
  onSave: (input: ManualMedicationInput) => void;
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
 */
export const ManualMedicationSheet = forwardRef<ManualMedicationSheetRef, ManualMedicationSheetProps>(
  function ManualMedicationSheetImpl({ onSave }, ref) {
    const theme = useTheme();
    const { t } = useTranslation();
    const modalRef = useRef<BottomSheetModal>(null);
    const snapPoints = useMemo(() => ['75%'], []);
    const [name, setName] = useState('');
    const [strength, setStrength] = useState('');
    const [form, setForm] = useState<Medication['form']>('tablet');
    const [courseStartDate, setCourseStartDate] = useState('');
    const [courseEndDate, setCourseEndDate] = useState('');
    const [dateError, setDateError] = useState(false);

    useImperativeHandle(
      ref,
      () => ({
        present: (prefillName) => {
          setName(prefillName ?? '');
          setStrength('');
          setForm('tablet');
          setCourseStartDate('');
          setCourseEndDate('');
          setDateError(false);
          modalRef.current?.present();
        },
      }),
      [],
    );

    const handleSave = useCallback(() => {
      const trimmedName = name.trim();
      if (!trimmedName) return;
      const start = courseStartDate.trim();
      const end = courseEndDate.trim();
      const hasValidDates =
        (!start && !end) ||
        (!!start && !!end && /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && start <= end);
      if (!hasValidDates) {
        setDateError(true);
        return;
      }
      setDateError(false);
      onSave({
        name: trimmedName,
        strength: strength.trim() || null,
        form,
        courseStartDate: start || null,
        courseEndDate: end || null,
      });
      modalRef.current?.dismiss();
    }, [courseEndDate, courseStartDate, form, name, onSave, strength]);

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
              {t('medications.manualSheet.title')}
            </Text>
            <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
              {t('medications.manualSheet.subtitle')}
            </Text>
          </View>

          <View className="gap-4 px-6">
            <BottomSheetTextInput
              value={name}
              onChangeText={setName}
              placeholder={t('medications.manualSheet.namePlaceholder')}
              placeholderTextColor={theme.colors.inkMuted}
              className="min-h-hit rounded-2xl border px-4 text-body-lg"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
            />
            <BottomSheetTextInput
              value={strength}
              onChangeText={setStrength}
              placeholder={t('medications.manualSheet.strengthPlaceholder')}
              placeholderTextColor={theme.colors.inkMuted}
              className="min-h-hit rounded-2xl border px-4 text-body-lg"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
            />

            <View className="gap-3">
              <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                {t('medications.manualSheet.formLabel')}
              </Text>
              <View className="flex-row flex-wrap gap-3">
                {FORMS.map((option) => {
                  const isActive = form === option;
                  return (
                    <Pressable
                      key={option}
                      onPress={() => setForm(option)}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isActive }}
                      className="min-h-hit items-center justify-center rounded-full border px-6"
                      style={{
                        backgroundColor: isActive ? theme.action.base : theme.colors.elevated,
                        borderColor: isActive ? theme.action.base : theme.colors.hairline,
                      }}
                    >
                      <Text className="text-body-lg" style={{ color: isActive ? theme.action.ink : theme.colors.ink }}>
                        {t(FORM_LABEL_KEY[option])}
                      </Text>
                    </Pressable>
                  );
                })}
              </View>
            </View>

            <CourseDateFields
              label={t('medications.manualSheet.courseDatesLabel')}
              startDate={courseStartDate || null}
              endDate={courseEndDate || null}
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

            <LargeTextButton label={t('medications.manualSheet.save')} onPress={handleSave} disabled={!name.trim()} />
          </View>
        </BottomSheetView>
      </BottomSheetModal>
    );
  },
);
