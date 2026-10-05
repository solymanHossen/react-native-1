import { matchDrugName } from '../src/ocr/drugMatcher';
import type { DrugSearchService } from '../src/db/services/drugSearchService';
import type { DrugSearchResult } from '../src/db/types';

describe('Local Drug Name Normalization & Fuzzy Confidence Matching', () => {
  const mockDirectory: DrugSearchResult[] = [
    {
      rowid: 1,
      brand_name: 'Napa',
      generic_name: 'Paracetamol',
      strength: '500 mg',
      dosage_form: 'tablet',
      manufacturer: 'Beximco Pharmaceuticals Ltd.',
      indications: 'Fever and pain',
      food_instructions: 'Take after meal',
      high_risk_interactions_json: '[]',
      score: 10,
      matchType: 'fts',
    },
    {
      rowid: 2,
      brand_name: 'Seclo',
      generic_name: 'Omeprazole',
      strength: '20 mg',
      dosage_form: 'capsule',
      manufacturer: 'Square Pharmaceuticals PLC',
      indications: 'Acidity and heartburn',
      food_instructions: 'Take before meal',
      high_risk_interactions_json: '[]',
      score: 12,
      matchType: 'fts',
    },
  ];

  const mockDrugSearch: DrugSearchService = {
    search: jest.fn().mockImplementation(async (query: string) => {
      const q = query.toLowerCase();
      return mockDirectory.filter(
        (item) =>
          item.brand_name.toLowerCase().includes(q) ||
          item.generic_name.toLowerCase().includes(q) ||
          q.includes(item.brand_name.toLowerCase()),
      );
    }),
  } as unknown as DrugSearchService;

  it('auto-maps when fuzzy confidence >= 70%', async () => {
    // "Napaa" vs "Napa" edit distance 1 / 5 = 80% match
    const result = await matchDrugName('Napaa', mockDrugSearch);
    expect(result.matchedDrug?.brand_name).toBe('Napa');
    expect(result.confidence).toBeGreaterThanOrEqual(70);
    expect(result.autoMapped).toBe(true);
  });

  it('marks autoMapped false when fuzzy confidence < 70%', async () => {
    const result = await matchDrugName('Napa Extra Long Relief', mockDrugSearch);
    expect(result.matchedDrug?.brand_name).toBe('Napa');
    expect(result.confidence).toBeLessThan(70);
    expect(result.autoMapped).toBe(false);
  });

  it('returns null matchedDrug when query returns no candidates', async () => {
    const emptySearch = {
      search: jest.fn().mockResolvedValue([]),
    } as unknown as DrugSearchService;

    const result = await matchDrugName('UnknownDrugX', emptySearch);
    expect(result.matchedDrug).toBeNull();
    expect(result.confidence).toBe(0);
    expect(result.autoMapped).toBe(false);
  });
});
