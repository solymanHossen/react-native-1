import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { TodayStatusCard } from '../src/components/dashboard/TodayStatusCard';

describe('TodayStatusCard', () => {
  it('renders status label and count accurately', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <TodayStatusCard status="taken" label="Taken" count={3} />
      );
    });

    const root = renderer!.root;
    const texts = root.findAllByType(Text);
    const strings = texts.map((t) => t.props.children).flat();
    expect(strings).toContain('Taken');
    expect(strings).toContain(3);
  });

  it('renders missed status correctly', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <TodayStatusCard status="missed" label="Missed" count={5} />
      );
    });

    const root = renderer!.root;
    const texts = root.findAllByType(Text);
    const strings = texts.map((t) => t.props.children).flat();
    expect(strings).toContain('Missed');
    expect(strings).toContain(5);
  });
});
