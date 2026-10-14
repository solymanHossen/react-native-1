import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetScrollView,
} from '@gorhom/bottom-sheet';
import { ArrowRight, Check, ChevronRight, Clock, Pill, Shield, X } from 'lucide-react-native';
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
}

const SYMPTOM_CONFIGS: Record<(typeof COMMON_SYMPTOMS)[number], SymptomConfig> = {
  Nausea: {
    key: 'vitals.symptomSheet.symptoms.Nausea',
    image: SYMPTOM_IMAGES.Nausea,
  },
  Dizziness: {
    key: 'vitals.symptomSheet.symptoms.Dizziness',
    image: SYMPTOM_IMAGES.Dizziness,
  },
  'Acid Reflux': {
    key: 'vitals.symptomSheet.symptoms.Acid Reflux',
    image: SYMPTOM_IMAGES['Acid Reflux'],
  },
  Headache: {
    key: 'vitals.symptomSheet.symptoms.Headache',
    image: SYMPTOM_IMAGES.Headache,
  },
  Fatigue: {
    key: 'vitals.symptomSheet.symptoms.Fatigue',
    image: SYMPTOM_IMAGES.Fatigue,
  },
  Rash: {
    key: 'vitals.symptomSheet.symptoms.Rash',
    image: SYMPTOM_IMAGES.Rash,
  },
};

// --- Severity Signal Bars ---
function SeverityBars({
  level,
  isSelected,
  activeColor = '#395886',
  inactiveColor = '#A4B8D8',
  severeColor = '#CD0000',
}: {
  level: SymptomSeverity;
  isSelected: boolean;
  activeColor?: string;
  inactiveColor?: string;
  severeColor?: string;
}) {
  const getBarColors = () => {
    if (level === 'SEVERE') return [severeColor, severeColor, severeColor];
    if (isSelected) {
      if (level === 'MILD') return [activeColor, inactiveColor, inactiveColor];
      if (level === 'MODERATE') return [activeColor, activeColor, inactiveColor];
      return [severeColor, severeColor, severeColor];
    }
    if (level === 'MILD') return [activeColor, inactiveColor, inactiveColor];
    if (level === 'MODERATE') return [activeColor, activeColor, inactiveColor];
    return [severeColor, severeColor, severeColor];
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

const MED_COLOR_PALETTES = [
  { bg: '#DBEAFE', icon: '#2563EB', darkBg: 'rgba(37, 99, 235, 0.18)', darkIcon: '#60A5FA' }, // Blue
  { bg: '#DCFCE7', icon: '#16A34A', darkBg: 'rgba(22, 163, 74, 0.18)', darkIcon: '#4ADE80' }, // Green
  { bg: '#EDE9FE', icon: '#7C3AED', darkBg: 'rgba(124, 58, 237, 0.18)', darkIcon: '#A78BFA' }, // Purple
  { bg: '#FFEDD5', icon: '#EA580C', darkBg: 'rgba(234, 88, 12, 0.18)', darkIcon: '#FB923C' }, // Amber
  { bg: '#FEE2E2', icon: '#DC2626', darkBg: 'rgba(220, 38, 38, 0.18)', darkIcon: '#F87171' }, // Red
  { bg: '#E0E7FF', icon: '#4F46E5', darkBg: 'rgba(79, 70, 229, 0.18)', darkIcon: '#818CF8' }, // Indigo
];

function getMedicationColors(name: string, isDark: boolean) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  const palette = MED_COLOR_PALETTES[hash % MED_COLOR_PALETTES.length];
  return {
    bg: isDark ? palette.darkBg : palette.bg,
    icon: isDark ? palette.darkIcon : palette.icon,
  };
}

interface MedGroup {
  dateKey: string;
  title: string;
  entries: RecentIntakeContext[];
}

export interface SymptomLogSheetRef {
  present: () => void;
}

export const SymptomLogSheet = forwardRef<SymptomLogSheetRef, Record<string, unknown>>(function SymptomLogSheetImpl(_props, ref) {
  const theme = useTheme();
  const st = theme.symptoms;
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

  const medGroups = useMemo<MedGroup[]>(() => {
    if (!relatedMeds || relatedMeds.length === 0) return [];

    const now = new Date();
    const todayStr = now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();

    const map = new Map<string, MedGroup>();

    for (const item of relatedMeds) {
      const d = new Date(item.takenTime);
      const dateKey = d.toDateString();

      let title: string;
      if (dateKey === todayStr) {
        title = t('vitals.symptomSheet.today');
      } else if (dateKey === yesterdayStr) {
        title = t('vitals.symptomSheet.yesterday');
      } else {
        title = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      }

      if (!map.has(dateKey)) {
        map.set(dateKey, { dateKey, title, entries: [] });
      }
      map.get(dateKey)!.entries.push(item);
    }

    return Array.from(map.values());
  }, [relatedMeds, t]);

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
      handleIndicatorStyle={{ backgroundColor: isDark ? 'rgba(255, 255, 255, 0.2)' : theme.colors.hairline, width: 38, height: 4 }}
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
              backgroundColor: st.headerBadgeBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Svg width={26} height={26} viewBox="0 0 24 24">
              <Path
                d="M5 4a2 2 0 0 1 2-2h8l5 5v13a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V4Z"
                fill={st.headerIconPrimary}
              />
              <Path d="M15 2v4a1 1 0 0 0 1 1h4" fill={st.headerIconSecondary} />
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
                color: st.headerTitle,
              }}
            >
              {t('vitals.symptomSheet.title')}
            </Text>
            <Text
              style={{
                fontSize: 13,
                fontWeight: '400',
                lineHeight: 18,
                color: st.headerSubtitle,
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
              backgroundColor: st.closeBtnBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={16} color={st.closeBtnIcon} strokeWidth={2.2} />
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
                color: st.sectionHeader,
                marginTop: 6,
                marginBottom: 10,
              }}
            >
              {t('vitals.symptomSheet.commonSymptoms')}
            </Text>

            {/* 2-Column Symptom Grid (3 rows) - Exact same-to-same design as Vitals cards */}
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
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderRadius: 18,
                          paddingVertical: 10,
                          paddingHorizontal: 12,
                          gap: 10,
                          backgroundColor: isActive ? st.cardActiveBg : st.cardBg,
                          borderWidth: 1,
                          borderColor: isActive ? st.cardActiveBorder : st.cardBorder,
                        }}
                      >
                        {/* Squircle Icon Badge */}
                        <View
                          style={{
                            width: 38,
                            height: 38,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: isActive
                              ? 'rgba(255, 255, 255, 0.22)'
                              : st.badgeBg[option],
                          }}
                        >
                          <Image
                            source={config.image}
                            style={{
                              width: 24,
                              height: 24,
                              tintColor: isActive ? '#FFFFFF' : undefined,
                            }}
                            resizeMode="contain"
                          />
                        </View>

                        {/* Title, Subtitle & Indicator */}
                        <View style={{ flex: 1, justifyContent: 'center', gap: 2 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                            <Text
                              style={{
                                flex: 1,
                                marginRight: 4,
                                fontSize: 13.5,
                                fontWeight: '700',
                                color: isActive ? st.cardActiveText : st.cardText,
                              }}
                              numberOfLines={1}
                            >
                              {t(config.key)}
                            </Text>

                            {isActive ? (
                              <View
                                style={{
                                  width: 18,
                                  height: 18,
                                  borderRadius: 9,
                                  backgroundColor: st.cardActiveCheckBg,
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                }}
                              >
                                <Check size={11} color={st.cardActiveCheckIcon} strokeWidth={3} />
                              </View>
                            ) : (
                              <ChevronRight size={15} color={st.closeBtnIcon} strokeWidth={2.4} />
                            )}
                          </View>

                          <Text
                            style={{
                              fontSize: 11,
                              fontWeight: '400',
                              color: isActive ? 'rgba(255, 255, 255, 0.78)' : st.headerSubtitle,
                            }}
                            numberOfLines={1}
                          >
                            {t('vitals.tapToLog')}
                          </Text>
                        </View>
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
                color: st.sectionHeader,
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
                      backgroundColor: isActive ? st.severityActiveBg : st.severityInactiveBg,
                      borderWidth: isActive ? 1.5 : 1,
                      borderColor: isActive ? st.severityActiveBorder : st.severityInactiveBorder,
                    }}
                  >
                    <SeverityBars
                      level={level}
                      isSelected={isActive}
                      activeColor={st.severityBarActive}
                      inactiveColor={st.severityBarInactive}
                      severeColor={st.severityBarSevere}
                    />
                    <Text
                      style={{
                        fontSize: 13.5,
                        fontWeight: isActive ? '700' : '600',
                        color: isActive ? st.severityActiveText : st.severityInactiveText,
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
                          backgroundColor: st.severityActiveCheckBg,
                          alignItems: 'center',
                          justifyContent: 'center',
                          marginLeft: 6,
                        }}
                      >
                        <Check size={11} color={st.severityActiveCheckIcon} strokeWidth={3} />
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
                backgroundColor: st.calloutBg,
                borderWidth: 1,
                borderColor: st.calloutBorder,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
              }}
            >
              <Shield size={20} color={st.calloutIcon} strokeWidth={2} />
              <Text
                style={{
                  flex: 1,
                  fontSize: 13,
                  fontWeight: '400',
                  lineHeight: 18,
                  color: st.calloutText,
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
                backgroundColor: st.saveBtnBg,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                opacity: !symptom || saving ? 0.45 : 1,
              }}
            >
              <Text
                style={{
                  fontSize: 16.5,
                  fontWeight: '700',
                  color: st.saveBtnText,
                }}
              >
                {t('vitals.symptomSheet.saveSymptom')}
              </Text>
              <View style={{ position: 'absolute', right: 20 }}>
                <ArrowRight size={20} color={st.saveBtnText} strokeWidth={2.4} />
              </View>
            </Pressable>
          </View>
        ) : (
          <View style={{ paddingHorizontal: 20, paddingTop: 4, gap: 16 }}>
            {/* Banner: Logged. Taken in the last 4 hours */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                padding: 14,
                borderRadius: 16,
                backgroundColor: st.calloutBg,
                borderWidth: 1,
                borderColor: st.calloutBorder,
                gap: 12,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: st.headerBadgeBg,
                }}
              >
                <Clock size={20} color={st.calloutIcon} strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1, gap: 2 }}>
                <Text
                  style={{
                    fontSize: 14,
                    fontWeight: '700',
                    color: st.cardText,
                  }}
                >
                  {relatedMeds.length === 0
                    ? t('vitals.symptomSheet.loggedNoMeds')
                    : t('vitals.symptomSheet.loggedWithMeds')}
                </Text>
                <Text
                  style={{
                    fontSize: 12,
                    fontWeight: '400',
                    color: st.calloutText,
                  }}
                >
                  {t('vitals.symptomSheet.showingRecentMeds')}
                </Text>
              </View>
            </View>

            {/* Date Groups with Timeline */}
            {medGroups.map((group) => (
              <View key={group.dateKey} style={{ gap: 6 }}>
                {/* Group Header: Date (Today/Yesterday) + Entries count */}
                <View
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingHorizontal: 4,
                    marginBottom: 2,
                  }}
                >
                  <Text
                    style={{
                      fontSize: 15,
                      fontWeight: '700',
                      color: st.cardText,
                    }}
                  >
                    {group.title}
                  </Text>
                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '500',
                      color: st.headerSubtitle,
                    }}
                  >
                    {group.entries.length === 1
                      ? t('vitals.symptomSheet.entryCount')
                      : t('vitals.symptomSheet.entriesCount', { count: group.entries.length })}
                  </Text>
                </View>

                {/* Timeline Items */}
                {group.entries.map((med, index) => {
                  const medColors = getMedicationColors(med.medicationName, isDark);
                  const isFirst = index === 0;
                  const isLast = index === group.entries.length - 1;
                  const formattedTime = new Date(med.takenTime).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                    second: '2-digit',
                  });

                  return (
                    <View
                      key={`${med.medicationName}-${index}`}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        paddingVertical: 4,
                      }}
                    >
                      {/* Timeline Connector Column */}
                      <View
                        style={{
                          width: 24,
                          alignSelf: 'stretch',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        {/* Top Line to previous item */}
                        <View
                          style={{
                            position: 'absolute',
                            top: 0,
                            bottom: '50%',
                            width: 2,
                            backgroundColor: !isFirst ? st.cardBorder : 'transparent',
                          }}
                        />
                        {/* Bottom Line to next item */}
                        <View
                          style={{
                            position: 'absolute',
                            top: '50%',
                            bottom: 0,
                            width: 2,
                            backgroundColor: !isLast ? st.cardBorder : 'transparent',
                          }}
                        />
                        {/* Dot */}
                        <View
                          style={{
                            width: 8,
                            height: 8,
                            borderRadius: 4,
                            backgroundColor: st.headerIconSecondary,
                          }}
                        />
                      </View>

                      {/* Medication Card */}
                      <View
                        style={{
                          flex: 1,
                          flexDirection: 'row',
                          alignItems: 'center',
                          borderRadius: 16,
                          borderWidth: 1,
                          borderColor: st.cardBorder,
                          backgroundColor: st.cardBg,
                          paddingHorizontal: 12,
                          paddingVertical: 10,
                          gap: 10,
                        }}
                      >
                        {/* Squircle Pill Icon Badge */}
                        <View
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 12,
                            alignItems: 'center',
                            justifyContent: 'center',
                            backgroundColor: medColors.bg,
                          }}
                        >
                          <Pill size={18} color={medColors.icon} strokeWidth={2.2} />
                        </View>

                        {/* Name & Time */}
                        <View style={{ flex: 1, justifyContent: 'center', gap: 2 }}>
                          <Text
                            style={{
                              fontSize: 14.5,
                              fontWeight: '700',
                              color: st.cardText,
                            }}
                            numberOfLines={1}
                          >
                            {med.medicationName}
                          </Text>
                          <Text
                            style={{
                              fontSize: 12,
                              fontWeight: '400',
                              color: st.headerSubtitle,
                            }}
                            numberOfLines={1}
                          >
                            {t('vitals.symptomSheet.takenAt', { time: formattedTime })}
                          </Text>
                        </View>

                        {/* Chevron Right */}
                        <ChevronRight size={16} color={st.closeBtnIcon} strokeWidth={2.2} />
                      </View>
                    </View>
                  );
                })}
              </View>
            ))}

            {/* Done Button */}
            <Pressable
              onPress={() => modalRef.current?.dismiss()}
              accessibilityRole="button"
              accessibilityLabel={t('common.done')}
              style={{
                marginTop: 8,
                height: 50,
                borderRadius: 25,
                backgroundColor: st.saveBtnBg,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Text style={{ fontSize: 16, fontWeight: '700', color: st.saveBtnText }}>
                {t('common.done')}
              </Text>
            </Pressable>
          </View>
        )}
      </BottomSheetScrollView>
    </BottomSheetModal>
  );
});
