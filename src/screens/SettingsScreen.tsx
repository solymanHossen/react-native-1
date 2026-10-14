import { ArrowLeft, Check, Globe, Info, Monitor, Moon, Play, Sun, Volume2 } from 'lucide-react-native';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useVoicePreferenceStore } from '../alarms';
import { useLanguageStore, useTranslation, type LanguageCode } from '../i18n';
import { triggerHaptic } from '../lib/haptics';
import { speakReminder } from '../lib/tts';
import { useSetThemePreference, useTheme, useThemePreference, type ThemePreference } from '../theme/useTheme';

const LANGUAGE_OPTIONS: LanguageCode[] = ['en', 'bn'];
const THEME_OPTIONS: ThemePreference[] = ['system', 'light', 'dark'];

export interface SettingsScreenProps {
  onBack: () => void;
}

export default function SettingsScreen({ onBack }: SettingsScreenProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const { t } = useTranslation();
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);
  const themePreference = useThemePreference();
  const setThemePreference = useSetThemePreference();
  const voiceEnabled = useVoicePreferenceStore((state) => state.voiceAnnouncementsEnabled);
  const setVoiceEnabled = useVoicePreferenceStore((state) => state.setVoiceAnnouncementsEnabled);

  const handleToggleVoice = (next: boolean) => {
    triggerHaptic('selection');
    setVoiceEnabled(next);
  };

  const handleTestVoice = () => {
    triggerHaptic('selection');
    speakReminder(t('settings.testVoiceMessage'), language).catch(() => {});
  };

  const languageLabel = (code: LanguageCode) => (code === 'en' ? t('settings.english') : t('settings.bengali'));
  const themeLabel = (preference: ThemePreference) =>
    preference === 'system' ? t('settings.themeSystem') : preference === 'light' ? t('settings.themeLight') : t('settings.themeDark');

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: theme.colors.canvas }}>
      {/* Top Header */}
      <View className="flex-row items-center gap-3.5 px-6 pt-3 pb-3">
        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            onBack();
          }}
          accessibilityRole="button"
          accessibilityLabel={t('common.back')}
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'transparent' }}
        >
          <ArrowLeft color={theme.colors.ink} size={24} strokeWidth={2.4} />
        </Pressable>
        <View className="flex-1">
          <Text className="text-[26px] font-extrabold tracking-tight" style={{ color: theme.colors.ink }}>
            {t('settings.title')}
          </Text>
          <Text className="text-[14px] font-medium mt-0.5" style={{ color: theme.colors.inkSecondary }}>
            {t('settings.subtitle')}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerClassName="gap-5 px-6 py-4" showsVerticalScrollIndicator={false}>
        {/* Language Card */}
        <View
          className="rounded-[26px] border p-5 shadow-sm"
          style={{
            backgroundColor: theme.alarms.card.bg,
            borderColor: theme.alarms.card.border,
            shadowColor: theme.alarms.card.shadowColor,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: theme.alarms.card.shadowOpacity,
            shadowRadius: 8,
            elevation: 1,
          }}
        >
          <View className="flex-row items-center gap-3.5">
            <View
              className="h-11 w-11 items-center justify-center rounded-2xl"
              style={{ backgroundColor: theme.alarms.bell.badge }}
            >
              <Globe color={theme.alarms.bell.icon} size={22} strokeWidth={2.2} />
            </View>
            <View className="flex-1">
              <Text className="text-[18px] font-bold tracking-tight" style={{ color: theme.alarms.card.title }}>
                {t('settings.language')}
              </Text>
              <Text className="text-[13.5px] font-medium mt-0.5" style={{ color: theme.alarms.card.subtitle }}>
                {t('settings.languageDescription')}
              </Text>
            </View>
          </View>

          {/* Language Selection Buttons */}
          <View className="flex-row gap-3 mt-4">
            {LANGUAGE_OPTIONS.map((code) => {
              const active = code === language;
              return (
                <Pressable
                  key={code}
                  onPress={() => {
                    if (!active) triggerHaptic('selection');
                    setLanguage(code);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  className="flex-1 flex-row items-center justify-center gap-2 h-[52px] rounded-2xl border"
                  style={{
                    backgroundColor: active
                      ? theme.action.base
                      : isDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : '#FFFFFF',
                    borderColor: active
                      ? theme.action.base
                      : isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : '#E2E8F0',
                  }}
                >
                  <Text
                    className="text-[16px] font-bold"
                    style={{
                      color: active ? '#FFFFFF' : theme.alarms.card.title,
                    }}
                  >
                    {languageLabel(code)}
                  </Text>
                  {active ? (
                    <View className="h-5 w-5 rounded-full items-center justify-center bg-white">
                      <Check color={theme.action.base} size={12} strokeWidth={3} />
                    </View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Appearance Card */}
        <View
          className="rounded-[26px] border p-5 shadow-sm"
          style={{
            backgroundColor: theme.alarms.card.bg,
            borderColor: theme.alarms.card.border,
            shadowColor: theme.alarms.card.shadowColor,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: theme.alarms.card.shadowOpacity,
            shadowRadius: 8,
            elevation: 1,
          }}
        >
          <View className="flex-row items-center gap-3.5">
            <View
              className="h-11 w-11 items-center justify-center rounded-2xl"
              style={{ backgroundColor: theme.alarms.bell.badge }}
            >
              <Sun color={theme.alarms.bell.icon} size={22} strokeWidth={2.2} />
            </View>
            <View className="flex-1">
              <Text className="text-[18px] font-bold tracking-tight" style={{ color: theme.alarms.card.title }}>
                {t('settings.theme')}
              </Text>
              <Text className="text-[13.5px] font-medium mt-0.5" style={{ color: theme.alarms.card.subtitle }}>
                {t('settings.themeDescription')}
              </Text>
            </View>
          </View>

          {/* 3 Theme Option Tiles */}
          <View className="flex-row gap-2.5 mt-4">
            {THEME_OPTIONS.map((pref) => {
              const active = pref === themePreference;
              const IconComponent = pref === 'system' ? Monitor : pref === 'light' ? Sun : Moon;
              return (
                <Pressable
                  key={pref}
                  onPress={() => {
                    if (!active) triggerHaptic('selection');
                    setThemePreference(pref);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: active }}
                  className="flex-1 items-center justify-center py-4 rounded-2xl border"
                  style={{
                    backgroundColor: active
                      ? isDark
                        ? 'rgba(59, 130, 246, 0.14)'
                        : '#EFF6FF'
                      : isDark
                        ? 'rgba(255, 255, 255, 0.04)'
                        : '#FFFFFF',
                    borderColor: active
                      ? theme.action.base
                      : isDark
                        ? 'rgba(255, 255, 255, 0.08)'
                        : '#E2E8F0',
                    borderWidth: active ? 2 : 1,
                  }}
                >
                  {/* Active top-right checkmark badge */}
                  {active ? (
                    <View
                      className="absolute top-2 right-2 h-4 w-4 rounded-full items-center justify-center"
                      style={{ backgroundColor: theme.action.base }}
                    >
                      <Check color="#FFFFFF" size={10} strokeWidth={3} />
                    </View>
                  ) : null}

                  <IconComponent
                    color={active ? theme.action.base : isDark ? '#94A3B8' : '#64748B'}
                    size={23}
                    strokeWidth={2.2}
                  />
                  <Text
                    className="text-[14px] font-bold mt-2"
                    style={{
                      color: active ? theme.action.base : isDark ? '#E2E8F0' : '#334155',
                    }}
                  >
                    {themeLabel(pref)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Voice Alarm Card */}
        <View
          className="rounded-[26px] border p-5 shadow-sm"
          style={{
            backgroundColor: theme.alarms.card.bg,
            borderColor: theme.alarms.card.border,
            shadowColor: theme.alarms.card.shadowColor,
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: theme.alarms.card.shadowOpacity,
            shadowRadius: 8,
            elevation: 1,
          }}
        >
          <View className="flex-row items-center justify-between">
            <View className="flex-row items-center gap-3.5 flex-1 mr-2">
              <View
                className="h-11 w-11 items-center justify-center rounded-2xl"
                style={{ backgroundColor: theme.alarms.bell.badge }}
              >
                <Volume2 color={theme.alarms.bell.icon} size={22} strokeWidth={2.2} />
              </View>
              <Text className="text-[18px] font-bold tracking-tight" style={{ color: theme.alarms.card.title }}>
                {t('settings.voiceAlarm')}
              </Text>
            </View>
            <Switch
              value={voiceEnabled}
              onValueChange={handleToggleVoice}
              trackColor={{
                false: isDark ? 'rgba(255, 255, 255, 0.12)' : '#E2E8F0',
                true: theme.action.base,
              }}
              thumbColor="#FFFFFF"
              accessibilityLabel={t('settings.voiceAlarmAccessibility')}
            />
          </View>

          <Text
            className="text-[13.5px] font-medium leading-[20px] mt-2.5"
            style={{ color: theme.alarms.card.subtitle }}
          >
            {t('settings.voiceAlarmDescription')}
          </Text>

          {/* Info Callout Box */}
          <View
            className="flex-row items-center gap-2.5 rounded-2xl px-3.5 py-3 mt-3.5 mb-4 border"
            style={{
              backgroundColor: isDark ? 'rgba(59, 130, 246, 0.1)' : '#F0F9FF',
              borderColor: isDark ? 'rgba(59, 130, 246, 0.2)' : '#E0F2FE',
            }}
          >
            <Info color={theme.action.base} size={18} strokeWidth={2.2} />
            <Text
              className="text-[13px] font-medium leading-[18px] flex-1"
              style={{ color: isDark ? '#93C5FD' : '#334155' }}
            >
              {t('settings.voiceInfo')}
            </Text>
          </View>

          {/* Test Voice Button */}
          <Pressable
            onPress={handleTestVoice}
            accessibilityRole="button"
            className="flex-row items-center justify-center gap-2.5 rounded-2xl h-[52px] shadow-sm"
            style={{ backgroundColor: theme.action.base }}
          >
            <Play color="#FFFFFF" fill="#FFFFFF" size={17} />
            <Text className="text-[16px] font-bold text-white">
              {t('settings.testVoice')}
            </Text>
          </Pressable>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
