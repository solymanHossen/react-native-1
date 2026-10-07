import { Droplet, Pill, Plus, Syringe, TriangleAlert, X } from 'lucide-react-native';
import { useCallback, useEffect, useState, type ComponentType } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { StatusPill } from '../components/ui';
import { initializeDatabase, type DrugConflict, type DrugSearchResult, type Medication, type MediusDatabase } from '../db';
import { useTranslation } from '../i18n';
import { triggerHaptic } from '../lib/haptics';
import { useTheme } from '../theme/useTheme';

const FORM_ICON: Record<Medication['form'], ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  tablet: Pill,
  capsule: Pill,
  syrup: Droplet,
  drop: Droplet,
  injection: Syringe,
};

const SEVERITY_STATUS = { moderate: 'pending', severe: 'missed', contraindicated: 'missed' } as const;

function MedicationRow({ medication, onRemove }: { medication: Medication; onRemove: () => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const FormIcon = FORM_ICON[medication.form];
  const isLowStock = medication.current_stock <= medication.refill_threshold;

  return (
    <View
      className="flex-row items-center gap-4 rounded-3xl border p-5"
      style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
    >
      <View className="items-center justify-center rounded-2xl" style={{ width: 44, height: 44, backgroundColor: `${theme.action.base}14` }}>
        <FormIcon color={theme.action.base} size={22} strokeWidth={2.25} />
      </View>
      <View className="flex-1 gap-1.5">
        <Text className="text-body-lg" numberOfLines={1} style={{ color: theme.colors.ink }}>
          {medication.strength ? `${medication.name} · ${medication.strength}` : medication.name}
        </Text>
        {medication.instructions ? (
          <Text className="text-caption" numberOfLines={1} style={{ color: theme.colors.inkSecondary }}>
            {medication.instructions}
          </Text>
        ) : null}
        {/* Only shown when it needs attention — a pill on every row saying
            "24 left" is noise; a patient only needs to notice this one when
            it's running out. */}
        {isLowStock ? <StatusPill status="missed" label={t('medications.lowStock')} /> : null}
      </View>
      <Pressable
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel={t('medications.removeAccessibility', { name: medication.name })}
        className="min-h-hit min-w-hit items-center justify-center"
      >
        <X color={theme.colors.inkMuted} size={20} />
      </Pressable>
    </View>
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
      className="flex-row items-center gap-4 rounded-3xl border p-5"
      style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
    >
      <View className="flex-1">
        <Text className="text-body-lg" numberOfLines={1} style={{ color: theme.colors.ink }}>
          {result.brand_name} {result.strength}
        </Text>
        <Text className="mt-0.5 text-caption" numberOfLines={1} style={{ color: theme.colors.inkSecondary }}>
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
          style={{ width: 40, height: 40, backgroundColor: `${theme.action.base}14` }}
        >
          <Plus color={theme.action.base} size={20} strokeWidth={2.5} />
        </Pressable>
      )}
    </View>
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

  const refreshMedications = useCallback(async (database: MediusDatabase) => {
    setMedications(await database.medications.list());
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
        setResults(await mediusDb.drugSearch.search(text, 10));
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
      try {
        await mediusDb.medications.create({
          name: result.brand_name,
          generic_id: result.rowid,
          strength: result.strength,
          form: 'tablet',
          current_stock: 30,
          refill_threshold: 5,
          expiry_date: null,
          instructions: null,
          nfc_tag_uid: null,
        });
        const conflicts = await mediusDb.conflicts.checkDrugConflicts(result.generic_name);
        triggerHaptic(conflicts.length > 0 ? 'notificationWarning' : 'notificationSuccess');
        setAddedName(result.brand_name);
        setAddedConflicts(conflicts);
        setQuery('');
        setResults([]);
        await refreshMedications(mediusDb);
      } finally {
        setAddingRowid(null);
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
            await mediusDb.medications.delete(medication.id);
            await refreshMedications(mediusDb);
          },
        },
      ]);
    },
    [mediusDb, refreshMedications, t],
  );

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor: theme.colors.canvas }}>
      <View className="border-b px-6 py-6" style={{ borderColor: theme.colors.hairline }}>
        <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
          {t('medications.title')}
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-6 px-6 pt-8"
        contentContainerStyle={{ paddingBottom: 32 }}
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
            <View className="gap-4">
              <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                {t('medications.yourMedications')}
              </Text>
              {medications.length === 0 ? (
                <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
                  {t('medications.noMedicationsYet')}
                </Text>
              ) : (
                medications.map((medication) => (
                  <MedicationRow key={medication.id} medication={medication} onRemove={() => removeMedication(medication)} />
                ))
              )}
            </View>

            <View className="gap-4 border-t pt-6" style={{ borderColor: theme.colors.hairline }}>
              <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                {t('medications.searchMedications')}
              </Text>
              <TextInput
                value={query}
                onChangeText={runSearch}
                placeholder={t('medications.searchPlaceholder')}
                placeholderTextColor={theme.colors.inkMuted}
                className="min-h-hit rounded-full border px-6 text-body-lg"
                style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
              />
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
            </View>

            {addedName ? (
              <View
                className="gap-3 rounded-3xl border p-5"
                style={{
                  backgroundColor: theme.statusTint(addedConflicts?.length ? 'missed' : 'taken'),
                  borderColor: theme.colors.hairline,
                }}
              >
                <Text className="text-body-lg" style={{ color: theme.colors.ink, fontWeight: '600' }}>
                  {addedConflicts?.length
                    ? t('medications.addedConflictsFound', { name: addedName })
                    : t('medications.addedNoConflicts', { name: addedName })}
                </Text>
                {addedConflicts?.map((conflict) => (
                  <View key={conflict.medicationId} className="flex-row items-start gap-2">
                    <TriangleAlert color={theme.statusText(SEVERITY_STATUS[conflict.severity])} size={18} style={{ marginTop: 2 }} />
                    <View className="flex-1">
                      <Text className="text-body-lg" style={{ color: theme.statusText(SEVERITY_STATUS[conflict.severity]), fontWeight: '600' }}>
                        {conflict.medicationName}
                      </Text>
                      <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                        {conflict.description}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            ) : null}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
