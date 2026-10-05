import TextRecognition, { TextRecognitionScript } from '@react-native-ml-kit/text-recognition';
import { similarityPercent } from '../ocr';

/** Spec requirement: dismiss the vision fallback only at >= 80% confidence — deliberately stricter than the 70% auto-map threshold OCR scanning uses elsewhere, since this gate stands in for a physical NFC scan. */
export const VISION_CONFIDENCE_THRESHOLD = 80;

/**
 * Scores how confidently a target medication name appears on a photographed
 * blister pack / bottle label. A blister pack's label has several lines
 * (drug name, strength, manufacturer, batch number); comparing the whole
 * recognized blob against the target would dilute a perfect match with all
 * that surrounding noise, so this takes the best line-level match instead —
 * the same "best candidate wins" approach `matchDrugName` uses against DB
 * candidates, just against a single known target string.
 */
export function scorePackMatch(recognizedText: string, targetMedicationName: string): number {
  const lines = recognizedText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length === 0) return 0;

  let best = 0;
  for (const line of lines) {
    best = Math.max(best, similarityPercent(line, targetMedicationName));
  }
  return best;
}

export interface PackScanResult {
  confidence: number;
  verified: boolean;
}

/** Runs OCR on one captured frame and scores it against the target — one call per capture, not a continuous frame processor (see PrescriptionCameraView for why this app doesn't do frame-processor OCR). */
export async function scanPackForMedication(photoPath: string, targetMedicationName: string): Promise<PackScanResult> {
  const uri = /^[a-z][a-z0-9+.-]*:\/\//i.test(photoPath) ? photoPath : `file://${photoPath}`;
  const recognized = await TextRecognition.recognize(uri, TextRecognitionScript.LATIN);
  const confidence = scorePackMatch(recognized.text, targetMedicationName);
  return { confidence, verified: confidence >= VISION_CONFIDENCE_THRESHOLD };
}
