import type { DrugSearchService } from '../db/services/drugSearchService';
import type { DrugSearchResult } from '../db/types';

/** Spec requirement: confidence >= 70% auto-maps to the matched identity; below that, it's a suggestion for human review. */
const AUTO_MAP_THRESHOLD = 70;

export interface DrugMatchResult {
  /** Best candidate found, regardless of confidence — null only if the search returned nothing at all. */
  matchedDrug: DrugSearchResult | null;
  /** 0-100. */
  confidence: number;
  autoMapped: boolean;
}

/**
 * Levenshtein edit distance — classic, no dependency needed for ~20 lines.
 * Confidence is edit-distance based rather than reusing DrugSearchService's
 * own `score` field on purpose: `score` is an FTS5 bm25 rank for one branch
 * and a subsequence gap-penalty for the other, two different unbounded
 * scales that don't mean "percent confidence" on their own. Edit-distance
 * ratio against the actual matched name does: it directly answers "how many
 * character-level OCR mistakes would it take to turn what we read into this
 * candidate's name," which is the right lens for scoring OCR confidence.
 */
function levenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let previousRow = Array.from({ length: b.length + 1 }, (_, i) => i);

  for (let i = 0; i < a.length; i++) {
    const currentRow = [i + 1];
    for (let j = 0; j < b.length; j++) {
      const insertCost = currentRow[j] + 1;
      const deleteCost = previousRow[j + 1] + 1;
      const substituteCost = previousRow[j] + (a[i] === b[j] ? 0 : 1);
      currentRow.push(Math.min(insertCost, deleteCost, substituteCost));
    }
    previousRow = currentRow;
  }

  return previousRow[b.length];
}

/** Exported for the alarm engine's vision-fallback confidence check — same "how many character-level mistakes" math, just against a single known target instead of a list of DB candidates. */
export function similarityPercent(a: string, b: string): number {
  const left = a.trim().toLowerCase();
  const right = b.trim().toLowerCase();
  if (!left || !right) return 0;
  const maxLength = Math.max(left.length, right.length);
  const distance = levenshteinDistance(left, right);
  return Math.round((1 - distance / maxLength) * 100);
}

/**
 * Resolves an OCR'd drug-name fragment against the local drug_directory,
 * scoring how confident that resolution is. Always returns the best
 * candidate it found (for the review UI to show as a suggestion even when
 * under threshold) — `autoMapped` is what actually gates "trust this
 * without asking."
 */
export async function matchDrugName(nameFragment: string, drugSearch: DrugSearchService): Promise<DrugMatchResult> {
  const trimmed = nameFragment.trim();
  if (!trimmed) {
    return { matchedDrug: null, confidence: 0, autoMapped: false };
  }

  const candidates = await drugSearch.search(trimmed, 5);
  if (candidates.length === 0) {
    return { matchedDrug: null, confidence: 0, autoMapped: false };
  }

  let best = candidates[0];
  let bestConfidence = -1;
  for (const candidate of candidates) {
    const confidence = Math.max(similarityPercent(trimmed, candidate.brand_name), similarityPercent(trimmed, candidate.generic_name));
    if (confidence > bestConfidence) {
      bestConfidence = confidence;
      best = candidate;
    }
  }

  return {
    matchedDrug: best,
    confidence: bestConfidence,
    autoMapped: bestConfidence >= AUTO_MAP_THRESHOLD,
  };
}
