import { Minus, Plus } from 'lucide-react-native';
import { Pressable, Text, View } from 'react-native';
import { useTranslation, type TranslationKey } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';
import { classifyBloodPressure, type BloodPressureStage } from '../../vitals/bpClassification';

const BP_STAGE_KEY: Record<BloodPressureStage, TranslationKey> = {
  NORMAL: 'bpStage.NORMAL',
  ELEVATED: 'bpStage.ELEVATED',
  STAGE_1: 'bpStage.STAGE_1',
  STAGE_2: 'bpStage.STAGE_2',
  CRISIS: 'bpStage.CRISIS',
};

interface StepperRowProps {
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

function StepperRow({ label, value, min, max, onChange }: StepperRowProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const adjust = (delta: number) => {
    triggerHaptic('selection');
    onChange(Math.min(max, Math.max(min, value + delta)));
  };

  return (
    <View className="flex-row items-center justify-between">
      <Text className="text-body-lg" style={{ color: theme.colors.inkSecondary, width: 96 }}>
        {label}
      </Text>
      <View className="flex-row items-center gap-4">
        <Pressable
          onPress={() => adjust(-1)}
          accessibilityRole="button"
          accessibilityLabel={`${t('common.decrease')} ${label}`}
          className="min-h-hit min-w-hit items-center justify-center rounded-full border"
          style={{ width: 48, height: 48, borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface }}
        >
          <Minus color={theme.colors.ink} size={20} />
        </Pressable>
        <Text className="text-title-lg" style={{ color: theme.colors.ink, width: 64, textAlign: 'center' }}>
          {value}
        </Text>
        <Pressable
          onPress={() => adjust(1)}
          accessibilityRole="button"
          accessibilityLabel={`${t('common.increase')} ${label}`}
          className="min-h-hit min-w-hit items-center justify-center rounded-full border"
          style={{ width: 48, height: 48, borderColor: theme.colors.hairline, backgroundColor: theme.colors.surface }}
        >
          <Plus color={theme.colors.ink} size={20} />
        </Pressable>
      </View>
    </View>
  );
}

interface BloodPressureCardProps {
  systolic: number;
  diastolic: number;
  onChangeSystolic: (value: number) => void;
  onChangeDiastolic: (value: number) => void;
}

/** Live AHA staging feedback as the steppers move — the point of color-coding it is to show the classification before the reading is even saved, not after. */
export function BloodPressureCard({ systolic, diastolic, onChangeSystolic, onChangeDiastolic }: BloodPressureCardProps) {
  const theme = useTheme();
  const { t } = useTranslation();
  const classification = classifyBloodPressure(systolic, diastolic);

  return (
    <View className="gap-4 rounded-3xl border p-6" style={{ backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline }}>
      <Text className="text-caption uppercase tracking-wider" style={{ color: theme.colors.inkSecondary }}>
        {t('vitals.bloodPressure')}
      </Text>
      <StepperRow label={t('vitals.systolic')} value={systolic} min={60} max={260} onChange={onChangeSystolic} />
      <StepperRow label={t('vitals.diastolic')} value={diastolic} min={40} max={160} onChange={onChangeDiastolic} />
      <View className="flex-row items-center gap-2 self-start rounded-full px-4 py-2" style={{ backgroundColor: `${classification.color}1A` }}>
        <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: classification.color }} />
        <Text className="text-caption" style={{ color: classification.color, fontWeight: '700' }}>
          {t(BP_STAGE_KEY[classification.stage])}
        </Text>
      </View>
      {classification.urgent ? (
        <Text className="text-caption" style={{ color: classification.color }}>
          {t('bpStage.crisisWarning')}
        </Text>
      ) : null}
    </View>
  );
}
