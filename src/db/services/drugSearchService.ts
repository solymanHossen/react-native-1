import type { DB } from '@op-engineering/op-sqlite';
import type { DrugSearchResult } from '../types';

const DEFAULT_LIMIT = 20;
/** Below this many FTS prefix hits, also try the in-memory fuzzy fallback. */
const FUZZY_FALLBACK_THRESHOLD = 5;

interface FuzzyIndexRow {
  rowid: number;
  brand_name: string;
  generic_name: string;
  searchable: string;
}

/**
 * FTS5's own tokenizers only ever match contiguous prefixes/tokens — there is
 * no built-in way to match "Napx" against "Naproxen" (not a prefix, not a
 * substring: it's a non-contiguous subsequence, more like what an fzf-style
 * fuzzy finder does). SQLite's real answer to this is the spellfix1
 * extension, but that's a loadable extension built around edit-distance
 * spelling correction, and loading runtime extensions is unavailable in
 * SQLCipher builds (see op-sqlite's own podspec: "SQLCipher is not supported
 * with phone version. It cannot load extensions.", and loadExtension is
 * disabled for SQLCipher generally).
 *
 * So this service is two-tier:
 *  1. An FTS5 `MATCH` prefix query — native B-tree lookup, reliably
 *     sub-15ms even at 25k rows, and correct for the overwhelmingly common
 *     case of someone typing a prefix of the real name ("Napro" -> Naproxen).
 *  2. A JS in-memory subsequence-fuzzy fallback over a small cached
 *     projection (id + names only, not the full row), which only runs when
 *     tier 1 comes back thin — so the fast path never pays for it, and the
 *     abbreviation case ("Napx" -> Naproxen) still resolves.
 *
 * Tier 2's cost is real JS work (not a native index), so its latency is
 * best-effort relative to device performance, not a guaranteed bound — it is
 * not where this class's sub-15ms claim comes from.
 */
export class DrugSearchService {
  private readonly db: DB;
  private fuzzyIndexPromise: Promise<FuzzyIndexRow[]> | null = null;

  constructor(db: DB) {
    this.db = db;
  }

  /** Pre-builds the fuzzy-fallback cache so the first abbreviation-style search isn't the one paying to build it. */
  warmFuzzyCache(): Promise<FuzzyIndexRow[]> {
    return this.getFuzzyIndex();
  }

  async search(query: string, limit: number = DEFAULT_LIMIT): Promise<DrugSearchResult[]> {
    const trimmed = query.trim();
    if (!trimmed) return [];

    const ftsResults = await this.searchFts(trimmed, limit);
    if (ftsResults.length >= FUZZY_FALLBACK_THRESHOLD) {
      return ftsResults;
    }

    const fuzzyResults = await this.searchFuzzy(trimmed, limit, new Set(ftsResults.map((r) => r.rowid)));
    return [...ftsResults, ...fuzzyResults].slice(0, limit);
  }

  private async searchFts(query: string, limit: number): Promise<DrugSearchResult[]> {
    const matchQuery = buildPrefixMatchQuery(query);
    if (!matchQuery) return [];

    try {
      const { rows } = await this.db.execute(
        `SELECT rowid, brand_name, generic_name, strength, dosage_form, manufacturer,
                indications, food_instructions, high_risk_interactions_json, rank
         FROM drug_directory
         WHERE drug_directory MATCH ?
         ORDER BY rank
         LIMIT ?;`,
        [matchQuery, limit],
      );

      return rows.map((row) => ({
        rowid: Number(row.rowid),
        brand_name: String(row.brand_name ?? ''),
        generic_name: String(row.generic_name ?? ''),
        strength: String(row.strength ?? ''),
        dosage_form: String(row.dosage_form ?? ''),
        manufacturer: String(row.manufacturer ?? ''),
        indications: String(row.indications ?? ''),
        food_instructions: String(row.food_instructions ?? ''),
        high_risk_interactions_json: String(row.high_risk_interactions_json ?? '[]'),
        score: Number(row.rank ?? 0),
        matchType: 'fts' as const,
      }));
    } catch (error) {
      // A malformed MATCH query (stray FTS5 syntax we didn't fully escape)
      // should degrade to "no prefix matches", not crash the search box.
      console.warn('[DrugSearchService] FTS5 query failed, falling back to fuzzy only', error);
      return [];
    }
  }

  private async searchFuzzy(query: string, limit: number, exclude: Set<number>): Promise<DrugSearchResult[]> {
    const index = await this.getFuzzyIndex();
    const needle = query.toLowerCase();

    const scored = index
      .filter((row) => !exclude.has(row.rowid))
      .map((row) => ({ row, score: fuzzyMatchScore(needle, row.searchable) }))
      .filter((entry): entry is { row: FuzzyIndexRow; score: number } => entry.score !== null)
      .sort((a, b) => a.score - b.score)
      .slice(0, limit);

    if (scored.length === 0) return [];

    const rowids = scored.map((entry) => entry.row.rowid);
    const placeholders = rowids.map(() => '?').join(', ');
    const { rows } = await this.db.execute(
      `SELECT rowid, brand_name, generic_name, strength, dosage_form, manufacturer,
              indications, food_instructions, high_risk_interactions_json
       FROM drug_directory
       WHERE rowid IN (${placeholders});`,
      rowids,
    );

    const byRowid = new Map(rows.map((row) => [Number(row.rowid), row]));
    return scored
      .map(({ row, score }): DrugSearchResult | null => {
        const full = byRowid.get(row.rowid);
        if (!full) return null;
        return {
          rowid: row.rowid,
          brand_name: String(full.brand_name ?? ''),
          generic_name: String(full.generic_name ?? ''),
          strength: String(full.strength ?? ''),
          dosage_form: String(full.dosage_form ?? ''),
          manufacturer: String(full.manufacturer ?? ''),
          indications: String(full.indications ?? ''),
          food_instructions: String(full.food_instructions ?? ''),
          high_risk_interactions_json: String(full.high_risk_interactions_json ?? '[]'),
          score,
          matchType: 'fuzzy',
        };
      })
      .filter((result): result is DrugSearchResult => result !== null);
  }

  private getFuzzyIndex(): Promise<FuzzyIndexRow[]> {
    if (!this.fuzzyIndexPromise) {
      this.fuzzyIndexPromise = this.db
        .execute('SELECT rowid, brand_name, generic_name FROM drug_directory;')
        .then(({ rows }) =>
          rows.map((row) => {
            const brand_name = String(row.brand_name ?? '');
            const generic_name = String(row.generic_name ?? '');
            return {
              rowid: Number(row.rowid),
              brand_name,
              generic_name,
              searchable: `${brand_name} ${generic_name}`.toLowerCase(),
            };
          }),
        )
        .catch((error: unknown) => {
          this.fuzzyIndexPromise = null;
          throw error;
        });
    }
    return this.fuzzyIndexPromise;
  }

  /** Call after any write to drug_directory (re-seeding, admin edits) so the fuzzy cache doesn't go stale. */
  invalidateFuzzyCache(): void {
    this.fuzzyIndexPromise = null;
  }
}

/**
 * FTS5 query syntax treats `" * : ( ) -` and column-name-followed-by-`:` as
 * operators. Since this is a search-box input, not a query language, strip
 * everything but letters/digits/spaces and turn each remaining word into a
 * prefix term.
 */
function buildPrefixMatchQuery(input: string): string | null {
  const words = input
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .split(/\s+/)
    .filter(Boolean);
  if (words.length === 0) return null;
  return words.map((word) => `"${word}"*`).join(' ');
}

/**
 * Subsequence fuzzy match, fzf-style: every character of `needle` must
 * appear in `haystack` in order (not necessarily contiguous). Returns a
 * penalty score (lower is better; a contiguous prefix match scores close to
 * 0) or null if `needle` isn't a subsequence of `haystack` at all.
 */
function fuzzyMatchScore(needle: string, haystack: string): number | null {
  if (needle.length === 0) return null;

  let haystackIndex = 0;
  let previousMatchIndex = -1;
  let gapPenalty = 0;
  let firstMatchIndex = -1;

  for (let i = 0; i < needle.length; i++) {
    const char = needle[i];
    const foundAt = haystack.indexOf(char, haystackIndex);
    if (foundAt === -1) return null;

    if (firstMatchIndex === -1) firstMatchIndex = foundAt;
    if (previousMatchIndex !== -1) {
      gapPenalty += foundAt - previousMatchIndex - 1;
    }
    previousMatchIndex = foundAt;
    haystackIndex = foundAt + 1;
  }

  // Penalize matches that start deep into the string more than gaps between
  // matched characters, so "naproxen" ranks above "ibuprofen zinc" for "napx".
  return gapPenalty + firstMatchIndex * 0.5;
}
