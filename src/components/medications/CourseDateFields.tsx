import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { CalendarDays, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTheme } from '../../theme/useTheme';

interface CourseDateFieldsProps {
  label: string;
  startDate: string | null;
  endDate: string | null;
  startPlaceholder: string;
  endPlaceholder: string;
  startAccessibility: string;
  endAccessibility: string;
  clearAccessibility: (label: string) => string;
  hint: string;
  error?: string;
  onChange: (dates: { startDate?: string | null; endDate?: string | null }) => void;
}

function parseDate(value: string | null, fallback: Date): Date {
  if (!value) return fallback;
  const [year, month, day] = value.split('-').map(Number);
  if (!year || !month || !day) return fallback;
  const parsed = new Date(year, month - 1, day);
  return Number.isNaN(parsed.getTime()) ? fallback : parsed;
}

function formatDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

export function CourseDateFields({
  label,
  startDate,
  endDate,
  startPlaceholder,
  endPlaceholder,
  startAccessibility,
  endAccessibility,
  clearAccessibility,
  hint,
  error,
  onChange,
}: CourseDateFieldsProps) {
  const theme = useTheme();
  const [picker, setPicker] = useState<'start' | 'end' | null>(null);
  const today = new Date();
  const pickerValue = parseDate(picker === 'start' ? startDate : endDate, today);

  const handlePickerChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setPicker(null);
    if (event.type !== 'set' || !selectedDate || !picker) return;
    const value = formatDate(selectedDate);
    onChange(picker === 'start' ? { startDate: value } : { endDate: value });
  };

  const renderDateButton = (kind: 'start' | 'end') => {
    const value = kind === 'start' ? startDate : endDate;
    const placeholder = kind === 'start' ? startPlaceholder : endPlaceholder;
    const accessibilityLabel = kind === 'start' ? startAccessibility : endAccessibility;
    return (
      <View className="flex-1">
        <Pressable
          onPress={() => setPicker(kind)}
          accessibilityRole="button"
          accessibilityLabel={accessibilityLabel}
          className="min-h-hit flex-row items-center gap-2 rounded-2xl border px-4"
          style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}
        >
          <CalendarDays color={theme.colors.inkMuted} size={18} />
          <Text className="flex-1 text-body" style={{ color: value ? theme.colors.ink : theme.colors.inkMuted }}>
            {value ?? placeholder}
          </Text>
          {value ? (
            <Pressable
              onPress={() => onChange(kind === 'start' ? { startDate: null } : { endDate: null })}
              accessibilityRole="button"
              accessibilityLabel={clearAccessibility(accessibilityLabel)}
              hitSlop={8}
            >
              <X color={theme.colors.inkMuted} size={18} />
            </Pressable>
          ) : null}
        </Pressable>
      </View>
    );
  };

  return (
    <View className="gap-2">
      <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
        {label}
      </Text>
      <View className="flex-row gap-3">
        {renderDateButton('start')}
        {renderDateButton('end')}
      </View>
      <Text className="text-caption" style={{ color: error ? theme.statusText('missed') : theme.colors.inkMuted }}>
        {error ?? hint}
      </Text>
      {picker ? (
        <DateTimePicker
          value={pickerValue}
          mode="date"
          display="default"
          onChange={handlePickerChange}
          minimumDate={picker === 'end' && startDate ? parseDate(startDate, today) : undefined}
          maximumDate={picker === 'start' && endDate ? parseDate(endDate, today) : undefined}
        />
      ) : null}
    </View>
  );
}
