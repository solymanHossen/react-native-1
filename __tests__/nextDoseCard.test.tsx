import React from 'react';
import { Image, Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { NextDoseCard, resolveDosageForm, DOSAGE_FORM_ASSETS } from '../src/components/dashboard/NextDoseCard';
import type { IntakeQueueItem } from '../src/store';

const baseMockDose: IntakeQueueItem = {
  scheduleId: 101,
  medicationId: 5,
  medicationName: 'Amoxicillin',
  dosageLabel: '1 capsule',
  doseQuantity: 1,
  medicationForm: 'capsule',
  timeNode: 'BREAKFAST',
  timeUtc: '08:00',
  mealRelation: 'AFTER',
  instructions: 'Take with full glass of water',
  stockRemaining: 14,
  status: 'PENDING',
};

describe('NextDoseCard & Dynamic Dosage System', () => {
  it('correctly resolves dosage forms from explicit and text cues', () => {
    expect(resolveDosageForm('tablet')).toBe('tablet');
    expect(resolveDosageForm('syrup')).toBe('syrup');
    expect(resolveDosageForm('drop')).toBe('drop');
    expect(resolveDosageForm('injection')).toBe('injection');
    expect(resolveDosageForm('capsule')).toBe('capsule');

    // Heuristic fallbacks from dosageLabel or name
    expect(resolveDosageForm(undefined, '10 ml syrup')).toBe('syrup');
    expect(resolveDosageForm(undefined, '2 eye drops')).toBe('drop');
    expect(resolveDosageForm(undefined, '1 injection vial')).toBe('injection');
    expect(resolveDosageForm(undefined, '2 tablets')).toBe('tablet');
    expect(resolveDosageForm(undefined, '1 cap')).toBe('capsule');
  });

  it('renders capsule dosage form image and details', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NextDoseCard dose={baseMockDose} totalScheduledToday={3} onMarkTaken={jest.fn()} />,
      );
    });

    const root = renderer!.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children).flat();
    expect(texts).toContain('Amoxicillin');
    expect(texts).toContain('1 capsule');
    expect(texts).toContain('8:00 AM');
    expect(texts).toContain('Take with full glass of water');

    const images = root.findAllByType(Image);
    const hasCapsule = images.some((img) => img.props.source === DOSAGE_FORM_ASSETS.capsule);
    expect(hasCapsule).toBe(true);
  });

  it('renders tablet dosage form image for tablet medications', () => {
    const tabletDose: IntakeQueueItem = {
      ...baseMockDose,
      medicationName: 'Metformin',
      dosageLabel: '1 tablet',
      medicationForm: 'tablet',
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NextDoseCard dose={tabletDose} totalScheduledToday={3} onMarkTaken={jest.fn()} />,
      );
    });

    const root = renderer!.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children).flat();
    expect(texts).toContain('Metformin');

    const images = root.findAllByType(Image);
    const hasTablet = images.some((img) => img.props.source === DOSAGE_FORM_ASSETS.tablet);
    expect(hasTablet).toBe(true);
  });

  it('renders syrup dosage form image for syrup medications', () => {
    const syrupDose: IntakeQueueItem = {
      ...baseMockDose,
      medicationName: 'Cough Syrup',
      dosageLabel: '10ml syrup',
      medicationForm: 'syrup',
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NextDoseCard dose={syrupDose} totalScheduledToday={3} onMarkTaken={jest.fn()} />,
      );
    });

    const root = renderer!.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children).flat();
    expect(texts).toContain('Cough Syrup');

    const images = root.findAllByType(Image);
    const hasSyrup = images.some((img) => img.props.source === DOSAGE_FORM_ASSETS.syrup);
    expect(hasSyrup).toBe(true);
  });

  it('renders injection dosage form image for injection medications', () => {
    const injectionDose: IntakeQueueItem = {
      ...baseMockDose,
      medicationName: 'Insulin Glargine',
      dosageLabel: '1 injection',
      medicationForm: 'injection',
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NextDoseCard dose={injectionDose} totalScheduledToday={3} onMarkTaken={jest.fn()} />,
      );
    });

    const root = renderer!.root;
    const images = root.findAllByType(Image);
    const hasInjection = images.some((img) => img.props.source === DOSAGE_FORM_ASSETS.injection);
    expect(hasInjection).toBe(true);
  });

  it('renders drop dosage form image for drop medications', () => {
    const dropDose: IntakeQueueItem = {
      ...baseMockDose,
      medicationName: 'Timolol',
      dosageLabel: '2 drops',
      medicationForm: 'drop',
    };

    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NextDoseCard dose={dropDose} totalScheduledToday={3} onMarkTaken={jest.fn()} />,
      );
    });

    const root = renderer!.root;
    const images = root.findAllByType(Image);
    const hasDrop = images.some((img) => img.props.source === DOSAGE_FORM_ASSETS.drop);
    expect(hasDrop).toBe(true);
  });

  it('renders all-done completed state when dose is null but total scheduled > 0', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NextDoseCard dose={null} totalScheduledToday={4} onMarkTaken={jest.fn()} />,
      );
    });

    const root = renderer!.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children).flat();
    expect(texts).toContain('All done for today');
  });

  it('renders empty scheduled state when dose is null and total scheduled is 0', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <NextDoseCard dose={null} totalScheduledToday={0} onMarkTaken={jest.fn()} />,
      );
    });

    const root = renderer!.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children).flat();
    expect(texts).toContain('Nothing scheduled yet today');
  });
});
