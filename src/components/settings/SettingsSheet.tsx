import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet';
import { forwardRef, useImperativeHandle, useMemo, useRef } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useLanguageStore, useTranslation, type LanguageCode } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { useSetThemePreference, useTheme, useThemePreference, type ThemePreference } from '../../theme/useTheme';

export interface SettingsSheetRef {
  present: () => void;
}

const LANGUAGE_OPTIONS: LanguageCode[] = ['en', 'bn'];
const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

interface OptionRowProps<T extends string> {
  options: T[];
  value: T;
  onSelect: (value: T) => void;
  labelFor: (value: T) => string;
}

function OptionRow<T extends string>({ options, value, onSelect, labelFor }: OptionRowProps<T>) {
  const theme = useTheme();
  return (
    <View className="flex-row gap-3">
      {options.map((option) => {
        const isActive = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => {
              if (option !== value) triggerHaptic('selection');
              onSelect(option);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: isActive }}
            className="min-h-hit flex-1 items-center justify-center rounded-full border"
            style={{
              backgroundColor: isActive ? theme.action.base : theme.colors.elevated,
              borderColor: isActive ? theme.action.base : theme.colors.hairline,
            }}
          >
            <Text className="text-body-lg" style={{ color: isActive ? theme.action.ink : theme.colors.ink }} numberOfLines={1}>
              {labelFor(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/**
 * App-wide preferences that aren't specific to any one feature screen —
 * language and appearance today, the natural place future cross-cutting
 * settings land rather than getting bolted onto whichever screen happened
 * to need them first. Lives behind its own bottom sheet (opened from Home,
 * same convention as `HealthRecordsSheet`) rather than a 7th bottom tab,
 * since it's a "visit occasionally" surface, not a daily-use one.
 */
export const SettingsSheet = forwardRef<SettingsSheetRef, Record<string, unknown>>(function SettingsSheetImpl(_props, ref) {
  const theme = useTheme();
  const { t } = useTranslation();
  const modalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['55%'], []);

  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const themePreference = useThemePreference();
  const setThemePreference = useSetThemePreference();

  useImperativeHandle(ref, () => ({ present: () => modalRef.current?.present() }), []);

  const languageLabel = (code: LanguageCode) => (code === 'en' ? t('settings.english') : t('settings.bengali'));
  const themeLabel = (preference: ThemePreference) =>
    preference === 'system' ? t('settings.themeSystem') : preference === 'light' ? t('settings.themeLight') : t('settings.themeDark');

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      backgroundStyle={{ backgroundColor: theme.colors.surface }}
      handleIndicatorStyle={{ backgroundColor: theme.colors.hairline }}
    >
      <BottomSheetView style={{ flex: 1 }}>
        <View className="gap-1 px-6 pb-6">
          <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
            {t('settings.title')}
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
            {t('settings.subtitle')}
          </Text>
        </View>

        <View className="gap-8 px-6">
          <View className="gap-3">
            <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
              {t('settings.language')}
            </Text>
            <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
              {t('settings.languageDescription')}
            </Text>
            <OptionRow options={LANGUAGE_OPTIONS} value={language} onSelect={setLanguage} labelFor={languageLabel} />
          </View>

          <View className="gap-3">
            <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
              {t('settings.theme')}
            </Text>
            <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
              {t('settings.themeDescription')}
            </Text>
            <OptionRow options={THEME_OPTIONS} value={themePreference} onSelect={setThemePreference} labelFor={themeLabel} />
          </View>
        </View>
      </BottomSheetView>
    </BottomSheetModal>
  );
});
