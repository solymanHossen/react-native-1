import { BookOpen, Calendar, ChevronRight, Clock, Plus, Search, TriangleAlert } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  ManualMedicationSheet,
  type ManualMedicationInput,
  type ManualMedicationSaveResult,
  type ManualMedicationSheetRef,
} from '../components/medications/ManualMedicationSheet';
import { MedicationDetailsSheet, type MedicationDetailsSheetRef } from '../components/medications/MedicationDetailsSheet';
import { MedicationHistorySheet, type MedicationHistorySheetRef } from '../components/medications/MedicationHistorySheet';
import { DOSAGE_FORM_ASSETS } from '../components/dashboard';
import { cancelAlarm, rescheduleAllActiveAlarms } from '../alarms';
import { DuplicateMedicationError, initializeDatabase, type DrugConflict, type DrugSearchResult, type Medication, type MediusDatabase, type Schedule } from '../db';
import { useTranslation } from '../i18n';
import { triggerHaptic } from '../lib/haptics';
import type { SeverityKey } from '../theme/tokens';
import { toast } from '../store';
import { useTheme } from '../theme/useTheme';

/**
 * Maps the drug directory's 3-level interaction severity onto the 5-step red
 * scale by name where they align; `contraindicated` (the hard-block tier, per
 * ConflictService's doc comment) gets the scale's most intense step so it
 * reads as strictly worse than `severe`, which the old 2-color mapping (both
 * rendered as plain `status.missed`) couldn't distinguish.
 */
const CONFLICT_SEVERITY: Record<DrugConflict['severity'], SeverityKey> = {
  moderate: 'moderate',
  severe: 'severe',
  contraindicated: 'critical',
};

const SEVERITY_RANK: DrugConflict['severity'][] = ['contraindicated', 'severe', 'moderate'];

function worstConflictSeverity(conflicts: DrugConflict[]): DrugConflict['severity'] {
  return SEVERITY_RANK.find((level) => conflicts.some((c) => c.severity === level)) ?? 'moderate';
}

function MedicationRow({
  medication,
  schedules = [],
  onRemove: _onRemove,
  onOpen,
}: {
  medication: Medication;
  schedules?: Schedule[];
  onRemove?: () => void;
  onOpen: () => void;
}) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const { t } = useTranslation();

  const isOutOfStock = medication.current_stock <= 0;
  const isLowStock = !isOutOfStock && medication.current_stock <= medication.refill_threshold;

  // Meal relation: from active schedule or default
  const mealRelation = schedules[0]?.meal_relation ?? 'AFTER';
  const mealRelationLabel =
    mealRelation === 'BEFORE'
      ? t('alarms.mealRelation.BEFORE')
      : mealRelation === 'WITH'
        ? t('alarms.mealRelation.WITH')
        : mealRelation === 'AFTER'
          ? t('alarms.mealRelation.AFTER')
          : t('alarms.mealAfter');

  // Frequency count based on schedules
  const frequencyLabel =
    schedules.length > 0
      ? t('medications.timesPerDay', { count: schedules.length })
      : t('medications.noSchedulesYet');

  const asset = DOSAGE_FORM_ASSETS[medication.form] ?? DOSAGE_FORM_ASSETS.capsule;

  return (
    <Pressable
      onPress={onOpen}
      onLongPress={() => {
        triggerHaptic('impactMedium');
        onOpen();
      }}
      accessibilityRole="button"
      accessibilityLabel={t('medications.detailsAccessibility', { name: medication.name })}
      accessibilityHint={t('medications.detailsLongPressHint')}
      className="rounded-3xl border"
      style={{
        padding: 18,
        backgroundColor: theme.colors.elevated,
        borderColor: isDark ? theme.colors.hairline : '#EDF2F7',
        boxShadow: [
          { offsetX: 0, offsetY: 2, blurRadius: 10, color: 'rgba(50, 75, 120, 0.05)' },
        ],
      }}
    >
      {/* ── Top Row: 3D Form Icon + Title/Strength/Form Badge + Chevron ── */}
      <View className="flex-row items-center gap-3.5">
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 20,
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Image
            source={asset}
            style={{ width: 42, height: 42 }}
            resizeMode="contain"
          />
        </View>

        <View className="flex-1 gap-1">
          <Text
            className="font-extrabold"
            numberOfLines={1}
            style={{ color: theme.colors.ink, fontSize: 20, lineHeight: 25 }}
          >
            {medication.strength ? `${medication.name} · ${medication.strength}` : medication.name}
          </Text>

          <View
            style={{
              alignSelf: 'flex-start',
              paddingHorizontal: 12,
              paddingVertical: 3.5,
              borderRadius: 9999,
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.20)' : '#EEF4FF',
            }}
          >
            <Text
              style={{
                color: isDark ? '#93C5FD' : '#3B82F6',
                fontSize: 13,
                fontWeight: '700',
              }}
            >
              {t(`medications.forms.${medication.form}` as never)}
            </Text>
          </View>
        </View>

        <ChevronRight color={theme.colors.inkMuted} size={22} strokeWidth={2.2} />
      </View>

      {/* ── Hairline Divider ── */}
      <View
        style={{
          height: 1,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.05)',
          marginVertical: 14,
        }}
      />

      {/* ── Bottom Strip: Meal relation | Frequency | Active Status ── */}
      <View className="flex-row items-center justify-between gap-2">
        <View className="flex-row items-center gap-2 flex-1">
          <View className="flex-row items-center gap-1.5 flex-shrink">
            <Clock size={16} color={theme.colors.inkSecondary} strokeWidth={2.2} />
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14.5,
                color: theme.colors.inkSecondary,
                fontWeight: '600',
              }}
            >
              {mealRelationLabel}
            </Text>
          </View>

          <View
            style={{
              width: 1,
              height: 14,
              backgroundColor: isDark ? 'rgba(255, 255, 255, 0.14)' : '#CBD5E1',
              marginHorizontal: 3,
            }}
          />

          <View className="flex-row items-center gap-1.5 flex-shrink">
            <Calendar size={16} color={theme.colors.inkSecondary} strokeWidth={2.2} />
            <Text
              numberOfLines={1}
              style={{
                fontSize: 14.5,
                color: theme.colors.inkSecondary,
                fontWeight: '600',
              }}
            >
              {frequencyLabel}
            </Text>
          </View>
        </View>

        {/* Status Pill */}
        {isOutOfStock ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5.5,
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 9999,
              backgroundColor: isDark ? 'rgba(239, 68, 68, 0.20)' : '#FEE2E2',
            }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#EF4444' }} />
            <Text style={{ color: '#EF4444', fontSize: 13, fontWeight: '700' }}>
              {t('medications.outOfStock')}
            </Text>
          </View>
        ) : isLowStock ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5.5,
              paddingHorizontal: 12,
              paddingVertical: 5,
              borderRadius: 9999,
              backgroundColor: isDark ? 'rgba(245, 158, 11, 0.20)' : '#FEF3C7',
            }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#F59E0B' }} />
            <Text style={{ color: '#F59E0B', fontSize: 13, fontWeight: '700' }}>
              {t('medications.detailsStockUnits', { count: medication.current_stock, unit: t('medications.detailsStockUnit') })}
            </Text>
          </View>
        ) : (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 5.5,
              paddingHorizontal: 13,
              paddingVertical: 5,
              borderRadius: 9999,
              backgroundColor: isDark ? 'rgba(16, 185, 129, 0.18)' : '#DCFCE7',
            }}
          >
            <View style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: '#16A34A' }} />
            <Text style={{ color: '#16A34A', fontSize: 13, fontWeight: '700' }}>
              {t('medications.activeStatus')}
            </Text>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function SearchResultRow({
  result,
  adding,
  onAdd,
}: {
  result: DrugSearchResult;
  adding: boolean;
  onAdd: () => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();

  return (
    <View
      className="flex-row items-center gap-4 rounded-3xl border"
      style={{ padding: 18, backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
    >
      <View className="flex-1">
        <Text className="font-bold" numberOfLines={1} style={{ color: theme.colors.ink, fontSize: 18.5 }}>
          {result.brand_name} {result.strength}
        </Text>
        <Text className="mt-0.5 font-medium" numberOfLines={1} style={{ color: theme.colors.inkSecondary, fontSize: 14.5 }}>
          {result.generic_name}
        </Text>
      </View>
      {adding ? (
        <ActivityIndicator color={theme.action.base} />
      ) : (
        <Pressable
          onPress={onAdd}
          accessibilityRole="button"
          accessibilityLabel={t('medications.addResultAccessibility', { name: result.brand_name })}
          className="min-h-hit min-w-hit items-center justify-center rounded-full"
          style={{ width: 46, height: 46, backgroundColor: `${theme.action.base}14` }}
        >
          <Plus color={theme.action.base} size={22} strokeWidth={2.5} />
        </Pressable>
      )}
    </View>
  );
}

function ManualMedicationButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const { t } = useTranslation();
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View style={pressStyle}>
      <Pressable
        onPressIn={() => {
          scale.value = withSpring(0.98, { damping: 16, stiffness: 220, mass: 0.5 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 16, stiffness: 220, mass: 0.5 });
        }}
        onPress={() => {
          triggerHaptic('impactLight');
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={t('medications.addManually')}
        accessibilityHint={t('medications.addManuallyHint')}
        className="min-h-hit flex-row items-center gap-4 rounded-3xl border"
        style={{
          padding: 18,
          backgroundColor: theme.colors.elevated,
          borderColor: isDark ? theme.colors.hairline : '#EDF2F7',
          boxShadow: [
            { offsetX: 0, offsetY: 2, blurRadius: 10, color: 'rgba(50, 75, 120, 0.05)' },
          ],
        }}
      >
        <View
          style={{
            width: 60,
            height: 60,
            borderRadius: 20,
            backgroundColor: isDark ? 'rgba(59, 130, 246, 0.16)' : '#EFF6FF',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Plus color={isDark ? '#60A5FA' : '#365476'} size={28} strokeWidth={2.5} />
        </View>
        <View className="flex-1 gap-1">
          <Text className="font-extrabold" numberOfLines={2} style={{ color: theme.colors.ink, fontSize: 18.5 }}>
            {t('medications.addManually')}
          </Text>
          <Text className="font-medium" numberOfLines={2} style={{ color: theme.colors.inkSecondary, fontSize: 14.5 }}>
            {t('medications.addManuallyHint')}
          </Text>
        </View>
        <ChevronRight color={theme.colors.inkMuted} size={22} strokeWidth={2.2} />
      </Pressable>
    </Animated.View>
  );
}

/**
 * Your current medications (added here or via Scan Rx), plus a search to add
 * a new one from the on-device drug directory. Adding a drug immediately
 * checks it against everything on an active schedule — `checkDrugConflicts`
 * only looks at actively-scheduled medications, not just "anything in your
 * list", so this is a real check against what you're actually taking, not a
 * fixed demo pairing. Scheduling *when* to take a newly-added medication is
 * the Alarms tab's job, not this screen's — keeping "what you take" and
 * "when you take it" as two separate, single-purpose screens rather than
 * duplicating a time picker here.
 */
export default function DrugLabScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const [mediusDb, setMediusDb] = useState<MediusDatabase | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const [medications, setMedications] = useState<Medication[]>([]);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DrugSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [addingRowid, setAddingRowid] = useState<number | null>(null);
  const [addedName, setAddedName] = useState<string | null>(null);
  const [addedConflicts, setAddedConflicts] = useState<DrugConflict[] | null>(null);
  const [duplicateName, setDuplicateName] = useState<string | null>(null);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const manualSheetRef = useRef<ManualMedicationSheetRef>(null);
  const detailsSheetRef = useRef<MedicationDetailsSheetRef>(null);
  const historySheetRef = useRef<MedicationHistorySheetRef>(null);

  const [schedulesByMedication, setSchedulesByMedication] = useState<Map<number, Schedule[]>>(new Map());

  const refreshMedications = useCallback(async (database: MediusDatabase) => {
    const [meds, activeSchedules] = await Promise.all([
      database.medications.list(),
      database.schedules.listActiveWithMedication(),
    ]);
    const scheduleMap = new Map<number, Schedule[]>();
    for (const s of activeSchedules) {
      const list = scheduleMap.get(s.medication_id) ?? [];
      list.push(s);
      scheduleMap.set(s.medication_id, list);
    }
    setMedications(meds);
    setSchedulesByMedication(scheduleMap);
  }, []);

  useEffect(() => {
    initializeDatabase()
      .then(async (database) => {
        setMediusDb(database);
        await refreshMedications(database);
      })
      .catch((error: unknown) => setInitError(error instanceof Error ? error.message : String(error)));
  }, [refreshMedications]);

  const runSearch = useCallback(
    async (text: string) => {
      setQuery(text);
      if (!mediusDb || !text.trim()) {
        setResults([]);
        return;
      }
      setSearching(true);
      try {
        // Re-fetches the live database rather than using the `mediusDb` closure —
        // if a vault restore happened while this screen stayed mounted, `mediusDb`
        // would still point at the connection that restore just closed.
        const database = await initializeDatabase();
        setResults(await database.drugSearch.search(text, 10));
      } finally {
        setSearching(false);
      }
    },
    [mediusDb],
  );

  const addMedication = useCallback(
    async (result: DrugSearchResult) => {
      if (!mediusDb) return;
      setAddingRowid(result.rowid);
      setAddedName(null);
      setAddedConflicts(null);
      setDuplicateName(null);
      try {
        const database = await initializeDatabase();
        await database.medications.create({
          name: result.brand_name,
          generic_id: result.rowid,
          strength: result.strength,
          form: 'tablet',
          current_stock: 30,
          refill_threshold: 5,
          expiry_date: null,
          instructions: null,
          nfc_tag_uid: null,
          photo_uri: null,
          course_start_date: null,
          course_end_date: null,
        });
        const conflicts = await database.conflicts.checkDrugConflicts(result.generic_name);
        if (conflicts.length > 0) {
          toast.warning(t('medications.addedConflictsFound', { name: result.brand_name }), result.brand_name);
        } else {
          toast.success(t('medications.addedNoConflicts', { name: result.brand_name }), result.brand_name);
        }
        setAddedName(result.brand_name);
        setAddedConflicts(conflicts);
        setQuery('');
        setResults([]);
        await refreshMedications(database);
      } catch (error) {
        if (error instanceof DuplicateMedicationError) {
          toast.warning(t('medications.alreadyAdded', { name: result.brand_name }));
          setDuplicateName(result.brand_name);
          return;
        }
        throw error;
      } finally {
        setAddingRowid(null);
      }
    },
    [mediusDb, refreshMedications],
  );

  // No `generic_id` to check interactions against here — a manually-typed
  // name isn't resolved to a drug-directory entry, so `checkDrugConflicts`
  // (keyed on generic name) can't run meaningfully. Claiming "no
  // interactions found" when no check actually ran would be a false
  // reassurance in a medical app, so this path gets its own honest
  // confirmation message instead of reusing the search-add conflict panel.
  // Success/duplicate feedback lives inside the wizard's own Review/Added
  // steps now (see ManualMedicationSheet) rather than an external banner —
  // this just reports back whether the write succeeded.
  const addManualMedication = useCallback(
    async (input: ManualMedicationInput): Promise<ManualMedicationSaveResult> => {
      if (!mediusDb) return { ok: false };
      try {
        const database = await initializeDatabase();
        const medication = await database.medications.create({
          name: input.name,
          generic_id: null,
          strength: input.strength,
          form: input.form,
          current_stock: 30,
          refill_threshold: 5,
          expiry_date: null,
          instructions: null,
          nfc_tag_uid: null,
          photo_uri: null,
          course_start_date: input.courseStartDate,
          course_end_date: input.courseEndDate,
        });
        if (input.setReminder) {
          // A sensible default (morning, after food, every day) rather than
          // making the wizard collect a time too — Alarms already lets this
          // be refined once the medication exists.
          await database.schedules.create({
            medication_id: medication.id,
            time_utc: '08:00',
            time_node: 'BREAKFAST',
            meal_relation: 'AFTER',
            dose_quantity: 1,
            days_of_week_mask: 127,
            is_active: true,
            title: null,
          });
          await rescheduleAllActiveAlarms();
        }
        setQuery('');
        setResults([]);
        await refreshMedications(database);
        return { ok: true };
      } catch (error) {
        if (error instanceof DuplicateMedicationError) {
          return { ok: false, reason: 'duplicate' };
        }
        throw error;
      }
    },
    [mediusDb, refreshMedications],
  );

  const removeMedication = useCallback(
    (medication: Medication) => {
      Alert.alert(t('medications.removeConfirmTitle', { name: medication.name }), t('medications.removeConfirmBody'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('medications.remove'),
          style: 'destructive',
          onPress: async () => {
            if (!mediusDb) return;
            setRemoveError(null);
            try {
              const database = await initializeDatabase();
              const schedulesToCancel = await database.schedules.listForMedication(medication.id);
              await database.medications.archive(medication.id);
              // `archive` only deactivates schedules in the DB — the real notifee
              // trigger for each one has to be cancelled separately, or it keeps
              // ringing for a medication that's no longer in the active list.
              await Promise.all(schedulesToCancel.map((schedule) => cancelAlarm(schedule.id)));
              await refreshMedications(database);
              toast.info(t('medications.removedSuccess', { name: medication.name }));
            } catch (error) {
              const errMsg = t('medications.removeFailed', { error: error instanceof Error ? error.message : String(error) });
              setRemoveError(errMsg);
              toast.error(errMsg);
            }
          },
        },
      ]);
    },
    [mediusDb, refreshMedications, t],
  );

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ flex: 1, backgroundColor: theme.colors.canvas }}>
      {/* ── Screen Header: Title + Subtitle + 3D Capsule Orb ── */}
      <View className="flex-row items-center justify-between px-5 pt-3 pb-1">
        <View className="gap-0.5">
          <Text className="font-black" style={{ color: theme.colors.ink, fontSize: 32, lineHeight: 38, letterSpacing: -0.5 }}>
            {t('medications.title')}
          </Text>
          <Text className="font-semibold" style={{ color: theme.colors.inkSecondary, fontSize: 15.5 }}>
            {t('medications.subtitle')}
          </Text>
        </View>

        {/* Floating 3D capsule orb on top right */}
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.20)' : '#DBEAFE',
            borderWidth: 1.5,
            borderColor: theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.40)' : 'rgba(191, 219, 254, 0.85)',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: [
              { offsetX: 0, offsetY: 2, blurRadius: 10, color: 'rgba(59, 130, 246, 0.15)' },
            ],
          }}
        >
          <Image
            source={DOSAGE_FORM_ASSETS.capsule}
            style={{
              width: 40,
              height: 40,
            }}
            resizeMode="contain"
          />
        </View>
      </View>

      <ScrollView
        className="flex-1"
        style={{ flex: 1 }}
        contentContainerClassName="gap-5 px-5 pt-3"
        contentContainerStyle={{ paddingBottom: 130 }}
        showsVerticalScrollIndicator={false}
      >
        {initError ? (
          <Text className="text-body-lg" style={{ color: theme.statusText('missed') }}>
            {t('medications.databaseFailed', { error: initError })}
          </Text>
        ) : !mediusDb ? (
          <View className="flex-row items-center gap-4">
            <ActivityIndicator color={theme.action.base} />
            <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
              {t('medications.openingDatabase')}
            </Text>
          </View>
        ) : (
          <>
            {/* ── Section: Your Medications (+ Add New Button) ── */}
            <View className="gap-3.5">
              <View className="flex-row items-center justify-between">
                <Text className="font-extrabold" style={{ color: theme.colors.ink, fontSize: 22 }}>
                  {t('medications.yourMedications')}
                </Text>

                {/* + Add New Button */}
                <Pressable
                  onPress={() => {
                    triggerHaptic('impactLight');
                    manualSheetRef.current?.present();
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={t('medications.addNew')}
                  className="flex-row items-center gap-2 rounded-full"
                  style={{
                    backgroundColor: theme.mode === 'dark' ? '#2563EB' : '#365476',
                    paddingHorizontal: 20,
                    paddingVertical: 10.5,
                    minHeight: 46,
                    boxShadow: [
                      { offsetX: 0, offsetY: 3, blurRadius: 10, color: 'rgba(54, 84, 118, 0.30)' },
                    ],
                  }}
                >
                  <Plus size={18} color="#FFFFFF" strokeWidth={2.8} />
                  <Text style={{ color: '#FFFFFF', fontSize: 15.5, fontWeight: '800' }}>
                    {t('medications.addNew')}
                  </Text>
                </Pressable>
              </View>

              {medications.length === 0 ? (
                <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
                  {t('medications.noMedicationsYet')}
                </Text>
              ) : (
                medications.map((medication) => (
                  <MedicationRow
                    key={medication.id}
                    medication={medication}
                    schedules={schedulesByMedication.get(medication.id) ?? []}
                    onOpen={() => detailsSheetRef.current?.present(medication)}
                    onRemove={() => removeMedication(medication)}
                  />
                ))
              )}
            </View>

            {removeError ? (
              <Text className="text-body-lg" style={{ color: theme.statusText('missed') }}>
                {removeError}
              </Text>
            ) : null}

            {/* ── Medication History Card Matching Reference ── */}
            <Pressable
              onPress={() => {
                triggerHaptic('impactLight');
                historySheetRef.current?.present();
              }}
              accessibilityRole="button"
              accessibilityLabel={t('medications.historyTitle')}
              className="flex-row items-center gap-4 rounded-3xl border"
              style={{
                padding: 18,
                backgroundColor: theme.colors.elevated,
                borderColor: theme.mode === 'dark' ? theme.colors.hairline : '#EDF2F7',
                boxShadow: [
                  { offsetX: 0, offsetY: 2, blurRadius: 10, color: 'rgba(50, 75, 120, 0.05)' },
                ],
              }}
            >
              <View
                style={{
                  width: 60,
                  height: 60,
                  borderRadius: 20,
                  backgroundColor: theme.mode === 'dark' ? 'rgba(147, 51, 234, 0.18)' : '#F3E8FF',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <BookOpen size={28} color="#9333EA" strokeWidth={2.2} />
              </View>
              <View className="flex-1 gap-1">
                <Text className="font-extrabold" style={{ color: theme.colors.ink, fontSize: 18.5 }}>
                  {t('medications.historyTitle')}
                </Text>
                <Text className="font-medium" style={{ color: theme.colors.inkSecondary, fontSize: 14.5 }}>
                  {t('medications.historyEntryCaption')}
                </Text>
              </View>
              <ChevronRight color={theme.colors.inkMuted} size={22} strokeWidth={2.2} />
            </Pressable>

            {/* ── Section: Add Medication (Search + Manual Card) ── */}
            <View className="gap-3.5">
              <Text className="font-extrabold" style={{ color: theme.colors.ink, fontSize: 22 }}>
                {t('medications.searchMedications')}
              </Text>

              {/* Modern Search Bar */}
              <View
                className="min-h-hit flex-row items-center gap-3.5 rounded-full border px-5"
                style={{
                  minHeight: 56,
                  backgroundColor: theme.mode === 'dark' ? theme.colors.elevated : '#F8FAFC',
                  borderColor: theme.mode === 'dark' ? theme.colors.hairline : '#E2E8F0',
                }}
              >
                <Search size={22} color={theme.colors.inkMuted} strokeWidth={2.2} />
                <TextInput
                  value={query}
                  onChangeText={runSearch}
                  placeholder={t('medications.searchPlaceholder')}
                  placeholderTextColor={theme.colors.inkMuted}
                  className="flex-1"
                  style={{ color: theme.colors.ink, fontSize: 16.5, paddingVertical: 14 }}
                />
              </View>

              {searching ? <ActivityIndicator color={theme.action.base} /> : null}
              {!searching && query.trim() && results.length === 0 ? (
                <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
                  {t('medications.noResultsFound', { query })}
                </Text>
              ) : null}
              {results.map((result) => (
                <SearchResultRow
                  key={result.rowid}
                  result={result}
                  adding={addingRowid === result.rowid}
                  onAdd={() => addMedication(result)}
                />
              ))}
              {duplicateName ? (
                <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
                  {t('medications.alreadyAdded', { name: duplicateName })}
                </Text>
              ) : null}

              <ManualMedicationButton onPress={() => manualSheetRef.current?.present(query.trim())} />
            </View>

            {addedName ? (
              <View
                className="gap-3 rounded-3xl border p-5"
                style={{
                  backgroundColor: addedConflicts?.length
                    ? theme.severityTint(CONFLICT_SEVERITY[worstConflictSeverity(addedConflicts)])
                    : theme.statusTint('taken'),
                  borderColor: theme.colors.hairline,
                }}
              >
                <Text className="text-body-lg" style={{ color: theme.colors.ink, fontWeight: '700', fontSize: 16.5 }}>
                  {addedConflicts?.length
                    ? t('medications.addedConflictsFound', { name: addedName })
                    : t('medications.addedNoConflicts', { name: addedName })}
                </Text>
                {addedConflicts?.map((conflict) => (
                  <View key={conflict.medicationId} className="flex-row items-start gap-2">
                    <TriangleAlert
                      color={theme.severityText(CONFLICT_SEVERITY[conflict.severity])}
                      size={18}
                      style={{ marginTop: 2 }}
                    />
                    <View className="flex-1">
                      <Text
                        className="text-body-lg"
                        style={{ color: theme.severityText(CONFLICT_SEVERITY[conflict.severity]), fontWeight: '700', fontSize: 16 }}
                      >
                        {conflict.medicationName}
                      </Text>
                      <Text className="text-caption" style={{ color: theme.colors.inkSecondary, fontSize: 14.5 }}>
                        {conflict.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            {/* ── Motivational Health Banner Matching Reference ── */}
            <View
              className="flex-row items-center justify-between rounded-3xl overflow-hidden"
              style={{
                backgroundColor: theme.mode === 'dark' ? 'rgba(30, 58, 138, 0.22)' : '#E8F2FC',
                borderWidth: 1,
                borderColor: theme.mode === 'dark' ? 'rgba(59, 130, 246, 0.28)' : 'rgba(186, 215, 248, 0.70)',
                paddingHorizontal: 22,
                paddingVertical: 20,
                boxShadow: [
                  { offsetX: 0, offsetY: 4, blurRadius: 14, color: 'rgba(59, 130, 246, 0.08)' },
                ],
              }}
            >
              <View className="flex-1 pr-3">
                <Text
                  className="font-extrabold"
                  style={{
                    color: theme.mode === 'dark' ? '#93C5FD' : '#1E3A8A',
                    fontSize: 19,
                    lineHeight: 25,
                  }}
                >
                  {t('medications.motivationalTitle')}
                </Text>
                <Text
                  className="mt-1.5 font-medium"
                  style={{
                    color: theme.mode === 'dark' ? '#BFDBFE' : '#476585',
                    fontSize: 14.5,
                    lineHeight: 20,
                  }}
                >
                  {t('medications.motivationalSubtitle')}
                </Text>
              </View>

              <Image
                source={require('../../assets/branding/medical-shield-banner.png')}
                style={{ width: 136, height: 96, marginRight: -4 }}
                resizeMode="contain"
              />
            </View>
          </>
        )}
      </ScrollView>

      <ManualMedicationSheet ref={manualSheetRef} onSave={addManualMedication} />
      <MedicationHistorySheet ref={historySheetRef} />
      <MedicationDetailsSheet
        ref={detailsSheetRef}
        onMedicationUpdated={(updated) => {
          setMedications((current) => current.map((item) => (item.id === updated.id ? updated : item)));
          if (mediusDb) refreshMedications(mediusDb).catch(() => {});
        }}
      />
    </SafeAreaView>
  );
}
