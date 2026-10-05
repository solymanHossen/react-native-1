import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LargeTextButton } from '../components/ui';
import { initializeDatabase, type DrugConflict, type DrugSearchResult, type MediusDatabase } from '../db';
import { useTheme } from '../theme/useTheme';

/**
 * Manual end-to-end exercise of src/db: encrypted SQLCipher connection, the
 * bundled FTS5 seed import, DrugSearchService's prefix+fuzzy search, and
 * ConflictService's drug-drug sentinel. Not part of the design-system
 * deliverable — a verification screen for the database layer, wired in
 * behind App.tsx's dev-only tab switcher.
 */
export default function DrugLabScreen() {
  const theme = useTheme();
  const insets = useSafeAreaInsets();
  const [mediusDb, setMediusDb] = useState<MediusDatabase | null>(null);
  const [initError, setInitError] = useState<string | null>(null);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DrugSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const [regimenStatus, setRegimenStatus] = useState<string | null>(null);
  const [conflicts, setConflicts] = useState<DrugConflict[] | null>(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);

  useEffect(() => {
    initializeDatabase()
      .then(setMediusDb)
      .catch((error: unknown) => setInitError(error instanceof Error ? error.message : String(error)));
  }, []);

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

  const addWarfarinToActiveRegimen = useCallback(async () => {
    if (!mediusDb) return;
    setRegimenStatus('Adding Warfarin to the active regimen…');
    const [warfarin] = await mediusDb.drugSearch.search('Warfarin', 1);
    if (!warfarin) {
      setRegimenStatus('Warfarin not found in drug_directory — is the seed asset imported?');
      return;
    }
    const medication = await mediusDb.medications.create({
      name: warfarin.brand_name,
      generic_id: warfarin.rowid,
      strength: warfarin.strength,
      form: 'tablet',
      current_stock: 30,
      refill_threshold: 5,
      expiry_date: null,
      instructions: null,
      nfc_tag_uid: null,
    });
    await mediusDb.schedules.create({
      medication_id: medication.id,
      time_utc: '08:00',
      time_node: 'BREAKFAST',
      meal_relation: 'WITH',
      dose_quantity: 1,
      days_of_week_mask: 127,
      is_active: true,
    });
    setRegimenStatus(`Warfarin added (medication #${medication.id}, active schedule created).`);
  }, [mediusDb]);

  const checkNaproxenConflicts = useCallback(async () => {
    if (!mediusDb) return;
    setCheckingConflicts(true);
    try {
      setConflicts(await mediusDb.conflicts.checkDrugConflicts('Naproxen'));
    } finally {
      setCheckingConflicts(false);
    }
  }, [mediusDb]);

  return (
    <SafeAreaView className="flex-1" edges={['left', 'right']} style={{ backgroundColor: theme.colors.canvas }}>
      <View className="border-b px-6 py-6" style={{ borderColor: theme.colors.hairline }}>
        <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
          Drug Lab (DB verification)
        </Text>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-9 px-6 pt-8"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {initError ? (
          <Text className="text-body-lg" style={{ color: theme.statusText('missed') }}>
            Database failed to initialize: {initError}
          </Text>
        ) : !mediusDb ? (
          <View className="flex-row items-center gap-4">
            <ActivityIndicator color={theme.action.base} />
            <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
              Opening encrypted database…
            </Text>
          </View>
        ) : (
          <>
            <View className="gap-4">
              <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                FTS5 + fuzzy search
              </Text>
              <TextInput
                value={query}
                onChangeText={runSearch}
                placeholder='Try "Napx" or "Napro"'
                placeholderTextColor={theme.colors.inkMuted}
                className="min-h-hit rounded-full border px-6 text-body-lg"
                style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, color: theme.colors.ink }}
              />
              {searching ? <ActivityIndicator color={theme.action.base} /> : null}
              {results.map((result) => (
                <View
                  key={result.rowid}
                  className="rounded-3xl border p-6"
                  style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
                >
                  <Text className="text-body-lg" style={{ color: theme.colors.ink }}>
                    {result.brand_name} ({result.generic_name}) {result.strength}
                  </Text>
                  <Text className="mt-1 text-caption" style={{ color: theme.colors.inkSecondary }}>
                    match: {result.matchType} · score: {result.score.toFixed(2)}
                  </Text>
                </View>
              ))}
            </View>

            <View className="gap-4">
              <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
                Conflict sentinel
              </Text>
              <LargeTextButton label="1. Add Warfarin to active regimen" variant="secondary" onPress={addWarfarinToActiveRegimen} />
              {regimenStatus ? (
                <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                  {regimenStatus}
                </Text>
              ) : null}
              <LargeTextButton
                label="2. Check conflicts for Naproxen"
                loading={checkingConflicts}
                onPress={checkNaproxenConflicts}
              />
              {conflicts?.map((conflict) => (
                <View
                  key={conflict.medicationId}
                  className="rounded-3xl border p-6"
                  style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
                >
                  <Text className="text-body-lg" style={{ color: theme.statusText('missed') }}>
                    {conflict.severity.toUpperCase()}: {conflict.medicationName} ({conflict.conflictingGeneric})
                  </Text>
                  <Text className="mt-1 text-caption" style={{ color: theme.colors.inkSecondary }}>
                    {conflict.description}
                  </Text>
                </View>
              ))}
              {conflicts?.length === 0 ? (
                <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary }}>
                  No conflicts found.
                </Text>
              ) : null}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
