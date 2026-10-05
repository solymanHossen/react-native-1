import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LargeTextButton } from '../components/ui';
import { getCaregiverPhone, rescheduleAllActiveAlarms, setCaregiverPhone, triggerAlarmNow } from '../alarms';
import { initializeDatabase, type MediusDatabase } from '../db';
import type { ScheduleWithMedication } from '../db/types';
import { useTheme } from '../theme/useTheme';

/** Shaped like a real NTAG213 UID (7 bytes, NXP manufacturer prefix) so the demo reads correctly — there's no physical tag behind it, so NFC verification can only be exercised with real hardware. */
const DEMO_NFC_UID = '04A1B2C3D4E5F6';

/**
 * Management/demo screen for the alarm engine — same "no live backing
 * feature, just a verification surface" convention as DrugLabScreen. Creates
 * a real medication + schedule (so the full DB → scheduler → AlarmScreen
 * pipeline is exercised, not a mock), and exposes "Trigger Now" to fire the
 * full-screen alarm immediately instead of waiting for its real time.
 */
export default function AlarmsScreen() {
  const theme = useTheme();
  const [mediusDb, setMediusDb] = useState<MediusDatabase | null>(null);
  const [schedules, setSchedules] = useState<ScheduleWithMedication[]>([]);
  const [caregiverPhone, setCaregiverPhoneInput] = useState(() => getCaregiverPhone() ?? '');
  const [status, setStatus] = useState<string | null>(null);

  const refresh = useCallback(async (database: MediusDatabase) => {
    setSchedules(await database.schedules.listActiveWithMedication());
  }, []);

  useEffect(() => {
    initializeDatabase().then(async (database) => {
      setMediusDb(database);
      await refresh(database);
    });
  }, [refresh]);

  const handleCreateDemoAlarm = useCallback(async () => {
    if (!mediusDb) return;
    const medication = await mediusDb.medications.create({
      name: 'Demo Alarm Tablet',
      generic_id: null,
      strength: '500mg',
      form: 'tablet',
      current_stock: 30,
      refill_threshold: 5,
      expiry_date: null,
      instructions: 'Created for testing the alarm engine.',
      nfc_tag_uid: DEMO_NFC_UID,
    });
    const now = new Date();
    await mediusDb.schedules.create({
      medication_id: medication.id,
      time_utc: `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`,
      time_node: 'FASTING',
      meal_relation: 'WITH',
      dose_quantity: 1,
      days_of_week_mask: 127,
      is_active: true,
    });
    await refresh(mediusDb);
    await rescheduleAllActiveAlarms();
    setStatus('Demo alarm created and scheduled for its next occurrence.');
  }, [mediusDb, refresh]);

  const handleTriggerNow = useCallback(async (schedule: ScheduleWithMedication) => {
    await triggerAlarmNow(schedule);
  }, []);

  const handleSaveCaregiverPhone = useCallback(() => {
    setCaregiverPhone(caregiverPhone);
    setStatus(caregiverPhone.trim() ? 'Caregiver number saved.' : 'Caregiver number cleared.');
  }, [caregiverPhone]);

  return (
    <SafeAreaView className="flex-1" edges={['left', 'right']} style={{ backgroundColor: theme.colors.canvas }}>
      <View className="border-b px-6 py-6" style={{ borderColor: theme.colors.hairline }}>
        <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
          Medication Alarms
        </Text>
        {status ? (
          <Text className="mt-2 text-caption" style={{ color: theme.statusText('taken') }}>
            {status}
          </Text>
        ) : null}
      </View>

      <ScrollView className="flex-1" contentContainerClassName="gap-7 px-6 py-7" showsVerticalScrollIndicator={false}>
        <View className="gap-3">
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            Caregiver Escalation
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            If an alarm goes unconfirmed for 15 minutes, this number opens a pre-filled SMS alert on this phone — nothing sends automatically or silently.
          </Text>
          <TextInput
            value={caregiverPhone}
            onChangeText={setCaregiverPhoneInput}
            placeholder="+1 555 0100"
            placeholderTextColor={theme.colors.inkMuted}
            keyboardType="phone-pad"
            className="min-h-hit rounded-full border px-6 text-body-lg"
            style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
          />
          <LargeTextButton label="Save Caregiver Number" variant="secondary" onPress={handleSaveCaregiverPhone} />
        </View>

        <View className="gap-4">
          <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
            Scheduled Alarms
          </Text>
          <LargeTextButton label="Create Demo Alarm (with NFC tag)" onPress={handleCreateDemoAlarm} />
          {schedules.length === 0 ? (
            <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
              No active schedules yet.
            </Text>
          ) : (
            schedules.map((schedule) => (
              <View
                key={schedule.id}
                className="gap-3 rounded-3xl border p-5"
                style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
              >
                <Text className="text-body-lg" style={{ color: theme.colors.ink, fontWeight: '600' }}>
                  {schedule.medicationName}
                </Text>
                <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                  {schedule.dose_quantity} {schedule.medicationForm} at {schedule.time_utc}
                  {schedule.nfcTagUid ? ' · NFC tag registered' : ' · No NFC tag — vision fallback only'}
                </Text>
                <LargeTextButton label="Trigger Now (Demo)" variant="secondary" onPress={() => handleTriggerNow(schedule)} />
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
