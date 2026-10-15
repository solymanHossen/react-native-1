import { FlashList } from '@shopify/flash-list';
import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
  BottomSheetTextInput,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { ChartColumn, Check, ChevronRight, Clock, Droplet, Info, Moon, Package, Pencil, Phone, Pill, PillBottle, Plus, Sun, Sunrise, Sunset, Trash2, User, Utensils, X } from 'lucide-react-native';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState, type ComponentType, type ElementRef } from 'react';
import { ActivityIndicator, Image, Keyboard, Pressable, Text, View } from 'react-native';
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
  const snapPoints = useMemo(() => ['88%'], []);
  const bottomPadding = Math.max(insets.bottom, 16) + 20;
  const isDark = theme.mode === 'dark';
  const primaryBlue = isDark ? '#3B82F6' : '#2563EB';
  const tintBlue = isDark ? 'rgba(59, 130, 246, 0.14)' : '#EFF6FF';

  const slotStyles = useMemo(() => ({
    BREAKFAST: {
      icon: Sunrise,
      iconColor: isDark ? '#60A5FA' : '#2563EB',
      badgeBg: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EBF5FF',
    },
    LUNCH: {
      icon: Sun,
      iconColor: theme.alarms.sun.icon,
      badgeBg: theme.alarms.sun.badge,
    },
    DINNER: {
      icon: Sunset,
      iconColor: isDark ? '#FB923C' : '#F97316',
      badgeBg: isDark ? 'rgba(249, 115, 22, 0.18)' : '#FFEDD5',
    },
    BEDTIME: {
      icon: Moon,
      iconColor: theme.alarms.moon.icon,
      badgeBg: theme.alarms.moon.badge,
    },
  }), [isDark, theme.alarms.moon.badge, theme.alarms.moon.icon, theme.alarms.sun.badge, theme.alarms.sun.icon]);

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
      handleIndicatorStyle={{ backgroundColor: theme.colors.hairline, width: 36, height: 4 }}
    >
      <BottomSheetScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 20, paddingTop: 6, paddingBottom: bottomPadding, gap: 18 }}
      >
        {/* Header: Icon badge, Title, Med details & quote, Close button */}
        <View className="flex-row items-center gap-3">
          <View
            className="items-center justify-center rounded-2xl"
            style={{ width: 48, height: 48, backgroundColor: tintBlue }}
          >
            <FormIcon color={primaryBlue} size={24} strokeWidth={2.2} />
          </View>
          <View className="flex-1">
            <Text className="text-title-lg font-bold" numberOfLines={1} style={{ color: theme.colors.ink, fontSize: 20 }}>
              {t('alarms.reminderSheetTitle')}
            </Text>
            <Text numberOfLines={1} style={{ color: theme.colors.inkSecondary, fontSize: 13.5, fontWeight: '500', marginTop: 2 }}>
              {[medication.name, medication.strength].filter(Boolean).join(' · ')}
            </Text>
            <Text numberOfLines={1} style={{ color: theme.colors.inkMuted, fontSize: 12, marginTop: 2 }}>
              {t('alarms.reminderSheetQuote')}
            </Text>
          </View>
          <Pressable
            onPress={() => {
              Keyboard.dismiss();
              modalRef.current?.dismiss();
            }}
            accessibilityRole="button"
            accessibilityLabel={t('alarms.reminderSheetClose')}
            hitSlop={8}
            className="min-h-hit min-w-hit items-center justify-center"
          >
            <X color={theme.colors.inkMuted} size={22} strokeWidth={2} />
          </Pressable>
        </View>

        {/* Section 1: Choose a time */}
        <View className="gap-2.5">
          <Text style={{ color: theme.colors.ink, fontSize: 15, fontWeight: '700' }}>
            {t('alarms.pickTime')}
          </Text>
          <View className="flex-row flex-wrap justify-between" style={{ rowGap: 10 }}>
            {TIME_SLOTS.map((slot) => {
              const style = slotStyles[slot.node as keyof typeof slotStyles] ?? slotStyles.BREAKFAST;
              const SlotIcon = style.icon;
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
                  className="min-h-hit flex-row items-center gap-2.5 rounded-2xl border"
                  style={{
                    width: '48.5%',
                    paddingVertical: 12,
                    paddingHorizontal: 12,
                    backgroundColor: selected ? tintBlue : theme.colors.elevated,
                    borderColor: selected ? primaryBlue : theme.colors.hairline,
                    borderWidth: selected ? 2 : 1,
                  }}
                >
                  <View
                    className="items-center justify-center rounded-full"
                    style={{ width: 38, height: 38, backgroundColor: style.badgeBg }}
                  >
                    <SlotIcon color={style.iconColor} size={20} strokeWidth={2.2} />
                  </View>
                  <View className="flex-1">
                    <Text
                      numberOfLines={1}
                      style={{ color: theme.colors.ink, fontSize: 14.5, fontWeight: '700' }}
                    >
                      {t(slot.labelKey)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={{ color: theme.colors.inkSecondary, fontSize: 12.5, fontWeight: '500', marginTop: 1 }}
                    >
                      {formatTimeLabel(slot.timeUtc)}
                    </Text>
                  </View>
                  {selected ? (
                    <View
                      className="items-center justify-center rounded-full"
                      style={{ width: 20, height: 20, backgroundColor: primaryBlue }}
                    >
                      <Check color="#FFFFFF" size={12} strokeWidth={3} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* Full-width Custom time card */}
          <Pressable
            onPress={() => {
              setShowCustomPicker(true);
              triggerHaptic('selection');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('alarms.timeSelectorAccessibility')}
            accessibilityState={{ selected: customTime !== null }}
            className="min-h-hit flex-row items-center gap-3 rounded-2xl border"
            style={{
              paddingVertical: 12,
              paddingHorizontal: 14,
              backgroundColor: customTime ? tintBlue : theme.colors.elevated,
              borderColor: customTime ? primaryBlue : theme.colors.hairline,
              borderWidth: customTime ? 2 : 1,
              marginTop: 2,
            }}
          >
            <View
              className="items-center justify-center rounded-xl"
              style={{
                width: 38,
                height: 38,
                backgroundColor: customTime ? primaryBlue : (isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF'),
              }}
            >
              <Clock
                color={customTime ? '#FFFFFF' : primaryBlue}
                size={20}
                strokeWidth={2.2}
              />
            </View>
            <View className="flex-1">
              <Text
                numberOfLines={1}
                style={{ color: theme.colors.ink, fontSize: 14.5, fontWeight: '700' }}
              >
                {t('alarms.customTime')}
              </Text>
              <Text
                numberOfLines={1}
                style={{ color: theme.colors.inkSecondary, fontSize: 12.5, fontWeight: '500', marginTop: 1 }}
              >
                {customTime ? formatTimeLabel(toHHMM(customTime.hours, customTime.minutes)) : t('alarms.customTimeHint')}
              </Text>
            </View>
            {customTime ? (
              <View
                className="items-center justify-center rounded-full"
                style={{ width: 22, height: 22, backgroundColor: primaryBlue }}
              >
                <Check color="#FFFFFF" size={13} strokeWidth={3} />
              </View>
            ) : null}
          </Pressable>
          {showCustomPicker ? (
            <DateTimePicker value={customPickerValue} mode="time" display="default" onChange={handleCustomTimeChange} />
          ) : null}
        </View>

        {/* Section 2: When should you take it? */}
        <View className="gap-2.5">
          <Text style={{ color: theme.colors.ink, fontSize: 15, fontWeight: '700' }}>
            {t('alarms.mealRelationLabel')}
          </Text>
          <View className="flex-row gap-3">
            {MEAL_RELATIONS.map((relation) => {
              const selected = mealRelation === relation.value;
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
                  className="min-h-hit flex-1 items-center justify-center rounded-2xl border"
                  style={{
                    position: 'relative',
                    paddingVertical: 14,
                    paddingHorizontal: 6,
                    backgroundColor: selected ? tintBlue : theme.colors.elevated,
                    borderColor: selected ? primaryBlue : theme.colors.hairline,
                    borderWidth: selected ? 2 : 1,
                  }}
                >
                  {selected ? (
                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        position: 'absolute',
                        top: 6,
                        right: 6,
                        width: 18,
                        height: 18,
                        backgroundColor: primaryBlue,
                      }}
                    >
                      <Check color="#FFFFFF" size={11} strokeWidth={3.5} />
                    </View>
                  ) : null}
                  <View
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 38,
                      height: 38,
                      backgroundColor: selected ? primaryBlue : (isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF'),
                      marginBottom: 8,
                    }}
                  >
                    <Utensils
                      color={selected ? '#FFFFFF' : primaryBlue}
                      size={19}
                      strokeWidth={2.2}
                    />
                  </View>
                  <Text
                    numberOfLines={1}
                    style={{
                      color: theme.colors.ink,
                      fontSize: 13,
                      fontWeight: '700',
                      textAlign: 'center',
                    }}
                  >
                    {t(relation.labelKey)}
                  </Text>
                </Pressable>
              );
            })}
          </View>

          {/* Info callout banner */}
          <View
            className="flex-row items-center gap-2.5 rounded-xl px-3.5 py-2.5"
            style={{
              backgroundColor: tintBlue,
              marginTop: 2,
            }}
          >
            <View
              className="items-center justify-center rounded-full"
              style={{ width: 18, height: 18, backgroundColor: primaryBlue }}
            >
              <Info color="#FFFFFF" size={12} strokeWidth={2.5} />
            </View>
            <Text
              style={{
                flex: 1,
                color: isDark ? '#93C5FD' : '#2563EB',
                fontSize: 12,
                fontWeight: '500',
                lineHeight: 16,
              }}
            >
              {t('alarms.mealRelationHint')}
            </Text>
          </View>
        </View>

        {/* Section 3: Custom title (optional) */}
        <View className="gap-2">
          <Text style={{ color: theme.colors.ink, fontSize: 15, fontWeight: '700' }}>
            {t('alarms.customTitleLabel')}
          </Text>
          <View
            className="flex-row items-center rounded-2xl border px-3.5"
            style={{
              height: 48,
              backgroundColor: theme.colors.elevated,
              borderColor: theme.colors.hairline,
            }}
          >
            <Pencil color={theme.colors.inkMuted} size={18} strokeWidth={2} />
            <BottomSheetTextInput
              value={customTitle}
              onChangeText={setCustomTitle}
              placeholder={t('alarms.customTitlePlaceholder')}
              placeholderTextColor={theme.colors.inkMuted}
              maxLength={60}
              returnKeyType="done"
              className="flex-1 px-2.5 text-body"
              style={{
                color: theme.colors.ink,
                fontSize: 14,
                paddingVertical: 0,
              }}
            />
          </View>
          <Text style={{ color: theme.colors.inkMuted, fontSize: 12, marginTop: 2 }}>
            {t('alarms.customTitleHint', { name: medication.name })}
          </Text>
        </View>

        {error ? (
          <Text className="text-caption" style={{ color: theme.statusText('missed') }}>
            {error}
          </Text>
        ) : null}

        {/* Action Button: Schedule a Reminder */}
        <Pressable
          onPress={handleConfirm}
          disabled={submitting}
          accessibilityRole="button"
          accessibilityLabel={t('alarms.addReminder')}
          accessibilityState={{ disabled: submitting }}
          className="min-h-hit flex-row items-center justify-center gap-2 rounded-2xl"
          style={{
            height: 52,
            backgroundColor: primaryBlue,
            opacity: submitting ? 0.7 : 1,
            marginTop: 4,
          }}
        >
          {submitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <>
              <Clock color="#FFFFFF" size={20} strokeWidth={2.2} />
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                {t('alarms.addReminder')}
              </Text>
            </>
          )}
        </Pressable>
      </BottomSheetScrollView>
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
          <View className="gap-6" style={{ marginBottom: 14 }}>
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
              style={{ backgroundColor: theme.alarms.banner.bg }}
            >
              <View
                className="items-center justify-center rounded-2xl shadow-sm"
                style={{ width: 44, height: 44, backgroundColor: theme.alarms.banner.boxBg }}
              >
                <Plus color={theme.alarms.banner.icon} size={22} strokeWidth={2.6} />
              </View>
              <View className="flex-1">
                <Text className="text-[17px] font-bold" style={{ color: theme.alarms.banner.text }}>
                  {t('alarms.scheduleReminderTitle')}
                </Text>
                <Text className="text-[13px] mt-0.5" style={{ color: theme.alarms.banner.subtitle }}>
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
                backgroundColor: theme.alarms.card.bg,
                borderColor: theme.alarms.card.border,
                shadowColor: theme.alarms.card.shadowColor,
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: theme.alarms.card.shadowOpacity,
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
                      backgroundColor: theme.alarms.bell.badge,
                    }}
                  >
                    <PillBottle color={theme.alarms.bell.icon} size={20} strokeWidth={2.2} />
                  </View>
                  <Text
                    className="text-[17px] font-bold tracking-tight"
                    style={{ color: theme.alarms.card.title }}
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
                      style={{ color: theme.alarms.bell.pillText }}
                    >
                      {t('alarms.addMedicine')}
                    </Text>
                    <View
                      className="items-center justify-center rounded-full"
                      style={{
                        width: 24,
                        height: 24,
                        backgroundColor: theme.alarms.bell.badge,
                      }}
                    >
                      <Plus color={theme.alarms.bell.icon} size={13} strokeWidth={2.6} />
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
                  const formTokens = theme.formColor(medication.form);
                  const FormIcon = medicationFormIcon(medication.form);
                  const outOfStock = medication.current_stock <= 0;
                  const lowStock = !outOfStock && medication.current_stock <= medication.refill_threshold;
                  const stockColor = outOfStock
                    ? theme.statusText('missed')
                    : lowStock
                    ? theme.statusText('pending')
                    : formTokens.stockColor;
                  const stockBg = outOfStock
                    ? theme.statusTint('missed')
                    : lowStock
                    ? theme.statusTint('pending')
                    : formTokens.stockBg;
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
                      style={isLast ? undefined : { borderBottomWidth: 1, borderBottomColor: theme.alarms.card.rowDivider }}
                    >
                      <View
                        className="items-center justify-center rounded-2xl"
                        style={{
                          width: 44,
                          height: 44,
                          backgroundColor: formTokens.badgeBg,
                        }}
                      >
                        <FormIcon color={formTokens.iconColor} size={22} strokeWidth={2.2} />
                      </View>
                      <View className="flex-1">
                        <Text
                          className="text-[16px] font-bold tracking-tight"
                          numberOfLines={1}
                          style={{ color: theme.alarms.card.title }}
                        >
                          {medication.name}
                        </Text>
                        <Text
                          className="text-[13px] mt-0.5"
                          numberOfLines={1}
                          style={{ color: theme.alarms.card.subtitle }}
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
                            <Text numberOfLines={1} style={{ color: theme.alarms.card.subtitle, fontSize: 10.5, fontWeight: '500' }}>
                              {t('medications.remaining')}
                            </Text>
                          </View>
                        )}
                        <ChevronRight color={theme.alarms.card.chevron} size={16} strokeWidth={2.4} />
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
