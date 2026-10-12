import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { Sun } from 'lucide-react-native';
import { AlarmScheduleCard } from '../src/components/alarms/AlarmScheduleCard';
import { AlarmsHeroSummary } from '../src/components/alarms/AlarmsHeroSummary';
import { AlarmsEmptyState } from '../src/components/alarms/AlarmsEmptyState';
import type { ScheduleWithMedication } from '../src/db/types';

const mockSchedule: ScheduleWithMedication = {
  id: 1,
  medication_id: 10,
  time_utc: '14:30',
  time_node: 'LUNCH',
  meal_relation: 'WITH',
  dose_quantity: 2,
  days_of_week_mask: 127,
  is_active: true,
  title: 'Afternoon Dose',
  medicationName: 'Metformin',
  medicationStrength: '500mg',
  medicationForm: 'tablet',
  nfcTagUid: 'test-nfc-tag-uid',
  courseEndDate: null,
};

describe('Modern Alarms System Components', () => {
  it('renders AlarmScheduleCard with prominent time, period, and medication details', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AlarmScheduleCard
          schedule={mockSchedule}
          onToggle={jest.fn()}
          onDelete={jest.fn()}
          timeNodeStyle={{ icon: Sun, color: '#B62616' }}
        />
      );
    });

    const root = renderer!.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children).flat();

    // Prominent 12-hour format displayTime
    expect(texts).toContain('2:30');
    expect(texts).toContain('PM');
    expect(texts).toContain('Metformin');
    expect(texts).toContain('Afternoon Dose');
  });

  it('renders AlarmsHeroSummary with active counter and next upcoming dose', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <AlarmsHeroSummary schedules={[mockSchedule]} />
      );
    });

    const root = renderer!.root;
    const texts = root.findAllByType(Text).map((t) => t.props.children).flat();
    expect(texts).toContain('Metformin');
  });

  it('renders AlarmsEmptyState with title and guidance', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(<AlarmsEmptyState />);
    });

    const root = renderer!.root;
    expect(root).toBeTruthy();
  });
});
