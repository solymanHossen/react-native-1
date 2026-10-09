import { useCallback, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import type { PhotoFile } from 'react-native-vision-camera';
import { PrescriptionCameraView } from '../components/camera/PrescriptionCameraView';
import { PrescriptionReviewSheet, type PrescriptionReviewSheetRef } from '../components/prescription/PrescriptionReviewSheet';
import { DuplicateMedicationError, initializeDatabase } from '../db';
import type { MealRelation as SchedulesMealRelation, TimeNode } from '../db/types';
import { useTranslation } from '../i18n';
import { parsePrescriptionText, summarizeDosage, type ParsedPrescriptionItem } from '../ocr';
import { useTheme } from '../theme/useTheme';

/**
 * ML Kit's on-device Text Recognition v2 (what `@react-native-ml-kit/text-recognition`
 * wraps) ships recognizer models for Latin, Chinese, Devanagari, Japanese and
 * Korean scripts — there is no Bengali-script model, on-device or otherwise,
 * in this API. (Devanagari is Hindi/Marathi/Sanskrit's script, not Bengali's,
 * despite both being Brahmic scripts used in South Asia.) Google Cloud
 * Vision does support Bengali OCR, but that's a network call, which the
 * "edge-only, no network connectivity" requirement rules out.
 *
 * So this pipeline is honest about where the line actually is: LATIN is the
 * recognizer script used below, which reads Latin-numeral dosage shorthand
 * ("1+0+1", "10 days") and Latin/English drug names correctly — a very
 * common real-world case, since many South Asian prescriptions mix Latin
 * numerals into otherwise Bengali text. Bengali-script digits and words
 * ("১+০+১", "খাবার আগে") in the photographed text will NOT be reliably
 * recognized by this engine; `parsePrescriptionText` fully supports them
 * once they're in the text (see src/ocr/prescriptionParser.ts and its
 * passing test cases for every example in the spec), the gap is upstream of
 * the parser, in what ML Kit can actually read off the page.
 */
const OCR_SCRIPT = TextRecognitionScript.LATIN;

function mapMealRelation(mealRelation: ParsedPrescriptionItem['mealRelation']): SchedulesMealRelation {
  if (!mealRelation) return 'WITH';
  if (mealRelation.offsetMinutes !== null) return 'MINUTES_OFFSET';
  if (mealRelation.timing === 'EMPTY_STOMACH') return 'BEFORE';
  return mealRelation.timing;
}

function courseDates(duration: ParsedPrescriptionItem['duration']): { start: string | null; end: string | null } {
  if (!duration || duration.isOngoing || !duration.days || duration.days < 1) return { start: null, end: null };
  const start = new Date();
  const end = new Date(start);
  end.setDate(end.getDate() + duration.days - 1);
  const toDate = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };
  return { start: toDate(start), end: toDate(end) };
}

const DOSE_SLOT_TIME_NODES: Array<{ key: 'morning' | 'afternoon' | 'night'; timeNode: TimeNode; timeUtc: string }> = [
  { key: 'morning', timeNode: 'BREAKFAST', timeUtc: '08:00' },
  { key: 'afternoon', timeNode: 'LUNCH', timeUtc: '13:00' },
  { key: 'night', timeNode: 'DINNER', timeUtc: '20:00' },
];

/**
 * Demo/verification screen wiring the full pipeline end to end: capture ->
 * on-device OCR -> deterministic parsing -> FTS5 drug matching -> human
 * review -> persistence through the existing medications/schedules
 * repositories. Not itself one of the three deliverables (parser service,
 * camera view, verification modal) — proof they connect.
 */
export default function PrescriptionScanScreen() {
  const theme = useTheme();
  const { t } = useTranslation();
  const reviewSheetRef = useRef<PrescriptionReviewSheetRef>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastConfirmedCount, setLastConfirmedCount] = useState<number | null>(null);
  const [skippedDuplicateCount, setSkippedDuplicateCount] = useState(0);

  const processImageFile = useCallback(async (rawFilePath: string) => {
    setProcessing(true);
    setError(null);
    setLastConfirmedCount(null);
    setSkippedDuplicateCount(0);
    try {
      // Only bare filesystem paths (VisionCamera's `photo.path`) need a
      // file:// prefix added. A gallery pick already carries its own scheme
      // (content:// on Android), and prepending file:// to that produces an
      // unresolvable "file://content://..." URI that ML Kit silently fails
      // to open.
      const formattedPath = /^[a-z][a-z0-9+.-]*:\/\//i.test(rawFilePath) ? rawFilePath : `file://${rawFilePath}`;
      const recognized = await TextRecognition.recognize(formattedPath, OCR_SCRIPT);
      const items = await parsePrescriptionText(recognized.text);
      if (items.length === 0) {
        setError(t('scanRx.noLinesRecognized'));
        return;
      }
      reviewSheetRef.current?.present(items);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : String(caughtError));
    } finally {
      setProcessing(false);
    }
  }, [t]);

  const handleCapture = useCallback(
    (photo: PhotoFile) => {
      processImageFile(photo.path);
    },
    [processImageFile],
  );

  const handleConfirm = useCallback(async (items: ParsedPrescriptionItem[]) => {
    const database = await initializeDatabase();
    let addedCount = 0;
    let duplicateCount = 0;

    for (const item of items) {
      const dates = item.courseStartDate !== undefined
        ? { start: item.courseStartDate, end: item.courseEndDate ?? null }
        : courseDates(item.duration);
      let medication;
      try {
        medication = await database.medications.create({
          name: item.matchedDrug?.brand_name ?? item.drugNameRaw,
          generic_id: item.matchedDrug?.rowid ?? null,
          strength: item.matchedDrug?.strength ?? null,
          form: 'tablet',
          current_stock: 0,
          refill_threshold: 0,
          expiry_date: null,
          instructions: summarizeDosage(item),
          nfc_tag_uid: null,
          photo_uri: null,
          course_start_date: dates.start,
          course_end_date: dates.end,
        });
      } catch (createError) {
        // A prescription can legitimately list a refill of something
        // already on the list — skip just this line and keep processing
        // the rest of the prescription rather than aborting the whole batch.
        if (createError instanceof DuplicateMedicationError) {
          duplicateCount += 1;
          continue;
        }
        throw createError;
      }
      addedCount += 1;

      if (!item.doseSchedule) continue;
      const mealRelation = mapMealRelation(item.mealRelation);
      for (const slot of DOSE_SLOT_TIME_NODES) {
        const quantity = item.doseSchedule[slot.key];
        if (quantity <= 0) continue;
        await database.schedules.create({
          medication_id: medication.id,
          time_utc: slot.timeUtc,
          time_node: slot.timeNode,
          meal_relation: mealRelation,
          dose_quantity: quantity,
          days_of_week_mask: 127,
          is_active: true,
        });
      }
    }

    setLastConfirmedCount(addedCount);
    setSkippedDuplicateCount(duplicateCount);
  }, []);

  return (
    <SafeAreaView className="flex-1" edges={['top', 'left', 'right']} style={{ backgroundColor: '#000000' }}>
      <View className="border-b px-6 py-6" style={{ borderColor: theme.colors.hairline, backgroundColor: theme.colors.canvas }}>
        <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
          {t('scanRx.title')}
        </Text>
        {error ? (
          <Text className="mt-2 text-caption" style={{ color: theme.statusText('missed') }}>
            {error}
          </Text>
        ) : null}
        {lastConfirmedCount !== null ? (
          <Text className="mt-2 text-caption" style={{ color: theme.statusText('taken') }}>
            {t('scanRx.addedMedications', { count: lastConfirmedCount, plural: lastConfirmedCount === 1 ? '' : 's' })}
          </Text>
        ) : null}
        {skippedDuplicateCount > 0 ? (
          <Text className="mt-2 text-caption" style={{ color: theme.colors.inkSecondary }}>
            {t('scanRx.skippedDuplicates', { count: skippedDuplicateCount, plural: skippedDuplicateCount === 1 ? '' : 's' })}
          </Text>
        ) : null}
      </View>

      <View className="flex-1">
        <PrescriptionCameraView onCapture={handleCapture} onSelectImage={processImageFile} paused={processing} />
        {processing ? (
          <View className="absolute inset-0 items-center justify-center gap-4" style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}>
            <ActivityIndicator color="#FFFFFF" size="large" />
            <Text className="text-body-lg" style={{ color: '#FFFFFF' }}>
              {t('scanRx.readingPrescription')}
            </Text>
          </View>
        ) : null}
      </View>

      <PrescriptionReviewSheet ref={reviewSheetRef} onConfirm={handleConfirm} />
    </SafeAreaView>
  );
}
