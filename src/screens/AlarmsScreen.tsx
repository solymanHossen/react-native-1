import { FlashList } from '@shopify/flash-list';
import { Check, Moon, Pill, ShieldAlert, Sun, Sunrise, Sunset } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useState, type ComponentType } from 'react';
import { Pressable, Switch, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LargeTextButton } from '../components/ui';
import { getCaregiverPhone, rescheduleAllActiveAlarms, setCaregiverPhone, setScheduleActive } from '../alarms';
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
}

const TIME_SLOTS: TimeSlot[] = [
  { node: 'BREAKFAST', timeUtc: '08:00', mealRelation: 'WITH', labelKey: 'alarms.timeMorning', icon: Sunrise },
  { node: 'LUNCH', timeUtc: '13:00', mealRelation: 'WITH', labelKey: 'alarms.timeAfternoon', icon: Sun },
  { node: 'DINNER', timeUtc: '20:00', mealRelation: 'WITH', labelKey: 'alarms.timeEvening', icon: Sunset },
  { node: 'BEDTIME', timeUtc: '22:00', mealRelation: 'WITH', labelKey: 'alarms.timeBedtime', icon: Moon },
];

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
    setCaregiverPhone(caregiverPhone);
    setStatus(caregiverPhone.trim() ? t('alarms.caregiverSaved') : t('alarms.caregiverCleared'));
  }, [caregiverPhone, t]);

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
                <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                  {t('alarms.caregiverSection')}
                </Text>
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
                          className="min-h-hit flex-row items-center gap-2 rounded-full border px-5"
                          style={{
                            backgroundColor: selected ? theme.action.base : theme.colors.surface,
                            borderColor: selected ? theme.action.base : theme.colors.hairline,
                          }}
                        >
                          {selected ? <Check color={theme.action.ink} size={16} strokeWidth={2.5} /> : null}
                          <Text
                            className="text-body-lg"
                            numberOfLines={1}
                            style={{ color: selected ? theme.action.ink : theme.colors.ink }}
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
                      <View className="flex-row flex-wrap gap-2.5">
                        {TIME_SLOTS.map((slot) => {
                          const SlotIcon = slot.icon;
                          return (
                            <Pressable
                              key={slot.node}
                              onPress={() => handleAddReminder(slot)}
                              accessibilityRole="button"
                              className="min-h-hit flex-row items-center gap-2 rounded-full border px-5"
                              style={{ backgroundColor: theme.colors.surface, borderColor: theme.colors.hairline }}
                            >
                              <SlotIcon color={theme.action.base} size={17} strokeWidth={2.25} />
                              <Text className="text-body-lg" style={{ color: theme.colors.ink }}>
                                {t(slot.labelKey)} · {formatTimeLabel(slot.timeUtc)}
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
        renderItem={({ item: schedule }) => (
          <View
            className="flex-row items-center gap-4 rounded-3xl border p-5"
            style={{
              marginBottom: 16,
              backgroundColor: theme.colors.elevated,
              borderColor: theme.colors.hairline,
              opacity: schedule.is_active ? 1 : 0.55,
            }}
          >
            <View
              className="items-center justify-center rounded-2xl"
              style={{ width: 44, height: 44, backgroundColor: `${theme.action.base}14` }}
            >
              <Pill color={theme.action.base} size={22} strokeWidth={2.25} />
            </View>
            <View className="flex-1 gap-1">
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
              <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
                {schedule.nfcTagUid ? t('alarms.nfcRegistered') : t('alarms.nfcFallback')}
                {schedule.is_active ? '' : ` · ${t('alarms.off')}`}
              </Text>
            </View>
            {/* A real on/off switch, not just a "delete" option — turning an
                alarm off has to be reversible and has to actually cancel the
                live notification, not merely hide the row (see
                setScheduleActive's own doc comment for why). */}
            <Switch
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
        )}
      />
    </SafeAreaView>
  );
}
