import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { ArrowRight, Check, Shield, X } from 'lucide-react-native';
import React, { forwardRef, useCallback, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
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

// --- Custom Symptom Icons ---

function RashIcon({ size = 20, color = '#2563EB' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Circle cx="12" cy="4" r="1.6" />
      <Circle cx="17.6" cy="6.3" r="1.6" />
      <Circle cx="20" cy="12" r="1.6" />
      <Circle cx="17.6" cy="17.7" r="1.6" />
      <Circle cx="12" cy="20" r="1.6" />
      <Circle cx="6.4" cy="17.7" r="1.6" />
      <Circle cx="4" cy="12" r="1.6" />
      <Circle cx="6.4" cy="6.3" r="1.6" />
      <Circle cx="11.2" cy="10.8" r="1.5" />
      <Circle cx="12.8" cy="13.2" r="1.5" />
    </Svg>
  );
}

function DizzinessIcon({ size = 20, color = '#10B981' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.4} strokeLinecap="round">
      <Path d="M12 12a1.8 1.8 0 0 0-1.8 1.8c0 1.9 1.6 3.5 3.6 3.5 2.8 0 5-2.2 5-5 0-3.6-3-6.5-6.8-6.5-4.4 0-8 3.6-8 8 0 5.2 4.3 9.5 9.5 9.5" />
    </Svg>
  );
}

function FatigueIcon({ size = 20, color = '#8B5CF6' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M13 2.5L4.5 13H11.5L9.5 21.5L19.5 10.5H12.5L13 2.5Z" />
    </Svg>
  );
}

function HeadacheIcon({ size = 20, color = '#EF4444' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path
        fillRule="evenodd"
        clipRule="evenodd"
        d="M13.5 3C8.8 3 5.5 6.2 5.5 10.2c0 2.2.8 4 2.2 5.1l.3.3v2c0 .8.6 1.4 1.4 1.4h1.1v2h5v-2h.5c.8 0 1.5-.6 1.5-1.4v-1.6c1.8-1.5 3-3.7 3-6.4C20.5 5.8 17.5 3 13.5 3ZM12.8 6.5l-2.8 4h2.2l-.8 3.5 3.2-4.5h-2.2l.4-3Z"
      />
    </Svg>
  );
}

function AcidRefluxIcon({ size = 20, color = '#F97316' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M8.5 2.5c.6 0 1 .4 1 1 0 1.8 1.2 3.5 2.8 4.5 1.8 1.1 3.2 3 3.2 5.5 0 3.6-2.7 6.5-6.5 6.5S4 17.1 4 13.5c0-3.2 1.8-6.5 3.5-8.5.4-.5.8-1 1.2-1.5.3-.6.5-1 .8-1Z" />
      <Path
        d="M10 11.5c0 1.2.6 1.8 1.2 2.5.5.6.8 1.2.8 2 0 1.4-1.1 2.5-2.5 2.5s-2.5-1.1-2.5-2.5c0-1.2.8-2 1.5-2.8.3-.3.5-.7.5-1.2 0-.2.2-.4.4-.4.2 0 .4.2.4.4.1.7.4 1.2.7 1.5Z"
        fill={color === '#FFFFFF' ? '#2764B8' : '#FFFFFF'}
      />
    </Svg>
  );
}

function NauseaIcon({ size = 20, color = '#EF4444' }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill={color}>
      <Path d="M8.5 2.5c.6 0 1 .4 1 1 0 1.8 1.2 3.5 2.8 4.5 1.8 1.1 3.2 3 3.2 5.5 0 3.6-2.7 6.5-6.5 6.5S4 17.1 4 13.5c0-3.2 1.8-6.5 3.5-8.5.4-.5.8-1 1.2-1.5.3-.6.5-1 .8-1Z" />
    </Svg>
  );
}

interface SymptomConfig {
  key: TranslationKey;
  icon: (props: { size?: number; color?: string }) => React.JSX.Element;
  iconColor: string;
  badgeBgLight: string;
  badgeBgDark: string;
}

const SYMPTOM_CONFIGS: Record<(typeof COMMON_SYMPTOMS)[number], SymptomConfig> = {
  Nausea: {
    key: 'vitals.symptomSheet.symptoms.Nausea',
    icon: NauseaIcon,
    iconColor: '#EF4444',
    badgeBgLight: '#FEE2E2',
    badgeBgDark: 'rgba(239, 68, 68, 0.16)',
  },
  Dizziness: {
    key: 'vitals.symptomSheet.symptoms.Dizziness',
    icon: DizzinessIcon,
    iconColor: '#10B981',
    badgeBgLight: '#DCFCE7',
    badgeBgDark: 'rgba(16, 185, 129, 0.16)',
  },
  'Acid Reflux': {
    key: 'vitals.symptomSheet.symptoms.Acid Reflux',
    icon: AcidRefluxIcon,
    iconColor: '#F97316',
    badgeBgLight: '#FFEDD5',
    badgeBgDark: 'rgba(249, 115, 22, 0.16)',
  },
  Headache: {
    key: 'vitals.symptomSheet.symptoms.Headache',
    icon: HeadacheIcon,
    iconColor: '#EF4444',
    badgeBgLight: '#FEE2E2',
    badgeBgDark: 'rgba(239, 68, 68, 0.16)',
  },
  Fatigue: {
    key: 'vitals.symptomSheet.symptoms.Fatigue',
    icon: FatigueIcon,
    iconColor: '#8B5CF6',
    badgeBgLight: '#EDE9FE',
    badgeBgDark: 'rgba(139, 92, 246, 0.16)',
  },
  Rash: {
    key: 'vitals.symptomSheet.symptoms.Rash',
    icon: RashIcon,
    iconColor: '#2563EB',
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
                    const IconComponent = config.icon;

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
                          <IconComponent
                            size={20}
                            color={isActive ? '#FFFFFF' : isDark ? config.iconColor : config.iconColor}
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
