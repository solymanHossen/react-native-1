import { Text, View } from 'react-native';
import { BellOff } from 'lucide-react-native';
import { useTranslation } from '../../i18n';
import { useTheme } from '../../theme/useTheme';

/**
 * Modern Empty State for the Medication Alarms List.
 *
 * Renders an engaging, glassmorphic card when no alarms have been created yet,
 * providing clear clinical guidance to choose a medication from the carousel above.
 */
export function AlarmsEmptyState() {
  const theme = useTheme();
  const { t } = useTranslation();
  const isDark = theme.mode === 'dark';

  return (
    <View
      className="items-center justify-center rounded-3xl border p-8 text-center"
      style={{
        backgroundColor: theme.colors.elevated,
        borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
      }}
    >
      <View
        className="mb-4 items-center justify-center rounded-3xl border"
        style={{
          width: 64,
          height: 64,
          backgroundColor: isDark ? 'rgba(255, 255, 255, 0.04)' : `${theme.action.base}10`,
          borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : `${theme.action.base}20`,
        }}
      >
        <BellOff color={theme.colors.inkMuted} size={30} strokeWidth={1.8} />
      </View>

      <Text className="text-title-md font-bold text-center" style={{ color: theme.colors.ink }}>
        {t('alarms.emptyTitle')}
      </Text>

      <Text
        className="mt-2 text-center text-body leading-relaxed"
        style={{ color: theme.colors.inkSecondary, maxWidth: 300 }}
      >
        {t('alarms.emptySubtitle')}
      </Text>
    </View>
  );
}
