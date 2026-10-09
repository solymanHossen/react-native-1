import { ArrowLeft, Languages, Moon, Smartphone } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLanguageStore, useTranslation, type LanguageCode } from '../i18n';
import { triggerHaptic } from '../lib/haptics';
import { useSetThemePreference, useTheme, useThemePreference, type ThemePreference } from '../theme/useTheme';

const LANGUAGE_OPTIONS: LanguageCode[] = ['en', 'bn'];
const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

function ChoiceRow<T extends string>({
  options,
  value,
  onSelect,
  labelFor,
}: {
  options: T[];
  value: T;
  onSelect: (value: T) => void;
  labelFor: (value: T) => string;
}) {
  const theme = useTheme();
  return (
    <View className="flex-row gap-2">
      {options.map((option) => {
        const active = option === value;
        return (
          <Pressable
            key={option}
            onPress={() => {
              if (!active) triggerHaptic('selection');
              onSelect(option);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: active }}
            className="min-h-hit flex-1 items-center justify-center rounded-2xl border px-2"
            style={{ backgroundColor: active ? theme.action.base : theme.colors.surface, borderColor: active ? theme.action.base : theme.colors.hairline }}
          >
            <Text className="text-caption" style={{ color: active ? theme.action.ink : theme.colors.ink, fontWeight: '700' }} numberOfLines={1}>
              {labelFor(option)}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const themePreference = useThemePreference();
  const setThemePreference = useSetThemePreference();

  const languageLabel = (code: LanguageCode) => (code === 'en' ? t('settings.english') : t('settings.bengali'));
  const themeLabel = (preference: ThemePreference) =>
    preference === 'system' ? t('settings.themeSystem') : preference === 'light' ? t('settings.themeLight') : t('settings.themeDark');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: theme.colors.canvas }}>
      <View className="flex-row items-center gap-3 border-b px-6 pb-4 pt-3" style={{ borderColor: theme.colors.hairline }}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel={t('common.back')} className="min-h-hit min-w-hit items-center justify-center rounded-full">
          <ArrowLeft color={theme.colors.ink} size={23} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-title-lg" style={{ color: theme.colors.ink }}>
            {t('settings.title')}
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
            {t('settings.subtitle')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-5 px-6 py-6" showsVerticalScrollIndicator={false}>
        <View className="gap-4 rounded-3xl border p-5" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
          <View className="flex-row items-center gap-3">
            <View className="items-center justify-center rounded-2xl" style={{ width: 44, height: 44, backgroundColor: `${theme.action.base}18` }}>
              <Languages color={theme.action.base} size={22} />
            </View>
            <View className="flex-1">
              <Text className="text-body-lg" style={{ color: theme.colors.ink, fontWeight: '700' }}>
                {t('settings.language')}
              </Text>
              <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                {t('settings.languageDescription')}
              </Text>
            </View>
          </View>
          <ChoiceRow options={LANGUAGE_OPTIONS} value={language} onSelect={setLanguage} labelFor={languageLabel} />
        </View>

        <View className="gap-4 rounded-3xl border p-5" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
          <View className="flex-row items-center gap-3">
            <View className="items-center justify-center rounded-2xl" style={{ width: 44, height: 44, backgroundColor: `${theme.action.base}18` }}>
              {themePreference === 'system' ? <Smartphone color={theme.action.base} size={22} /> : <Moon color={theme.action.base} size={22} />}
            </View>
            <View className="flex-1">
              <Text className="text-body-lg" style={{ color: theme.colors.ink, fontWeight: '700' }}>
                {t('settings.theme')}
              </Text>
              <Text className="text-caption" style={{ color: theme.colors.inkSecondary }}>
                {t('settings.themeDescription')}
              </Text>
            </View>
          </View>
          <ChoiceRow options={THEME_OPTIONS} value={themePreference} onSelect={setThemePreference} labelFor={themeLabel} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
