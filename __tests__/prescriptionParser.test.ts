import {
  normalizeBengaliDigits,
  parseDoseSchedule,
  parseDoseQuantity,
  parseMealRelation,
  parseDuration,
  extractDrugNameFragment,
} from '../src/ocr/prescriptionParser';

describe('South Asian Clinical Syntax Regex Engine', () => {
  describe('Bengali Digit Normalization', () => {
    it('normalizes Bengali digits to ASCII digits', () => {
      expect(normalizeBengaliDigits('১+০+১')).toBe('1+0+1');
      expect(normalizeBengaliDigits('৭ দিন')).toBe('7 দিন');
      expect(normalizeBengaliDigits('১০ml')).toBe('10ml');
    });
  });

  describe('Dosage Schedule Parsing', () => {
    it('parses Bengali plus dosage format (১+০+১)', () => {
      const normalized = normalizeBengaliDigits('১+০+১');
      expect(parseDoseSchedule(normalized)).toEqual({ morning: 1, afternoon: 0, night: 1 });
    });

    it('parses hyphen dosage format (1-0-1)', () => {
      expect(parseDoseSchedule('1-0-1')).toEqual({ morning: 1, afternoon: 0, night: 1 });
    });

    it('parses three-ones dosage format (১+১+১)', () => {
      const normalized = normalizeBengaliDigits('১+১+১');
      expect(parseDoseSchedule(normalized)).toEqual({ morning: 1, afternoon: 1, night: 1 });
    });

    it('parses morning-only format (1+0+0)', () => {
      expect(parseDoseSchedule('1+0+0')).toEqual({ morning: 1, afternoon: 0, night: 0 });
    });

    it('parses night-only format (0-0-1)', () => {
      expect(parseDoseSchedule('0-0-1')).toEqual({ morning: 0, afternoon: 0, night: 1 });
    });
  });

  describe('Dose Quantity Parsing', () => {
    it('parses fraction tablet (1/2 tablet)', () => {
      expect(parseDoseQuantity('1/2 tablet')).toEqual({ amount: 0.5, unit: 'tablet' });
    });

    it('parses spoon dose (2 চামচ)', () => {
      expect(parseDoseQuantity('2 চামচ')).toEqual({ amount: 2, unit: 'spoon' });
    });

    it('parses liquid dose (10ml)', () => {
      expect(parseDoseQuantity('10ml')).toEqual({ amount: 10, unit: 'ml' });
    });
  });

  describe('Meal Temporal Relationship Parsing', () => {
    it('parses Bengali before meal (খাবার আগে)', () => {
      expect(parseMealRelation('খাবার আগে')).toEqual({ timing: 'BEFORE', offsetMinutes: null });
    });

    it('parses Bengali after meal with offset (খাওয়ার ৩০ মিনিট পর)', () => {
      const normalized = normalizeBengaliDigits('খাওয়ার ৩০ মিনিট পর');
      expect(parseMealRelation(normalized)).toEqual({ timing: 'AFTER', offsetMinutes: 30 });
    });

    it('parses English before meal (Before meal)', () => {
      expect(parseMealRelation('Before meal')).toEqual({ timing: 'BEFORE', offsetMinutes: null });
    });

    it('parses English after food (After food)', () => {
      expect(parseMealRelation('After food')).toEqual({ timing: 'AFTER', offsetMinutes: null });
    });

    it('parses Bengali empty stomach (খালি পেটে)', () => {
      expect(parseMealRelation('খালি পেটে')).toEqual({ timing: 'EMPTY_STOMACH', offsetMinutes: null });
    });
  });

  describe('Regimen Duration Parsing', () => {
    it('parses Bengali days (৭ দিন)', () => {
      const normalized = normalizeBengaliDigits('৭ দিন');
      expect(parseDuration(normalized)).toEqual({ days: 7, isOngoing: false });
    });

    it('parses English days (10 days)', () => {
      expect(parseDuration('10 days')).toEqual({ days: 10, isOngoing: false });
    });

    it('converts a one-month course to the standard 30-day duration', () => {
      expect(parseDuration('1 month')).toEqual({ days: 30, isOngoing: false });
    });

    it('parses ongoing regimen (চলবে)', () => {
      expect(parseDuration('চলবে')).toEqual({ days: null, isOngoing: true });
    });
  });

  describe('Drug Name Fragment Extraction', () => {
    it('extracts brand name while stripping dosage, meal, and duration tokens', () => {
      const line = 'Napa 500mg 1+0+1 7 days After food';
      expect(extractDrugNameFragment(line)).toBe('Napa');
    });

    it('extracts brand name from Bengali prescription line', () => {
      const line = 'Seclo 20mg ১+০+১ খাওয়ার ৩০ মিনিট পর ৭ দিন';
      const normalized = normalizeBengaliDigits(line);
      expect(extractDrugNameFragment(normalized)).toBe('Seclo');
    });
  });
});
