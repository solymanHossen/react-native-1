import { FlashList } from '@shopify/flash-list';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChartColumn, Check, ChevronRight, Clock, Droplet, Moon, Package, Pencil, Phone, Pill, PillBottle, Plus, ShieldAlert, Sun, Sunrise, Sunset, Trash2, User, X } from 'lucide-react-native';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ComponentType, type ElementRef } from 'react';
import { ActivityIndicator, Image, Keyboard, Pressable, Text, View } from 'react-native';
import Svg, { Path as SvgPath } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { AlarmScheduleCard, AlarmsEmptyState, AlarmsHeroSummary, EmergencyContactCard, maskPhone } from '../components/alarms';
import { LargeTextButton } from '../components/ui';
import {
  deleteSchedule,
  getCaregiverPhone,
  isValidCaregiverPhone,
  normalizeCaregiverPhone,
  rescheduleAllActiveAlarms,
  setCaregiverPhone,
  setScheduleActive,
} from '../alarms';
import { initializeDatabase, type Medication, type MediusDatabase } from '../db';
import type { MealRelation, ScheduleWithMedication, TimeNode } from '../db/types';
import { useTranslation, type TranslationKey } from '../i18n';
import { triggerHaptic } from '../lib/haptics';
import { useTheme } from '../theme/useTheme';

interface CaregiverContactSheetRef {
  present: (phone: string | null) => void;
}

const CaregiverContactSheet = forwardRef<CaregiverContactSheetRef, {
  onSave: (phone: string) => void;
  onClear: () => void;
}>(function CaregiverContactSheetImpl({ onSave, onClear }, ref) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const modalRef = useRef<BottomSheetModal>(null);
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const bottomPadding = Math.max(insets.bottom, 16) + 20;

  useImperativeHandle(ref, () => ({
    present: (savedPhone) => {
      setPhone(savedPhone ?? '');
      setError(null);
      modalRef.current?.present();
    },
  }), []);

  const handleSave = useCallback(() => {
    const normalized = normalizeCaregiverPhone(phone);
    if (!normalized || !isValidCaregiverPhone(normalized)) {
      setError(t('alarms.caregiverInvalid'));
      return;
    }
    Keyboard.dismiss();
    onSave(normalized);
    modalRef.current?.dismiss();
  }, [onSave, phone, t]);

  const handleClear = useCallback(() => {
    Keyboard.dismiss();
    onClear();
    modalRef.current?.dismiss();
  }, [onClear]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      enableDynamicSizing
      enablePanDownToClose
      enableBlurKeyboardOnGesture
      keyboardBehavior="interactive"
      keyboardBlurBehavior="restore"
      android_keyboardInputMode="adjustResize"
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.hairline }}
    >
      <BottomSheetView className="gap-5 px-6 pt-2" style={{ paddingBottom: bottomPadding }}>
        <View className="flex-row items-center gap-3">
          <View className="items-center justify-center rounded-2xl" style={{ width: 48, height: 48, backgroundColor: `${theme.action.base}18` }}>
            <Phone color={theme.action.base} size={24} strokeWidth={2.25} />
          </View>
          <View className="flex-1">
            <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
              {t('alarms.caregiverModalTitle')}
            </Text>
            <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
              {t('alarms.caregiverModalDescription')}
            </Text>
          </View>
        </View>

        <View className="gap-2">
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            {t('alarms.caregiverPhoneLabel')}
          </Text>
          <BottomSheetTextInput
            value={phone}
            onChangeText={(value) => {
              setPhone(value);
              setError(null);
            }}
            placeholder={t('alarms.caregiverPlaceholder')}
            placeholderTextColor={theme.colors.inkMuted}
            keyboardType="phone-pad"
            autoFocus
            className="min-h-hit rounded-2xl border px-5 text-body-lg"
            style={{ backgroundColor: theme.colors.elevated, borderColor: error ? theme.statusText('missed') : theme.colors.hairline, color: theme.colors.ink }}
          />
          <Text className="text-caption" style={{ color: error ? theme.statusText('missed') : theme.colors.inkMuted }}>
            {error ?? t('alarms.caregiverInputHint')}
          </Text>
        </View>

        <LargeTextButton label={t('alarms.saveCaregiverNumber')} onPress={handleSave} />
        {phone ? (
          <Pressable
            onPress={handleClear}
            accessibilityRole="button"
            accessibilityLabel={t('alarms.clearCaregiverAccessibility')}
            className="min-h-hit flex-row items-center justify-center gap-2"
          >
            <Trash2 color={theme.statusText('missed')} size={18} />
            <Text className="text-body-lg" style={{ color: theme.statusText('missed'), fontWeight: '600' }}>
              {t('alarms.removeCaregiver')}
            </Text>
          </Pressable>
        ) : null}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

function formatTimeLabel(timeUtc: string): string {
  const [hours, minutes] = timeUtc.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function medicationFormIcon(form: Medication['form']) {
  return form === 'tablet' || form === 'capsule' ? Pill : form === 'syrup' || form === 'drop' ? Droplet : Package;
}

function getMedicationFormStyle(form: Medication['form'], isDark: boolean) {
  switch (form) {
    case 'tablet':
    case 'capsule':
      return {
        icon: Pill,
        iconColor: isDark ? '#60A5FA' : '#2563EB',
        badgeBg: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF',
        stockBg: isDark ? 'rgba(59, 130, 246, 0.14)' : '#F0F7FF',
        stockColor: isDark ? '#60A5FA' : '#1D4ED8',
      };
    case 'syrup':
    case 'drop':
      return {
        icon: Droplet,
        iconColor: isDark ? '#C084FC' : '#7C3AED',
        badgeBg: isDark ? 'rgba(168, 85, 247, 0.16)' : '#F5F3FF',
        stockBg: isDark ? 'rgba(168, 85, 247, 0.14)' : '#FAF5FF',
        stockColor: isDark ? '#C084FC' : '#7C3AED',
      };
    case 'injection':
      return {
        icon: Package,
        iconColor: isDark ? '#34D399' : '#059669',
        badgeBg: isDark ? 'rgba(16, 185, 129, 0.16)' : '#ECFDF5',
        stockBg: isDark ? 'rgba(16, 185, 129, 0.14)' : '#F0FDF4',
        stockColor: isDark ? '#34D399' : '#059669',
      };
    default:
      return {
        icon: Package,
        iconColor: isDark ? '#60A5FA' : '#2563EB',
        badgeBg: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF',
        stockBg: isDark ? 'rgba(59, 130, 246, 0.14)' : '#F0F7FF',
        stockColor: isDark ? '#60A5FA' : '#1D4ED8',
      };
  }
}

interface TimeSlot {
  node: TimeNode;
  timeUtc: string;
  labelKey: TranslationKey;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** Index into the day, 0 (breakfast) to 3 (bedtime) — lets the schedule
   * list badge (AlarmScheduleCard) render a light-to-dark progression that
   * tracks time of day using the single app brand color (`theme.action.base`
   * at increasing tint strength) instead of a disconnected hardcoded "brand
   * (pomegranate) family" that doesn't adapt to light/dark mode or match the
   * rest of the app. */
  depth: number;
}

const TIME_SLOTS: TimeSlot[] = [
  { node: 'BREAKFAST', timeUtc: '08:00', labelKey: 'alarms.timeMorning', icon: Sunrise, depth: 0 },
  { node: 'LUNCH', timeUtc: '13:00', labelKey: 'alarms.timeAfternoon', icon: Sun, depth: 1 },
  { node: 'DINNER', timeUtc: '20:00', labelKey: 'alarms.timeEvening', icon: Sunset, depth: 2 },
  { node: 'BEDTIME', timeUtc: '22:00', labelKey: 'alarms.timeBedtime', icon: Moon, depth: 3 },
];

const MEAL_RELATIONS: Array<{ value: MealRelation; labelKey: TranslationKey }> = [
  { value: 'BEFORE', labelKey: 'alarms.mealBefore' },
  { value: 'WITH', labelKey: 'alarms.mealWith' },
  { value: 'AFTER', labelKey: 'alarms.mealAfter' },
];

function toHHMM(hours: number, minutes: number): string {
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
}

/** Buckets an arbitrary picked time into whichever TIME_SLOTS preset is closest on the clock (wrapping past midnight) — a custom time still needs a `time_node` for schema storage and for the icon/color grouping every other surface (TIME_NODE_STYLE, the schedule list) keys off of. */
function nearestTimeNode(hours: number, minutes: number): TimeNode {
  const target = hours * 60 + minutes;
  let best: TimeSlot = TIME_SLOTS[0];
  let bestDistance = Infinity;
  for (const slot of TIME_SLOTS) {
    const [slotHours, slotMinutes] = slot.timeUtc.split(':').map(Number);
    const diff = Math.abs(target - (slotHours * 60 + slotMinutes));
    const distance = Math.min(diff, 1440 - diff);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = slot;
    }
  }
  return best.node;
}

/** Reads a TIME_SLOTS entry's icon/depth back out by node — keeps TIME_NODE_STYLE's four shared entries derived from the single TIME_SLOTS source instead of re-spelling the same values a second time. */
function timeSlotStyle(node: Exclude<TimeNode, 'FASTING'>) {
  const slot = TIME_SLOTS.find((entry) => entry.node === node)!;
  return { icon: slot.icon, depth: slot.depth };
}

/**
 * The same icon + depth every TIME_SLOTS entry uses, keyed by time_node so a
 * saved schedule's card can be badged identically to however it looked when
 * it was added — the "Add a Reminder" picker and "Scheduled Alarms" list
 * read as one coherent feature instead of a colorful picker feeding into a
 * flat gray list. FASTING isn't offered by the picker above (nothing in this
 * screen creates it anymore), but existing schedules from before this
 * redesign can still carry it, so it gets its own entry rather than crashing
 * on a missing lookup — `depth: -1` is a sentinel AlarmScheduleCard reads as
 * "use the `fasting` status color instead of the day/night progression,"
 * since fasting isn't a time of day at all.
 */
const TIME_NODE_STYLE: Record<TimeNode, { icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; depth: number }> = {
  BREAKFAST: timeSlotStyle('BREAKFAST'),
  LUNCH: timeSlotStyle('LUNCH'),
  DINNER: timeSlotStyle('DINNER'),
  BEDTIME: timeSlotStyle('BEDTIME'),
  FASTING: { icon: Clock, depth: -1 },
};

interface ReminderSheetRef {
  present: (medication: Medication) => void;
}

/**
 * The "configure this reminder" step of adding one, split out of the main
 * screen into its own focused sheet — picking a medication from the
 * horizontal list now opens straight into this instead of growing an
 * ever-taller inline card underneath the picker. Time-of-day is a 2x2 grid
 * of the same icon cards the rest of this screen already uses (not the old
 * collapsed dropdown), so all four options are visible and comparable at a
 * glance instead of needing an extra tap just to see them.
 */
const ReminderSheet = forwardRef<ReminderSheetRef, {
  onConfirm: (medication: Medication, time: { timeUtc: string; timeNode: TimeNode }, mealRelation: MealRelation, title: string | null) => Promise<void>;
}>(function ReminderSheetImpl({ onConfirm }, ref) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const modalRef = useRef<BottomSheetModal>(null);
  const [medication, setMedication] = useState<Medication | null>(null);
  const [timeNode, setTimeNode] = useState<TimeNode>('BREAKFAST');
  const [customTime, setCustomTime] = useState<{ hours: number; minutes: number } | null>(null);
  const [showCustomPicker, setShowCustomPicker] = useState(false);
  const [mealRelation, setMealRelation] = useState<MealRelation>('WITH');
  const [customTitle, setCustomTitle] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const snapPoints = useMemo(() => ['78%'], []);
  const bottomPadding = Math.max(insets.bottom, 16) + 20;

  useImperativeHandle(ref, () => ({
    present: (nextMedication) => {
      setMedication(nextMedication);
      setTimeNode('BREAKFAST');
      setCustomTime(null);
      setShowCustomPicker(false);
      setMealRelation('WITH');
      setCustomTitle('');
      setError(null);
      setSubmitting(false);
      modalRef.current?.present();
    },
  }), []);

  // A custom time still has to resolve to one of the fixed `time_node`
  // values the schema (and every other surface keyed on TIME_NODE_STYLE)
  // expects — `nearestTimeNode` buckets it by clock proximity rather than
  // inventing a 5th, unstyled node just for user-picked times.
  const resolvedTime = useMemo(() => {
    if (customTime) {
      return { timeUtc: toHHMM(customTime.hours, customTime.minutes), timeNode: nearestTimeNode(customTime.hours, customTime.minutes) };
    }
    const slot = TIME_SLOTS.find((entry) => entry.node === timeNode) ?? TIME_SLOTS[0];
    return { timeUtc: slot.timeUtc, timeNode: slot.node };
  }, [customTime, timeNode]);

  const customPickerValue = useMemo(() => {
    const base = new Date();
    if (customTime) {
      base.setHours(customTime.hours, customTime.minutes, 0, 0);
    } else {
      const [hours, minutes] = resolvedTime.timeUtc.split(':').map(Number);
      base.setHours(hours, minutes, 0, 0);
    }
    return base;
  }, [customTime, resolvedTime.timeUtc]);

  const handleCustomTimeChange = useCallback((event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowCustomPicker(false);
    if (event.type !== 'set' || !selectedDate) return;
    setCustomTime({ hours: selectedDate.getHours(), minutes: selectedDate.getMinutes() });
    triggerHaptic('selection');
  }, []);

  const handleConfirm = useCallback(async () => {
    if (!medication || submitting) return;
    setSubmitting(true);
    setError(null);
    Keyboard.dismiss();
    try {
      await onConfirm(medication, resolvedTime, mealRelation, customTitle.trim() || null);
      modalRef.current?.dismiss();
    } catch (confirmError) {
      console.warn('[ReminderSheet] failed to add reminder', confirmError);
      setError(t('alarms.toggleFailed', { name: medication.name }));
    } finally {
      setSubmitting(false);
    }
  }, [customTitle, mealRelation, medication, onConfirm, resolvedTime, submitting, t]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  if (!medication) return null;
  const FormIcon = medicationFormIcon(medication.form);

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
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.hairline }}
    >
      <BottomSheetView className="gap-5 px-6 pt-2" style={{ paddingBottom: bottomPadding }}>
        <View className="flex-row items-center gap-3">
          <View className="items-center justify-center rounded-2xl" style={{ width: 48, height: 48, backgroundColor: `${theme.action.base}18` }}>
            <FormIcon color={theme.action.base} size={23} strokeWidth={2.25} />
          </View>
          <View className="flex-1">
            <Text className="text-title-lg" numberOfLines={1} style={{ color: theme.colors.ink }}>
              {t('alarms.reminderSheetTitle')}
            </Text>
            <Text className="text-caption" numberOfLines={1} style={{ color: theme.colors.inkSecondary }}>
              {[medication.name, medication.strength].filter(Boolean).join(' · ')}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              modalRef.current?.dismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('alarms.reminderSheetClose')}
            className="min-h-hit min-w-hit items-center justify-center"
          >
            <X color={theme.colors.inkMuted} size={22} />
          </Pressable>
        </View>

        <View className="gap-2.5">
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            {t('alarms.pickTime')}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {TIME_SLOTS.map((slot) => {
              const SlotIcon = slot.icon;
              const selected = !customTime && timeNode === slot.node;
              return (
                <Pressable
                  key={slot.node}
                  onPress={() => {
                    setTimeNode(slot.node);
                    setCustomTime(null);
                    triggerHaptic('selection');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t(slot.labelKey)}
                  accessibilityState={{ selected }}
                  className="min-h-hit flex-row items-center gap-3 rounded-2xl border p-3.5"
                  style={{
                    width: '47%',
                    backgroundColor: selected ? `${theme.action.base}12` : theme.colors.elevated,
                    borderColor: selected ? theme.action.base : theme.colors.hairline,
                    borderWidth: selected ? 2 : 1,
                  }}
                >
                  <View className="items-center justify-center rounded-xl" style={{ width: 38, height: 38, backgroundColor: selected ? theme.action.base : `${theme.action.base}14` }}>
                    <SlotIcon color={selected ? theme.action.ink : theme.action.base} size={19} strokeWidth={2.25} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-body" numberOfLines={1} style={{ color: theme.colors.ink, fontWeight: selected ? '700' : '600' }}>
                      {t(slot.labelKey)}
                    </Text>
                    <Text className="text-caption" numberOfLines={1} style={{ color: theme.colors.inkSecondary }}>
                      {formatTimeLabel(slot.timeUtc)}
                    </Text>
                  </View>
                  {selected ? <Check color={theme.action.base} size={17} strokeWidth={2.5} /> : null}
                </Pressable>
              );
            })}
          </View>

          {/* A 5th, full-width option rather than wedging it into the 2x2
              grid — picking any exact time is a different kind of choice
              than picking one of four fixed presets, and reads clearer as
              its own row than as an oddly-wrapping fifth card. */}
          <Pressable
            onPress={() => setShowCustomPicker(true)}
            accessibilityRole="button"
            accessibilityLabel={t('alarms.timeSelectorAccessibility')}
            accessibilityState={{ selected: customTime !== null }}
            className="min-h-hit flex-row items-center gap-3 rounded-2xl border p-3.5"
            style={{
              backgroundColor: customTime ? `${theme.action.base}12` : theme.colors.elevated,
              borderColor: customTime ? theme.action.base : theme.colors.hairline,
              borderWidth: customTime ? 2 : 1,
            }}
          >
            <View className="items-center justify-center rounded-xl" style={{ width: 38, height: 38, backgroundColor: customTime ? theme.action.base : `${theme.action.base}14` }}>
              <Clock color={customTime ? theme.action.ink : theme.action.base} size={19} strokeWidth={2.25} />
            </View>
            <View className="flex-1">
              <Text className="text-body" numberOfLines={1} style={{ color: theme.colors.ink, fontWeight: customTime ? '700' : '600' }}>
                {t('alarms.customTime')}
              </Text>
              <Text className="text-caption" numberOfLines={1} style={{ color: theme.colors.inkSecondary }}>
                {customTime ? formatTimeLabel(toHHMM(customTime.hours, customTime.minutes)) : t('alarms.customTimeHint')}
              </Text>
            </View>
            {customTime ? <Check color={theme.action.base} size={17} strokeWidth={2.5} /> : null}
          </Pressable>
          {showCustomPicker ? (
            <DateTimePicker value={customPickerValue} mode="time" display="default" onChange={handleCustomTimeChange} />
          ) : null}
        </View>

        <View className="gap-2.5">
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            {t('alarms.mealRelationLabel')}
          </Text>
          <View className="flex-row gap-3">
            {MEAL_RELATIONS.map((relation) => {
              const selected = mealRelation === relation.value;
              const RelationIcon = relation.value === 'BEFORE' ? Sunrise : relation.value === 'AFTER' ? Sunset : Check;
              return (
                <Pressable
                  key={relation.value}
                  onPress={() => {
                    setMealRelation(relation.value);
                    triggerHaptic('selection');
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t(relation.labelKey)}
                  accessibilityState={{ selected }}
                  className="min-h-hit flex-1 items-center gap-2 rounded-2xl border p-3.5"
                  style={{
                    backgroundColor: selected ? `${theme.action.base}12` : theme.colors.elevated,
                    borderColor: selected ? theme.action.base : theme.colors.hairline,
                    borderWidth: selected ? 2 : 1,
                  }}
                >
                  <View className="items-center justify-center rounded-xl" style={{ width: 36, height: 36, backgroundColor: selected ? theme.action.base : `${theme.action.base}14` }}>
                    <RelationIcon color={selected ? theme.action.ink : theme.action.base} size={19} strokeWidth={2.25} />
                  </View>
                  <Text className="text-caption" numberOfLines={1} style={{ color: theme.colors.ink, fontWeight: selected ? '700' : '600' }}>
                    {t(relation.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            {t('alarms.mealRelationHint')}
          </Text>
        </View>

        <View className="gap-2">
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            {t('alarms.customTitleLabel')}
          </Text>
          <BottomSheetTextInput
            value={customTitle}
            onChangeText={setCustomTitle}
            placeholder={t('alarms.customTitlePlaceholder')}
            placeholderTextColor={theme.colors.inkMuted}
            maxLength={60}
            returnKeyType="done"
            className="min-h-hit rounded-2xl border px-5 text-body-lg"
            style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
          />
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            {t('alarms.customTitleHint', { name: medication.name })}
          </Text>
        </View>

        {error ? (
          <Text className="text-caption" style={{ color: theme.statusText('missed') }}>
            {error}
          </Text>
        ) : null}
        <Pressable
          onPress={handleConfirm}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: submitting }}
          className="min-h-hit flex-row items-center justify-center gap-2 rounded-2xl px-5 py-4"
          style={{ backgroundColor: theme.action.base, opacity: submitting ? 0.7 : 1 }}
        >
          {submitting ? (
            <ActivityIndicator color={theme.action.ink} />
          ) : (
            <>
              <Clock color={theme.action.ink} size={20} strokeWidth={2.25} />
              <Text className="text-body-lg" style={{ color: theme.action.ink, fontWeight: '700' }}>
                {t('alarms.addReminder')}
              </Text>
            </>
          )}
        </Pressable>
      </BottomSheetView>
    </BottomSheetModal>
  );
});

/**
 * Manage reminder times for your medications, plus the caregiver escalation
 * contact. The "add a reminder" flow used to create a hardcoded fake
 * medication with a made-up NFC tag every time you tapped it — a developer
 * convenience for exercising the DB -> scheduler -> AlarmScreen pipeline
 * during testing, not something a real patient could use to set a reminder
 * for a medication they actually take. It's replaced here with a real flow:
 * pick one of your own medications (added via Meds or Scan Rx), pick a time
 * of day, done. Likewise, the "Trigger Now (Demo)" button on every row — a
 * pure QA shortcut to fire the full-screen alarm early — is gone from the
 * user-facing list entirely; nothing about ringing your own alarm early is
 * useful to a patient, only to someone testing the alarm engine.
 */
export interface AlarmsScreenProps {
  onOpenSettings?: () => void;
  onNavigateToMedications?: () => void;
}

export default function AlarmsScreen({ onOpenSettings, onNavigateToMedications }: AlarmsScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.mode === 'dark';
  const [initError, setInitError] = useState<string | null>(null);
  const [schedules, setSchedules] = useState<ScheduleWithMedication[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [savedCaregiverPhone, setSavedCaregiverPhone] = useState(() => getCaregiverPhone());
  const [status, setStatus] = useState<string | null>(null);
  const caregiverSheetRef = useRef<CaregiverContactSheetRef>(null);
  const reminderSheetRef = useRef<ReminderSheetRef>(null);
  const flashListRef = useRef<ElementRef<typeof FlashList<ScheduleWithMedication>>>(null);

  const refresh = useCallback(async (database: MediusDatabase) => {
    const [scheduleRows, medicationRows] = await Promise.all([
      database.schedules.listAllWithMedication(),
      database.medications.list(),
    ]);
    setSchedules(scheduleRows);
    setMedications(medicationRows);
  }, []);

  useEffect(() => {
    initializeDatabase()
      .then((database) => refresh(database))
      .catch((error: unknown) => setInitError(error instanceof Error ? error.message : String(error)));
  }, [refresh]);

  const handleAddReminder = useCallback(
    async (medication: Medication, time: { timeUtc: string; timeNode: TimeNode }, mealRelation: MealRelation, title: string | null) => {
      // Re-fetches the live database rather than using the `mediusDb` closure —
      // if a vault restore happened while this screen stayed mounted, `mediusDb`
      // would still point at the connection that restore just closed.
      const database = await initializeDatabase();
      await database.schedules.create({
        medication_id: medication.id,
        time_utc: time.timeUtc,
        time_node: time.timeNode,
        meal_relation: mealRelation,
        dose_quantity: 1,
        days_of_week_mask: 127,
        is_active: true,
        title,
      });
      await Promise.all([refresh(database), rescheduleAllActiveAlarms()]);
      triggerHaptic('notificationSuccess');
      setStatus(t('alarms.reminderAdded', { name: medication.name }));
    },
    [refresh, t],
  );

  const handleToggleActive = useCallback(
    async (schedule: ScheduleWithMedication, nextActive: boolean) => {
      triggerHaptic('selection');
      // Optimistic update — setScheduleActive also has to cancel/reschedule
      // the real notifee trigger, which takes a moment, and the switch
      // shouldn't visibly lag behind the tap that flipped it.
      setSchedules((prev) => prev.map((entry) => (entry.id === schedule.id ? { ...entry, is_active: nextActive } : entry)));
      try {
        await setScheduleActive(schedule, nextActive);
      } catch (error) {
        // The DB flag and/or the real notifee trigger never actually flipped —
        // revert the optimistic switch so the UI doesn't drift from reality.
        console.warn('[AlarmsScreen] failed to toggle schedule', error);
        setSchedules((prev) => prev.map((entry) => (entry.id === schedule.id ? { ...entry, is_active: !nextActive } : entry)));
        setStatus(t('alarms.toggleFailed', { name: schedule.medicationName }));
        triggerHaptic('notificationError');
        return;
      }
      setStatus(
        nextActive
          ? t('alarms.turnedOn', { name: schedule.medicationName })
          : t('alarms.turnedOff', { name: schedule.medicationName }),
      );
    },
    [t],
  );

  const handleDeleteSchedule = useCallback(
    async (schedule: ScheduleWithMedication) => {
      // Optimistic delete
      setSchedules((prev) => prev.filter((entry) => entry.id !== schedule.id));
      try {
        await deleteSchedule(schedule.id);
        setStatus(t('alarms.alarmDeleted', { name: schedule.medicationName }));
        triggerHaptic('notificationSuccess');
      } catch (error) {
        console.warn('[AlarmsScreen] failed to delete schedule', error);
        const database = await initializeDatabase();
        await refresh(database);
        setStatus(t('alarms.deleteFailed'));
        triggerHaptic('notificationError');
      }
    },
    [refresh, t],
  );

  const handleSaveCaregiverPhone = useCallback((phone: string) => {
    const normalized = normalizeCaregiverPhone(phone);
    setCaregiverPhone(normalized);
    setSavedCaregiverPhone(normalized);
    setStatus(normalized ? t('alarms.caregiverSaved') : t('alarms.caregiverCleared'));
    triggerHaptic('notificationSuccess');
  }, [t]);

  const handleClearCaregiverPhone = useCallback(() => {
    setCaregiverPhone('');
    setSavedCaregiverPhone(null);
    setStatus(t('alarms.caregiverCleared'));
    triggerHaptic('selection');
  }, [t]);

  const maskedCaregiverPhone = savedCaregiverPhone ? maskPhone(savedCaregiverPhone) : null;

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor: theme.colors.canvas }}>
      <View className="flex-row items-start justify-between border-b px-6 py-6" style={{ borderColor: theme.colors.hairline }}>
        <View className="flex-1 pr-3">
          <Text className="text-caption font-semibold uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            {t('alarms.eyebrow')}
          </Text>
          <Text className="mt-0.5 text-title-lg font-extrabold" style={{ color: theme.colors.ink }}>
            {t('alarms.title')}
          </Text>
          <Text className="mt-1 text-caption" style={{ color: theme.colors.inkSecondary }}>
            {t('alarms.subtitle')}
          </Text>
          {initError ? (
            <Text className="mt-2 text-caption" style={{ color: theme.statusText('missed') }}>
              {t('alarms.databaseFailed', { error: initError })}
            </Text>
          ) : status ? (
            <Text className="mt-2 text-caption" style={{ color: theme.statusText('taken') }}>
              {status}
            </Text>
          ) : null}
        </View>
        {onOpenSettings ? (
          <Pressable
            onPress={onOpenSettings}
            accessibilityRole="button"
            accessibilityLabel={t('home.settings')}
            hitSlop={6}
            className="items-center justify-center rounded-full"
            style={{ width: 40, height: 40, backgroundColor: theme.colors.elevated }}
          >
            <User color={theme.colors.inkSecondary} size={19} strokeWidth={2} />
          </Pressable>
        ) : null}
      </View>

      {/* FlashList, not a ScrollView + .map — a caregiver's schedule list is
          small today, but this is the one list in the app with genuine
          unbounded growth (every medication's every dose time), and
          virtualizing it costs nothing when short while staying flat-cost
          if it grows into the hundreds. */}
      <FlashList
        ref={flashListRef}
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 28 }}
        data={schedules}
        keyExtractor={(schedule) => String(schedule.id)}
        ListHeaderComponent={
          <View className="gap-6" style={{ marginBottom: 20 }}>
            <EmergencyContactCard
              phone={savedCaregiverPhone}
              maskedPhone={maskedCaregiverPhone}
              onEdit={() => {
                triggerHaptic('selection');
                caregiverSheetRef.current?.present(savedCaregiverPhone);
              }}
              onDelete={handleClearCaregiverPhone}
              onAdd={() => {
                triggerHaptic('selection');
                caregiverSheetRef.current?.present(null);
              }}
            />

            {/* Solid banner introducing the list below. Tapping it is a
                shortcut, not a dead decoration: with a medication on file it
                jumps straight into the reminder sheet for the first one
                (same destination as tapping that row directly below); with
                none yet, it sends you to add one instead of doing nothing. */}
            <Pressable
              onPress={() => {
                triggerHaptic('selection');
                if (medications.length > 0) {
                  reminderSheetRef.current?.present(medications[0]);
                } else {
                  onNavigateToMedications?.();
                }
              }}
              accessibilityRole="button"
              accessibilityLabel={t('alarms.scheduleReminderTitle')}
              className="flex-row items-center gap-3.5 overflow-hidden rounded-[24px] p-5 shadow-sm"
              style={{ backgroundColor: isDark ? '#1E3A8A' : '#3182CE' }}
            >
              <View
                className="items-center justify-center rounded-2xl shadow-sm"
                style={{ width: 44, height: 44, backgroundColor: '#FFFFFF' }}
              >
                <Plus color={isDark ? '#1E3A8A' : '#3182CE'} size={22} strokeWidth={2.6} />
              </View>
              <View className="flex-1">
                <Text className="text-[17px] font-bold" style={{ color: '#FFFFFF' }}>
                  {t('alarms.scheduleReminderTitle')}
                </Text>
                <Text className="text-[13px] mt-0.5" style={{ color: 'rgba(255, 255, 255, 0.85)' }}>
                  {t('alarms.scheduleReminderSubtitle')}
                </Text>
              </View>
              <Image
                source={require('../../assets/branding/capsule-pill.png')}
                pointerEvents="none"
                style={{
                  position: 'absolute',
                  right: -16,
                  bottom: -14,
                  width: 76,
                  height: 76 * (63 / 64),
                  opacity: 0.22,
                  transform: [{ rotate: '-18deg' }],
                }}
                resizeMode="contain"
              />
            </Pressable>

            <View
              className="rounded-[24px] border p-5 shadow-sm"
              style={{
                backgroundColor: isDark ? 'rgba(31, 41, 55, 0.75)' : '#FFFFFF',
                borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#F1F5F9',
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: isDark ? 0.25 : 0.03,
                shadowRadius: 8,
                elevation: 1,
              }}
            >
              <View className="flex-row items-center justify-between pb-3">
                <View className="flex-row items-center gap-3">
                  <View
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 40,
                      height: 40,
                      backgroundColor: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF',
                    }}
                  >
                    <PillBottle color={isDark ? '#60A5FA' : '#2563EB'} size={20} strokeWidth={2.2} />
                  </View>
                  <Text
                    className="text-[17px] font-bold tracking-tight"
                    style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}
                  >
                    {t('alarms.yourMedicines')}
                  </Text>
                </View>
                {onNavigateToMedications ? (
                  <Pressable
                    onPress={() => {
                      triggerHaptic('selection');
                      onNavigateToMedications();
                    }}
                    accessibilityRole="button"
                    className="min-h-hit flex-row items-center gap-2"
                  >
                    <Text
                      className="text-[14px] font-bold"
                      style={{ color: isDark ? '#60A5FA' : '#2563EB' }}
                    >
                      {t('alarms.addMedicine')}
                    </Text>
                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        width: 24,
                        height: 24,
                        backgroundColor: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF',
                      }}
                    >
                      <Plus color={isDark ? '#60A5FA' : '#2563EB'} size={13} strokeWidth={2.6} />
                    </View>
                  </Pressable>
                ) : null}
              </View>

              {medications.length === 0 ? (
                <Text className="pb-1 text-body-lg" style={{ color: theme.colors.inkSecondary }}>
                  {t('alarms.noMedicationsYet')}
                </Text>
              ) : (
                medications.map((medication, index) => {
                  const formStyle = getMedicationFormStyle(medication.form, isDark);
                  const FormIcon = formStyle.icon;
                  const outOfStock = medication.current_stock <= 0;
                  const lowStock = !outOfStock && medication.current_stock <= medication.refill_threshold;
                  const stockColor = outOfStock
                    ? (isDark ? '#F87171' : '#EF4444')
                    : lowStock
                    ? (isDark ? '#FBBF24' : '#F59E0B')
                    : formStyle.stockColor;
                  const stockBg = outOfStock
                    ? (isDark ? 'rgba(239, 68, 68, 0.16)' : '#FEF2F2')
                    : lowStock
                    ? (isDark ? 'rgba(245, 158, 11, 0.16)' : '#FFFBEB')
                    : formStyle.stockBg;
                  const isLast = index === medications.length - 1;

                  return (
                    <Pressable
                      key={medication.id}
                      onPress={() => {
                        triggerHaptic('selection');
                        reminderSheetRef.current?.present(medication);
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={medication.name}
                      className="flex-row items-center gap-3 py-3"
                      style={isLast ? undefined : { borderBottomWidth: 1, borderBottomColor: isDark ? 'rgba(255, 255, 255, 0.06)' : '#F8FAFC' }}
                    >
                      <View
                        className="items-center justify-center rounded-2xl"
                        style={{
                          width: 44,
                          height: 44,
                          backgroundColor: formStyle.badgeBg,
                        }}
                      >
                        <FormIcon color={formStyle.iconColor} size={22} strokeWidth={2.2} />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-[16px] font-bold tracking-tight"
                          numberOfLines={1}
                          style={{ color: isDark ? '#FFFFFF' : '#0F172A' }}
                        >
                          {medication.name}
                        </Text>
                        <Text
                          className="text-[13px] mt-0.5"
                          numberOfLines={1}
                          style={{ color: isDark ? '#94A3B8' : '#64748B' }}
                        >
                          {[medication.strength, t(`medications.forms.${medication.form}` as never)].filter(Boolean).join(' • ')}
                        </Text>
                      </View>

                      {/* Stock Pill Badge */}
                      <View
                        className="flex-row items-center gap-2.5 rounded-2xl px-3.5 py-2"
                        style={{ backgroundColor: stockBg }}
                      >
                        <ChartColumn color={stockColor} size={16} strokeWidth={2.2} />
                        {outOfStock || lowStock ? (
                          <Text numberOfLines={1} style={{ color: stockColor, fontSize: 12.5, fontWeight: '700' }}>
                            {outOfStock ? t('medications.outOfStock') : t('medications.lowStock')}
                          </Text>
                        ) : (
                          <View>
                            <Text numberOfLines={1} style={{ color: stockColor, fontSize: 13, fontWeight: '700' }}>
                              {t('medications.detailsStockCount', {
                                count: Math.max(0, medication.current_stock),
                                unit: medication.current_stock === 1 ? t('medications.detailsStockUnit') : t('medications.detailsStockUnitsPlural'),
                              })}
                            </Text>
                            <Text numberOfLines={1} style={{ color: isDark ? '#94A3B8' : '#64748B', fontSize: 10.5, fontWeight: '500' }}>
                              {t('medications.remaining')}
                            </Text>
                          </View>
                        )}
                        <ChevronRight color={isDark ? '#94A3B8' : '#64748B'} size={16} strokeWidth={2.4} />
                      </View>
                    </Pressable>
                  );
                })
              )}
            </View>

            <AlarmsHeroSummary
              schedules={schedules}
              onQuickAdd={() => flashListRef.current?.scrollToOffset({ offset: 0, animated: true })}
            />
          </View>
        }
        ListEmptyComponent={<AlarmsEmptyState />}
        renderItem={({ item: schedule }) => (
          <AlarmScheduleCard
            schedule={schedule}
            onToggle={handleToggleActive}
            onDelete={handleDeleteSchedule}
            timeNodeStyle={TIME_NODE_STYLE[schedule.time_node]}
          />
        )}
      />
      <CaregiverContactSheet ref={caregiverSheetRef} onSave={handleSaveCaregiverPhone} onClear={handleClearCaregiverPhone} />
      <ReminderSheet ref={reminderSheetRef} onConfirm={handleAddReminder} />
    </SafeAreaView>
  );
}
