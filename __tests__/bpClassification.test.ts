import { classifyBloodPressure } from '../src/vitals/bpClassification';

describe('AHA blood pressure classification', () => {
  it('classifies a textbook normal reading', () => {
    expect(classifyBloodPressure(110, 70).stage).toBe('NORMAL');
    expect(classifyBloodPressure(119, 79).stage).toBe('NORMAL');
  });

  it('classifies elevated: systolic 120-129 with diastolic still under 80', () => {
    expect(classifyBloodPressure(120, 79).stage).toBe('ELEVATED');
    expect(classifyBloodPressure(129, 70).stage).toBe('ELEVATED');
  });

  it('classifies stage 1 when either number crosses its threshold', () => {
    expect(classifyBloodPressure(130, 70).stage).toBe('STAGE_1');
    expect(classifyBloodPressure(115, 85).stage).toBe('STAGE_1');
    expect(classifyBloodPressure(139, 89).stage).toBe('STAGE_1');
  });

  it('classifies stage 2 when either number crosses its threshold', () => {
    expect(classifyBloodPressure(140, 70).stage).toBe('STAGE_2');
    expect(classifyBloodPressure(115, 90).stage).toBe('STAGE_2');
    expect(classifyBloodPressure(179, 119).stage).toBe('STAGE_2');
  });

  it('classifies a hypertensive crisis strictly above 180/120, flagged urgent', () => {
    const bySystolic = classifyBloodPressure(181, 70);
    expect(bySystolic.stage).toBe('CRISIS');
    expect(bySystolic.urgent).toBe(true);

    const byDiastolic = classifyBloodPressure(115, 121);
    expect(byDiastolic.stage).toBe('CRISIS');
    expect(byDiastolic.urgent).toBe(true);
  });

  it('does not flag any non-crisis stage as urgent', () => {
    expect(classifyBloodPressure(110, 70).urgent).toBe(false);
    expect(classifyBloodPressure(125, 70).urgent).toBe(false);
    expect(classifyBloodPressure(135, 85).urgent).toBe(false);
    expect(classifyBloodPressure(150, 95).urgent).toBe(false);
  });

  it('treats exactly 180/120 as stage 2, not crisis (crisis requires strictly above)', () => {
    expect(classifyBloodPressure(180, 120).stage).toBe('STAGE_2');
  });
});
