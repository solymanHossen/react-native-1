import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { ArrowRight, Check, Shield, X } from 'lucide-react-native';
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { initializeDatabase } from '../../db';
import type { RecentIntakeContext, SymptomSeverity } from '../../db/types';
import { useTranslation, type TranslationKey } from '../../i18n';
import { triggerHaptic } from '../../lib/haptics';
import { useTheme } from '../../theme/useTheme';

const COMMON_SYMPTOMS = ['Nausea', 'Dizziness', 'Acid Reflux', 'Headache', 'Fatigue', 'Rash'] as const;
const SEVERITIES: SymptomSeverity[] = ['MILD', 'MODERATE', 'SEVERE'];

const SYMPTOM_GRID: [
  [(typeof COMMON_SYMPTOMS)[number], (typeof COMMON_SYMPTOMS)[number]],
  [(typeof COMMON_SYMPTOMS)[number], (typeof COMMON_SYMPTOMS)[number]],
  [(typeof COMMON_SYMPTOMS)[number], (typeof COMMON_SYMPTOMS)[number]],
] = [
  ['Nausea', 'Dizziness'],
  ['Acid Reflux', 'Headache'],
  ['Fatigue', 'Rash'],
];

const SEVERITY_KEY: Record<SymptomSeverity, TranslationKey> = {
  MILD: 'vitals.symptomSheet.mild',
  MODERATE: 'vitals.symptomSheet.moderate',
  SEVERE: 'vitals.symptomSheet.severe',
};

const SYMPTOM_IMAGES = {
  Nausea: require('../../../assets/symptoms/nausea.png'),
  Dizziness: require('../../../assets/symptoms/dizziness.png'),
  'Acid Reflux': require('../../../assets/symptoms/acid_reflux.png'),
  Headache: require('../../../assets/symptoms/headache.png'),
  Fatigue: require('../../../assets/symptoms/fatigue.png'),
  Rash: require('../../../assets/symptoms/rash.png'),
} as const;

interface SymptomConfig {
  key: TranslationKey;
  image: (typeof SYMPTOM_IMAGES)[keyof typeof SYMPTOM_IMAGES];
  badgeBgLight: string;
  badgeBgDark: string;
}

const SYMPTOM_CONFIGS: Record<(typeof COMMON_SYMPTOMS)[number], SymptomConfig> = {
  Nausea: {
    key: 'vitals.symptomSheet.symptoms.Nausea',
    image: SYMPTOM_IMAGES.Nausea,
    badgeBgLight: '#FEE2E2',
    badgeBgDark: 'rgba(239, 68, 68, 0.16)',
  },
  Dizziness: {
    key: 'vitals.symptomSheet.symptoms.Dizziness',
    image: SYMPTOM_IMAGES.Dizziness,
    badgeBgLight: '#DCFCE7',
    badgeBgDark: 'rgba(16, 185, 129, 0.16)',
  },
  'Acid Reflux': {
    key: 'vitals.symptomSheet.symptoms.Acid Reflux',
    image: SYMPTOM_IMAGES['Acid Reflux'],
    badgeBgLight: '#FFEDD5',
    badgeBgDark: 'rgba(249, 115, 22, 0.16)',
  },
  Headache: {
    key: 'vitals.symptomSheet.symptoms.Headache',
    image: SYMPTOM_IMAGES.Headache,
    badgeBgLight: '#FEE2E2',
    badgeBgDark: 'rgba(239, 68, 68, 0.16)',
  },
  Fatigue: {
    key: 'vitals.symptomSheet.symptoms.Fatigue',
    image: SYMPTOM_IMAGES.Fatigue,
    badgeBgLight: '#EDE9FE',
    badgeBgDark: 'rgba(139, 92, 246, 0.16)',
  },
  Rash: {
    key: 'vitals.symptomSheet.symptoms.Rash',
    image: SYMPTOM_IMAGES.Rash,
    badgeBgLight: '#DBEAFE',
    badgeBgDark: 'rgba(37, 99, 235, 0.16)',
  },
};

// --- Severity Signal Bars ---
function SeverityBars({
  level,
  isSelected,
  activeColor = '#2563EB',
  inactiveColor = '#CBD5E1',
}: {
  level: SymptomSeverity;
  isSelected: boolean;
  activeColor?: string;
  inactiveColor?: string;
}) {
  const getBarColors = () => {
    if (isSelected) {
      if (level === 'MILD') return [activeColor, inactiveColor, inactiveColor];
      if (level === 'MODERATE') return [activeColor, activeColor, inactiveColor];
      return ['#EF4444', '#EF4444', '#EF4444'];
    }
    if (level === 'MILD') return ['#94A3B8', inactiveColor, inactiveColor];
    if (level === 'MODERATE') return ['#94A3B8', '#94A3B8', inactiveColor];
    return ['#EF4444', '#EF4444', '#EF4444'];
  };

  const colors = getBarColors();

  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 16, gap: 2.5, marginRight: 6 }}>
      <View style={{ width: 3.5, height: 7, borderRadius: 1.8, backgroundColor: colors[0] }} />
      <View style={{ width: 3.5, height: 11, borderRadius: 1.8, backgroundColor: colors[1] }} />
      <View style={{ width: 3.5, height: 15, borderRadius: 1.8, backgroundColor: colors[2] }} />
    </View>
  );
}

export interface SymptomLogSheetRef {
  present: () => void;
}

export const SymptomLogSheet = forwardRef<SymptomLogSheetRef, Record<string, unknown>>(function SymptomLogSheetImpl(_props, ref) {
  const theme = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const modalRef = useRef<BottomSheetModal>(null);
  const snapPoints = useMemo(() => ['82%'], []);
  const bottomPadding = Math.max(insets.bottom, 16) + 20;
  const isDark = theme.mode === 'dark';

  const [symptom, setSymptom] = useState<(typeof COMMON_SYMPTOMS)[number] | null>(null);
  const [severity, setSeverity] = useState<SymptomSeverity>('MODERATE');
  const [relatedMeds, setRelatedMeds] = useState<RecentIntakeContext[] | null>(null);
  const [saving, setSaving] = useState(false);

  useImperativeHandle(
    ref,
    () => ({
      present: () => {
        setSymptom(null);
        setSeverity('MODERATE');
        setRelatedMeds(null);
        modalRef.current?.present();
      },
    }),
    [],
  );

  const handleSave = useCallback(async () => {
    if (!symptom) return;
    setSaving(true);
    try {
      const database = await initializeDatabase();
      const timestamp = new Date().toISOString();
      await database.symptoms.record({ timestamp, symptom, severity, notes: null });
      const recent = await database.symptoms.listRecentIntakesAround(timestamp);
      setRelatedMeds(recent);
      triggerHaptic('notificationSuccess');
    } finally {
      setSaving(false);
    }
  }, [symptom, severity]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      snapPoints={snapPoints}
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{ backgroundColor: isDark ? theme.colors.surface : '#FFFFFF' }}
      handleIndicatorStyle={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : '#CBD5E1', width: 38, height: 4 }}
    >
      <BottomSheetScrollView
        contentContainerStyle={{ paddingBottom: bottomPadding }}
        showsVerticalScrollIndicator={false}
      >
        {/* --- Top Header Row --- */}
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 20, paddingTop: 6, paddingBottom: 14, gap: 14 }}>
          {/* Medical Record Document Squircle Badge */}
          <View
            style={{
              width: 50,
              height: 50,
              borderRadius: 16,
              backgroundColor: isDark ? 'rgba(37, 99, 235, 0.16)' : '#E8F1FC',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={26} height={26} viewBox="0 0 24 24">
              <Path
                d="M5 4a2 2 0 0 1 2-2h8l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4Z"
                fill="#1A56DB"
              />
              <Path d="M15 2v4a1 1 0 0 0 1 1h4" fill="#60A5FA" />
              <Path
                d="M12 9.5v5M9.5 12h5"
                stroke="#FFFFFF"
                strokeWidth={2.4}
                strokeLinecap="round"
              />
            </Svg>
          </View>

          {/* Title and Subtitle */}
          <View style={{ flex: 1, paddingTop: 1 }}>
            <Text
              style={{
                fontSize: 20,
                fontWeight: '700',
                letterSpacing: -0.3,
                color: isDark ? '#FFFFFF' : '#0F172A',
              }}
            >
              {t('vitals.symptomSheet.title')}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '400',
                lineHeight: 18,
                color: isDark ? '#94A3B8' : '#64748B',
                marginTop: 3,
              }}
              numberOfLines={2}
            >
              {t('vitals.symptomSheet.subtitle')}
            </Text>
          </View>

          {/* Circular Close Button */}
          <Pressable
            onPress={() => modalRef.current?.dismiss()}
            accessibilityRole="button"
            accessibilityLabel={t('common.done')}
            style={{
              width: 32,
              height: 32,
              borderRadius: 16,
              backgroundColor: isDark ? '#1E293B' : '#F1F5F9',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color={isDark ? '#94A3B8' : '#64748B'} strokeWidth={2.2} />
          </Pressable>
        </View>

        {relatedMeds === null ? (
          <View style={{ paddingHorizontal: 20 }}>
            {/* --- Section 1: COMMON SYMPTOMS --- */}
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                color: isDark ? '#94A3B8' : '#64748B',
                marginTop: 6,
                marginBottom: 10,
              }}
            >
              {t('vitals.symptomSheet.commonSymptoms')}
            </Text>

            {/* 2-Column Symptom Grid (3 rows) */}
            <View style={{ gap: 10 }}>
              {SYMPTOM_GRID.map((row, rowIndex) => (
                <View key={`row-${rowIndex}`} style={{ flexDirection: 'row', gap: 10 }}>
                  {row.map((option) => {
                    const isActive = symptom === option;
                    const config = SYMPTOM_CONFIGS[option];

                    return (
                      <Pressable
                        key={option}
                        onPress={() => {
                          triggerHaptic('selection');
                          setSymptom(option);
                        }}
                        accessibilityRole="button"
                        accessibilityState={{ selected: isActive }}
                        style={{
                          flex: 1,
                          height: 58,
                          borderRadius: 16,
                          paddingHorizontal: 12,
                          flexDirection: 'row',
                          alignItems: 'center',
                          backgroundColor: isActive
                            ? '#2764B8'
                            : isDark
                              ? theme.colors.elevated
                              : '#FFFFFF',
                          borderWidth: 1,
                          borderColor: isActive
                            ? '#2764B8'
                            : isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : '#E2E8F0',
                        }}
                      >
                        {/* Left Circular Badge */}
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 19,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isActive
                              ? 'rgba(255, 255, 255, 0.22)'
                              : isDark
                                ? config.badgeBgDark
                                : config.badgeBgLight,
                          }}
                        >
                          <Image
                            source={config.image}
                            style={{ width: 28, height: 28 }}
                            resizeMode="contain"
                          />
                        </View>

                        {/* Symptom Label */}
                        <Text
                          style={{
                            marginLeft: 10,
                            flex: 1,
                            fontSize: 14.5,
                            fontWeight: isActive ? '700' : '600',
                            color: isActive
                              ? '#FFFFFF'
                              : isDark
                                ? '#F8FAFC'
                                : '#1E293B',
                          }}
                          numberOfLines={1}
                        >
                          {t(config.key)}
                        </Text>

                        {/* Active Selection Checkmark Badge */}
                        {isActive && (
                          <View
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 11,
                              backgroundColor: '#FFFFFF',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            <Check size={13} color="#2764B8" strokeWidth={3} />
                          </View>
                        )}
                      </Pressable>
                    );
                  })}
                </View>
              ))}
            </View>

            {/* --- Section 2: SEVERITY --- */}
            <Text
              style={{
                fontSize: 11.5,
                fontWeight: '700',
                textTransform: 'uppercase',
                letterSpacing: 0.8,
                color: isDark ? '#94A3B8' : '#64748B',
                marginTop: 20,
                marginBottom: 10,
              }}
            >
              {t('vitals.symptomSheet.severity')}
            </Text>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              {SEVERITIES.map((level) => {
                const isActive = severity === level;
                return (
                  <Pressable
                    key={level}
                    onPress={() => {
                      triggerHaptic('selection');
                      setSeverity(level);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isActive }}
                    style={{
                      flex: 1,
                      height: 52,
                      borderRadius: 16,
                      paddingHorizontal: 8,
                      flexDirection: 'row',
                      alignItems: 'center',
                      justifyContent: 'center',
                      backgroundColor: isActive
                        ? isDark
                          ? 'rgba(37, 99, 235, 0.16)'
                          : '#EFF6FF'
                        : isDark
                          ? theme.colors.elevated
                          : '#FFFFFF',
                      borderWidth: isActive ? 1.5 : 1,
                      borderColor: isActive
                        ? '#3B82F6'
                        : isDark
                          ? 'rgba(255, 255, 255, 0.08)'
                          : '#E2E8F0',
                    }}
                  >
                    <SeverityBars
                      level={level}
                      isSelected={isActive}
                      activeColor={isDark ? '#60A5FA' : '#2563EB'}
                      inactiveColor={isDark ? '#475569' : '#CBD5E1'}
                    />
                    <Text
                      style={{
                        fontSize: 13.5,
                        fontWeight: isActive ? '700' : '600',
                        color: isActive
                          ? isDark
                            ? '#93C5FD'
                            : '#1D4ED8'
                          : isDark
                            ? '#F8FAFC'
                            : '#1E293B',
                      }}
                    >
                      {t(SEVERITY_KEY[level])}
                    </Text>

                    {isActive && (
                      <View
                        style={{
                          width: 18,
                          height: 18,
                          borderRadius: 9,
                          backgroundColor: '#2563EB',
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: 6,
                        }}
                      >
                        <Check size={11} color="#FFFFFF" strokeWidth={3} />
                      </View>
                    )}
                  </Pressable>
                );
              })}
            </View>

            {/* --- Section 3: Safety Info Callout Banner --- */}
            <View
              style={{
                marginTop: 16,
                borderRadius: 16,
                paddingHorizontal: 14,
                paddingVertical: 12,
                backgroundColor: isDark ? 'rgba(30, 41, 59, 0.7)' : '#EDF2FA',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.06)' : 'rgba(203, 213, 225, 0.4)',
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Shield size={20} color={isDark ? '#60A5FA' : '#2563EB'} strokeWidth={2} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: '400',
                  lineHeight: 18,
                  color: isDark ? '#94A3B8' : '#475569',
                }}
              >
                {t('vitals.symptomSheet.infoCallout')}
              </Text>
            </View>

            {/* --- Section 4: Primary Save Button --- */}
            <Pressable
              onPress={handleSave}
              disabled={!symptom || saving}
              accessibilityRole="button"
              accessibilityLabel={t('vitals.symptomSheet.saveSymptom')}
              style={{
                marginTop: 18,
                height: 54,
                borderRadius: 27,
                backgroundColor: '#2764B8',
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !symptom || saving ? 0.5 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 16.5,
                  fontWeight: '700',
                  color: '#FFFFFF',
                }}
              >
                {t('vitals.symptomSheet.saveSymptom')}
              </Text>
              <View style={{ position: 'absolute', right: 20 }}>
                <ArrowRight size={20} color="#FFFFFF" strokeWidth={2.4} />
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingTop: 10, gap: 14 }}>
            <View
              style={{
                padding: 16,
                borderRadius: 16,
                backgroundColor: isDark ? 'rgba(37, 99, 235, 0.16)' : '#EFF6FF',
                borderWidth: 1,
                borderColor: isDark ? 'rgba(37, 99, 235, 0.3)' : '#BFDBFE',
              }}
            >
              <Text
                style={{
                  fontSize: 15.5,
                  fontWeight: '700',
                  color: isDark ? '#93C5FD' : '#1D4ED8',
                }}
              >
                {relatedMeds.length === 0
                  ? t('vitals.symptomSheet.loggedNoMeds')
                  : t('vitals.symptomSheet.loggedWithMeds')}
              </Text>
            </View>

            {relatedMeds.map((med, index) => (
              <View
                key={`${med.medicationName}-${index}`}
                style={{
                  borderRadius: 16,
                  borderWidth: 1,
                  padding: 14,
                  backgroundColor: isDark ? theme.colors.elevated : '#FFFFFF',
                  borderColor: isDark ? 'rgba(255, 255, 255, 0.08)' : '#E2E8F0',
                }}
              >
                <Text style={{ fontSize: 15, fontWeight: '600', color: isDark ? '#FFFFFF' : '#0F172A' }}>
                  {med.medicationName}
                </Text>
                <Text style={{ fontSize: 13, color: isDark ? '#94A3B8' : '#64748B', marginTop: 2 }}>
                  {t('vitals.symptomSheet.takenAt', { time: new Date(med.takenTime).toLocaleTimeString() })}
                </Text>
              </View>
            ))}

            <Pressable
              onPress={() => modalRef.current?.dismiss()}
              accessibilityRole="button"
              accessibilityLabel={t('common.done')}
              style={{
                marginTop: 10,
                height: 52,
                borderRadius: 26,
                backgroundColor: isDark ? theme.colors.elevated : '#F1F5F9',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '600', color: isDark ? '#FFFFFF' : '#1E293B' }}>
                {t('common.done')}
              </Text>
            </Pressable>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
