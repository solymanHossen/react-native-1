import { FlashList } from '@shopify/flash-list';
import { Camera, Check, Clock, Moon, Nfc, Phone, ShieldAlert, Sun, Sunrise, Sunset, Trash2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LargeTextButton } from '../components/ui';
import {
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

function formatTimeLabel(timeUtc: string): string {
  const [hours, minutes] = timeUtc.split(':').map(Number);
  const period = hours >= 12 ? 'PM' : 'AM';
  const displayHour = hours % 12 === 0 ? 12 : hours % 12;
  return `${displayHour}:${minutes.toString().padStart(2, '0')} ${period}`;
}

interface TimeSlot {
  node: TimeNode;
  timeUtc: string;
  mealRelation: MealRelation;
  labelKey: TranslationKey;
  icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
  /** Each slot gets its own shade from the app's brand (pomegranate) family
   * (not a repeat of the single action color) — a light-to-dark progression
   * that actually tracks the time of day, so the four chips read as
   * genuinely different choices at a glance instead of four identical
   * pills. White text/icon on every one is intentional: each shade was
   * picked to clear 4.5:1 contrast with white, the same bar every other
   * status/action color in this app's token file is held to. */
  color: string;
}

const TIME_SLOTS: TimeSlot[] = [
  { node: 'BREAKFAST', timeUtc: '08:00', mealRelation: 'WITH', labelKey: 'alarms.timeMorning', icon: Sunrise, color: '#B62616' },
  { node: 'LUNCH', timeUtc: '13:00', mealRelation: 'WITH', labelKey: 'alarms.timeAfternoon', icon: Sun, color: '#962013' },
  { node: 'DINNER', timeUtc: '20:00', mealRelation: 'WITH', labelKey: 'alarms.timeEvening', icon: Sunset, color: '#6D170D' },
  { node: 'BEDTIME', timeUtc: '22:00', mealRelation: 'WITH', labelKey: 'alarms.timeBedtime', icon: Moon, color: '#240804' },
];

/**
 * The same icon + color every TIME_SLOTS entry uses, keyed by time_node so a
 * saved schedule's card can be colored identically to however it looked when
 * it was added — the "Add a Reminder" picker and "Scheduled Alarms" list
 * read as one coherent feature instead of a colorful picker feeding into a
 * flat gray list. FASTING isn't offered by the picker above (nothing in this
 * screen creates it anymore), but existing schedules from before this
 * redesign can still carry it, so it gets its own entry rather than crashing
 * on a missing lookup.
 */
const TIME_NODE_STYLE: Record<TimeNode, { icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>; color: string }> = {
  BREAKFAST: { icon: Sunrise, color: '#B62616' },
  LUNCH: { icon: Sun, color: '#962013' },
  DINNER: { icon: Sunset, color: '#6D170D' },
  BEDTIME: { icon: Moon, color: '#240804' },
  FASTING: { icon: Clock, color: '#BC2F4B' },
};

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
export default function AlarmsScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [mediusDb, setMediusDb] = useState<MediusDatabase | null>(null);
  const [schedules, setSchedules] = useState<ScheduleWithMedication[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [selectedMedicationId, setSelectedMedicationId] = useState<number | null>(null);
  const [caregiverPhone, setCaregiverPhoneInput] = useState(() => getCaregiverPhone() ?? '');
  const [status, setStatus] = useState<string | null>(null);
  const [caregiverError, setCaregiverError] = useState<string | null>(null);

  const refresh = useCallback(async (database: MediusDatabase) => {
    const [scheduleRows, medicationRows] = await Promise.all([
      database.schedules.listAllWithMedication(),
      database.medications.list(),
    ]);
    setSchedules(scheduleRows);
    setMedications(medicationRows);
  }, []);

  useEffect(() => {
    initializeDatabase().then(async (database) => {
      setMediusDb(database);
      await refresh(database);
    });
  }, [refresh]);

  const selectedMedication = useMemo(
    () => medications.find((medication) => medication.id === selectedMedicationId) ?? null,
    [medications, selectedMedicationId],
  );

  const handleAddReminder = useCallback(
    async (slot: TimeSlot) => {
      if (!mediusDb || !selectedMedication) return;
      await mediusDb.schedules.create({
        medication_id: selectedMedication.id,
        time_utc: slot.timeUtc,
        time_node: slot.node,
        meal_relation: slot.mealRelation,
        dose_quantity: 1,
        days_of_week_mask: 127,
        is_active: true,
      });
      await refresh(mediusDb);
      await rescheduleAllActiveAlarms();
      triggerHaptic('notificationSuccess');
      setSelectedMedicationId(null);
      setStatus(t('alarms.reminderAdded', { name: selectedMedication.name }));
    },
    [mediusDb, refresh, selectedMedication, t],
  );

  const handleToggleActive = useCallback(
    async (schedule: ScheduleWithMedication, nextActive: boolean) => {
      triggerHaptic('selection');
      // Optimistic update — setScheduleActive also has to cancel/reschedule
      // the real notifee trigger, which takes a moment, and the switch
      // shouldn't visibly lag behind the tap that flipped it.
      setSchedules((prev) => prev.map((entry) => (entry.id === schedule.id ? { ...entry, is_active: nextActive } : entry)));
      await setScheduleActive(schedule, nextActive);
      setStatus(
        nextActive
          ? t('alarms.turnedOn', { name: schedule.medicationName })
          : t('alarms.turnedOff', { name: schedule.medicationName }),
      );
    },
    [t],
  );

  const handleSaveCaregiverPhone = useCallback(() => {
    const normalized = normalizeCaregiverPhone(caregiverPhone);
    setCaregiverError(null);
    if (normalized && !isValidCaregiverPhone(normalized)) {
      setCaregiverError(t('alarms.caregiverInvalid'));
      return;
    }
    setCaregiverPhone(normalized);
    setCaregiverPhoneInput(normalized);
    setStatus(normalized ? t('alarms.caregiverSaved') : t('alarms.caregiverCleared'));
    triggerHaptic('notificationSuccess');
  }, [caregiverPhone, t]);

  const handleClearCaregiverPhone = useCallback(() => {
    setCaregiverPhone('');
    setCaregiverPhoneInput('');
    setCaregiverError(null);
    setStatus(t('alarms.caregiverCleared'));
    triggerHaptic('selection');
  }, [t]);

  const savedCaregiverPhone = getCaregiverPhone();
  const maskedCaregiverPhone = savedCaregiverPhone
    ? `${savedCaregiverPhone.slice(0, Math.max(0, savedCaregiverPhone.length - 4)).replace(/\d(?=\d)/g, '•')} ${savedCaregiverPhone.slice(-4)}`
    : null;

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor: theme.colors.canvas }}>
      <View className="border-b px-6 py-6" style={{ borderColor: theme.colors.hairline }}>
        <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
          {t('alarms.title')}
        </Text>
        {status ? (
          <Text className="mt-2 text-caption" style={{ color: theme.statusText('taken') }}>
            {status}
          </Text>
        ) : null}
      </View>

      {/* FlashList, not a ScrollView + .map — a caregiver's schedule list is
          small today, but this is the one list in the app with genuine
          unbounded growth (every medication's every dose time), and
          virtualizing it costs nothing when short while staying flat-cost
          if it grows into the hundreds. */}
      <FlashList
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingHorizontal: 24, paddingVertical: 28 }}
        data={schedules}
        keyExtractor={(schedule) => String(schedule.id)}
        ListHeaderComponent={
          <View className="gap-6" style={{ marginBottom: 20 }}>
            <View
              className="gap-4 rounded-3xl border p-6 shadow-md"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
            >
              <View className="flex-row items-center gap-3">
                <View
                  className="items-center justify-center rounded-2xl"
                  style={{ width: 40, height: 40, backgroundColor: `${theme.action.base}14` }}
                >
                  <ShieldAlert color={theme.action.base} size={20} strokeWidth={2.25} />
                </View>
                <View className="flex-1">
                  <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                    {t('alarms.caregiverSection')}
                  </Text>
                  <Text className="mt-1 text-caption" style={{ color: savedCaregiverPhone ? theme.statusText('taken') : theme.colors.inkMuted }}>
                    {savedCaregiverPhone ? t('alarms.caregiverReady') : t('alarms.caregiverNotConfigured')}
                  </Text>
                </View>
              </View>
              <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
                {t('alarms.caregiverDescription')}
              </Text>
              <TextInput
                value={caregiverPhone}
                onChangeText={setCaregiverPhoneInput}
                placeholder={t('alarms.caregiverPlaceholder')}
                placeholderTextColor={theme.colors.inkMuted}
                keyboardType="phone-pad"
                className="min-h-hit rounded-full border px-6 text-body-lg"
                style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline, color: theme.colors.ink }}
              />
              {caregiverError ? (
                <Text className="text-caption" style={{ color: theme.statusText('missed') }}>
                  {caregiverError}
                </Text>
              ) : null}
              {maskedCaregiverPhone ? (
                <View className="flex-row items-center gap-3 rounded-2xl border px-4 py-3" style={{ borderColor: theme.colors.hairline }}>
                  <Phone color={theme.statusText('taken')} size={18} strokeWidth={2.25} />
                  <View className="flex-1">
                    <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
                      {t('alarms.caregiverSavedContact')}
                    </Text>
                    <Text className="text-body-lg" style={{ color: theme.colors.ink, fontWeight: '600' }}>
                      {maskedCaregiverPhone}
                    </Text>
                  </View>
                  <Pressable
                    onPress={handleClearCaregiverPhone}
                    accessibilityRole="button"
                    accessibilityLabel={t('alarms.clearCaregiverAccessibility')}
                    className="min-h-hit min-w-hit items-center justify-center"
                  >
                    <Trash2 color={theme.colors.inkMuted} size={19} />
                  </Pressable>
                </View>
              ) : null}
              <LargeTextButton label={t('alarms.saveCaregiverNumber')} variant="secondary" onPress={handleSaveCaregiverPhone} />
            </View>

            <View
              className="gap-4 rounded-3xl border p-6 shadow-md"
              style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
            >
              <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                {t('alarms.addReminder')}
              </Text>
              {medications.length === 0 ? (
                <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
                  {t('alarms.noMedicationsYet')}
                </Text>
              ) : (
                <>
                  <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
                    {t('alarms.pickMedication')}
                  </Text>
                  <View className="flex-row flex-wrap gap-2.5">
                    {medications.map((medication) => {
                      const selected = medication.id === selectedMedicationId;
                      return (
                        <Pressable
                          key={medication.id}
                          onPress={() => setSelectedMedicationId(selected ? null : medication.id)}
                          accessibilityRole="button"
                          accessibilityState={{ selected }}
                          className="min-h-hit flex-row items-center gap-1.5 rounded-full border px-4 py-2"
                          style={{
                            backgroundColor: selected ? theme.action.base : theme.colors.surface,
                            borderColor: selected ? theme.action.base : theme.colors.hairline,
                          }}
                        >
                          {selected ? <Check color={theme.action.ink} size={15} strokeWidth={2.5} /> : null}
                          <Text
                            className="text-caption"
                            numberOfLines={1}
                            style={{ color: selected ? theme.action.ink : theme.colors.ink, fontWeight: '600' }}
                          >
                            {medication.name}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>

                  {selectedMedication ? (
                    <View className="gap-2.5 border-t pt-4" style={{ borderColor: theme.colors.hairline }}>
                      <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
                        {t('alarms.pickTime')}
                      </Text>
                      <View className="gap-2.5">
                        {TIME_SLOTS.map((slot) => {
                          const SlotIcon = slot.icon;
                          return (
                            <Pressable
                              key={slot.node}
                              onPress={() => handleAddReminder(slot)}
                              accessibilityRole="button"
                              className="min-h-hit flex-row items-center gap-3 rounded-2xl px-5 py-4"
                              style={{ backgroundColor: slot.color }}
                            >
                              <View
                                className="items-center justify-center rounded-full"
                                style={{ width: 40, height: 40, backgroundColor: 'rgba(255,255,255,0.2)' }}
                              >
                                <SlotIcon color="#FFFFFF" size={20} strokeWidth={2.25} />
                              </View>
                              <Text className="flex-1 text-body-lg" style={{ color: '#FFFFFF', fontWeight: '700' }}>
                                {t(slot.labelKey)}
                              </Text>
                              <Text className="text-body-lg" style={{ color: 'rgba(255,255,255,0.85)' }}>
                                {formatTimeLabel(slot.timeUtc)}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </View>
                    </View>
                  ) : null}
                </>
              )}
            </View>

            <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
              {t('alarms.scheduledAlarms')}
            </Text>
          </View>
        }
        ListEmptyComponent={
          <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
            {t('alarms.noSchedulesYet')}
          </Text>
        }
        renderItem={({ item: schedule }) => {
          const nodeStyle = TIME_NODE_STYLE[schedule.time_node];
          const NodeIcon = nodeStyle.icon;
          const confirmTint = schedule.nfcTagUid ? theme.statusTint('taken') : theme.statusTint('pending');
          const confirmText = schedule.nfcTagUid ? theme.statusText('taken') : theme.statusText('pending');
          return (
            <View
              className="flex-row items-start gap-4 rounded-3xl border p-5"
              style={{ marginBottom: 16, backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
            >
              {/* Colored to match whichever time-of-day pill this schedule
                  was created from (see TIME_NODE_STYLE) — the badge goes
                  neutral gray when paused instead of dimming the whole card,
                  so the medication name and dose stay fully legible even for
                  a reminder that's currently off. */}
              <View
                className="items-center justify-center rounded-2xl"
                style={{ width: 44, height: 44, backgroundColor: schedule.is_active ? nodeStyle.color : theme.colors.hairline }}
              >
                <NodeIcon color={schedule.is_active ? '#FFFFFF' : theme.colors.inkMuted} size={22} strokeWidth={2.25} />
              </View>
              <View className="flex-1 gap-1.5">
                <Text className="text-body-lg" numberOfLines={1} style={{ color: theme.colors.ink, fontWeight: '600' }}>
                  {schedule.medicationName}
                </Text>
                <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                  {t('alarms.doseAt', {
                    quantity: schedule.dose_quantity,
                    form: schedule.medicationForm,
                    time: formatTimeLabel(schedule.time_utc),
                  })}
                </Text>
                <View className="flex-row flex-wrap items-center gap-1.5">
                  <View className="flex-row items-center gap-1 rounded-full px-2.5 py-1" style={{ backgroundColor: confirmTint }}>
                    {schedule.nfcTagUid ? (
                      <Nfc color={confirmText} size={12} strokeWidth={2.5} />
                    ) : (
                      <Camera color={confirmText} size={12} strokeWidth={2.5} />
                    )}
                    <Text className="text-caption" numberOfLines={1} style={{ color: confirmText }}>
                      {schedule.nfcTagUid ? t('alarms.nfcRegistered') : t('alarms.nfcFallback')}
                    </Text>
                  </View>
                  {!schedule.is_active ? (
                    <View className="rounded-full px-2.5 py-1" style={{ backgroundColor: theme.colors.hairline }}>
                      <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
                        {t('alarms.off')}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
              {/* A real on/off switch, not just a "delete" option — turning an
                  alarm off has to be reversible and has to actually cancel the
                  live notification, not merely hide the row (see
                  setScheduleActive's own doc comment for why). */}
            <Switch
              className="self-center"
              value={schedule.is_active}
              onValueChange={(next) => handleToggleActive(schedule, next)}
              trackColor={{ false: theme.colors.hairline, true: theme.action.base }}
              thumbColor="#FFFFFF"
              accessibilityLabel={
                schedule.is_active
                  ? t('alarms.turnOffAccessibility', { name: schedule.medicationName })
                  : t('alarms.turnOnAccessibility', { name: schedule.medicationName })
              }
            />
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}
