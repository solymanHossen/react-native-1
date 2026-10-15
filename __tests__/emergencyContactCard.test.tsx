import React from 'react';
import { Text } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { EmergencyContactCard, maskPhone } from '../src/components/alarms/EmergencyContactCard';

describe('EmergencyContactCard & maskPhone', () => {
  describe('maskPhone', () => {
    it('masks phone numbers preserving the last prefix digit and final 4 digits', () => {
      // 12 digit number like 123456723423
      expect(maskPhone('123456723423')).toBe('•••••••2 3423');
      // Number with leading +
      expect(maskPhone('+123456723423')).toBe('•••••••2 3423');
      // Short numbers (4 or fewer digits) returned as is
      expect(maskPhone('1234')).toBe('1234');
    });
  });

  describe('EmergencyContactCard Component', () => {
    it('renders the configured contact card matching reference design', () => {
      const onEdit = jest.fn();
      const onDelete = jest.fn();

      let renderer: ReactTestRenderer.ReactTestRenderer;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <EmergencyContactCard
            phone="+123456723423"
            onEdit={onEdit}
            onDelete={onDelete}
          />,
        );
      });

      const root = renderer!.root;
      const allTexts = root.findAllByType(Text).map((t) => t.props.children).flat();

      expect(allTexts).toContain('Emergency Contact');
      expect(allTexts).toContain('Active · Missed dose alert on');
      expect(allTexts).toContain('If you miss a dose by 15 minutes, we’ll send a quick alert to this person.');
      expect(allTexts).toContain('Alert recipient');
      expect(allTexts).toContain('•••••••2 3423');
      expect(allTexts).toContain('Edit');

      // Test Edit button interaction
      const buttons = root.findAll((node) => typeof node.props?.onPress === 'function');
      expect(buttons.length).toBeGreaterThan(0);

      const editButton = buttons.find(
        (p) => p.props.accessibilityLabel === 'Edit saved emergency contact'
      );
      expect(editButton).toBeDefined();
      ReactTestRenderer.act(() => {
        editButton!.props.onPress();
      });
      expect(onEdit).toHaveBeenCalled();

      // Test Delete button interaction
      const deleteButton = buttons.find(
        (p) => p.props.accessibilityLabel === 'Remove saved emergency contact'
      );
      expect(deleteButton).toBeDefined();
      ReactTestRenderer.act(() => {
        deleteButton!.props.onPress();
      });
      expect(onDelete).toHaveBeenCalled();
    });

    it('renders the unconfigured empty state when phone is null', () => {
      const onAdd = jest.fn();
      const onEdit = jest.fn();
      const onDelete = jest.fn();

      let renderer: ReactTestRenderer.ReactTestRenderer;
      ReactTestRenderer.act(() => {
        renderer = ReactTestRenderer.create(
          <EmergencyContactCard
            phone={null}
            onEdit={onEdit}
            onDelete={onDelete}
            onAdd={onAdd}
          />,
        );
      });

      const root = renderer!.root;
      const allTexts = root.findAllByType(Text).map((t) => t.props.children).flat();

      expect(allTexts).toContain('Emergency Contact');
      expect(allTexts).toContain('Add Emergency Contact');

      const buttons = root.findAll((node) => typeof node.props?.onPress === 'function');
      const addButton = buttons.find(
        (p) => p.props.accessibilityLabel === 'Add an emergency contact'
      );
      expect(addButton).toBeDefined();
      ReactTestRenderer.act(() => {
        addButton!.props.onPress();
      });
      expect(onAdd).toHaveBeenCalled();
    });
  });
});
