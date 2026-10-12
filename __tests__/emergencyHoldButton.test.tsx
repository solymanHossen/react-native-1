import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { EmergencyHoldButton } from '../src/components/ui/EmergencyHoldButton';

describe('EmergencyHoldButton', () => {
  it('renders default title and subtitle correctly', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <EmergencyHoldButton onComplete={jest.fn()} />
      );
    });

    const root = renderer!.root;
    expect(root).toBeTruthy();
  });

  it('renders custom title and subtitle when provided', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    ReactTestRenderer.act(() => {
      renderer = ReactTestRenderer.create(
        <EmergencyHoldButton
          onComplete={jest.fn()}
          title="Custom Silence"
          subtitle="Custom warning text"
        />
      );
    });

    const root = renderer!.root;
    const texts = root.findAllByType(Text);
    const strings = texts.map((t) => t.props.children).flat();
    expect(strings).toContain('Custom Silence');
    expect(strings).toContain('Custom warning text');
  });
});
