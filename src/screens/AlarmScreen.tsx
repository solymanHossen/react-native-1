import notifee from '@notifee/react-native';
import {
  AlertTriangle,
  ArrowLeft,
  BellRing,
  Camera as CameraIcon,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock,
  FileText,
  Utensils,
  X,
} from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import {
  buildMedicationReminderMessage,
  canSnooze,
  confirmIntake,
  escalateToCaregiver,
  formatCountdown,
  isNfcAvailable,
  isPastEscalationDeadline,
  isVoiceAnnouncementsEnabled,
  listenForTag,
  logManualOverride,
  msUntilEscalation,
  remainingSnoozes,
  scanPackForMedication,
  scheduleSnoozeAlarm,
  useActiveAlarmStore,
  VISION_CONFIDENCE_THRESHOLD,
  type ActiveAlarm,
} from '../alarms';
import { useTranslation } from '../i18n';
import { status } from '../theme/tokens';
import { triggerHapticCascade, triggerHaptic } from '../lib/haptics';
import { speakReminder, stopSpeaking } from '../lib/tts';

const VISION_CAPTURE_INTERVAL_MS = 2500;
const VOICE_REPEAT_INTERVAL_MS = 30 * 1000;

type VerificationMode = 'nfc' | 'vision';
type Resolution = 'pending' | 'verified' | 'overridden' | 'escalated';

export interface AlarmScreenProps {
  alarm: ActiveAlarm;
  onBack?: () => void;
  onNavigate?: (tab: 'home' | 'drugLab' | 'scanRx' | 'rhythm' | 'alarms' | 'vitals') => void;
}

/**
 * 4-arc NFC contactless radio wave symbol matching standard RFID / medical dispenser tags.
 */
function NfcContactlessWave({ size = 36 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 40 40" fill="none">
      <Path
        d="M13 25C14.8 23.6 15.8 21.9 15.8 20C15.8 18.1 14.8 16.4 13 15"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Path
        d="M18.5 28.5C21.2 26.3 22.8 23.3 22.8 20C22.8 16.7 21.2 13.7 18.5 11.5"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Path
        d="M24 32C27.5 28.9 29.8 24.7 29.8 20C29.8 15.3 27.5 11.1 24 8"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
      />
      <Path
        d="M29.5 35.5C33.8 31.5 36.8 26.1 36.8 20C36.8 13.9 33.8 8.5 29.5 4.5"
        stroke="#FFFFFF"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </Svg>
  );
}

export default function AlarmScreen({ alarm, onBack, onNavigate: _onNavigate }: AlarmScreenProps) {
  const { t, language } = useTranslation();
  const { payload, firedAtMs, snoozeCount } = alarm;
  const clearActiveAlarm = useActiveAlarmStore((state) => state.clearActiveAlarm);
  const incrementSnooze = useActiveAlarmStore((state) => state.incrementSnooze);

  const [mode, setMode] = useState<VerificationMode>('nfc');
  const [nfcReady, setNfcReady] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Resolution>('pending');
  const [remainingMs, setRemainingMs] = useState(() => msUntilEscalation(firedAtMs, Date.now()));
  const [helpVisible, setHelpVisible] = useState(false);
  const resolvedRef = useRef(false);
  const voiceRepeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Smooth breathing animation for NFC radar rings
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(
      withSequence(
        withTiming(1.08, { duration: 900 }),
        withTiming(1, { duration: 900 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(pulse);
  }, [pulse]);

  const pulseOuterStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.value }],
  }));

  const pulseMiddleStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + (pulse.value - 1) * 0.55 }],
  }));

  const stopVoiceAnnouncements = useCallback(() => {
    if (voiceRepeatTimer.current) {
      clearInterval(voiceRepeatTimer.current);
      voiceRepeatTimer.current = null;
    }
    stopSpeaking().catch(() => {});
  }, []);

  useEffect(() => {
    if (!isVoiceAnnouncementsEnabled()) return;
    const message = buildMedicationReminderMessage(payload, language);
    speakReminder(message, language).catch(() => {});
    voiceRepeatTimer.current = setInterval(() => {
      speakReminder(message, language).catch(() => {});
    }, VOICE_REPEAT_INTERVAL_MS);
    return () => {
      if (voiceRepeatTimer.current) clearInterval(voiceRepeatTimer.current);
      stopSpeaking().catch(() => {});
    };
  }, [alarm.notificationId, payload, language]);

  const resolveAndClose = useCallback(
    async (next: Resolution, action: () => Promise<void>) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      stopVoiceAnnouncements();
      try {
        await action();
      } catch (error) {
        console.warn('[AlarmScreen] resolution action failed, keeping alarm active', error);
        resolvedRef.current = false;
        setStatusMessage(t('alarmRinging.actionFailed'));
        return;
      }
      setResolution(next);
      await notifee.cancelNotification(alarm.notificationId).catch(() => {});
      setTimeout(() => clearActiveAlarm(), next === 'verified' ? 1200 : 0);
    },
    [alarm.notificationId, clearActiveAlarm, stopVoiceAnnouncements, t],
  );

  // NFC Listener
  useEffect(() => {
    if (mode !== 'nfc') return;
    let active = true;

    isNfcAvailable().then((available) => {
      if (active) setNfcReady(available);
    });

    const stopListening = listenForTag((uid) => {
      if (!active) return;
      if (payload.nfcTagUid && uid === payload.nfcTagUid) {
        triggerHapticCascade();
        resolveAndClose('verified', () => confirmIntake(payload, 'NFC'));
      } else {
        setStatusMessage(t('alarmRinging.nfcMismatch'));
        triggerHaptic('notificationError');
      }
    });

    return () => {
      active = false;
      stopListening();
    };
  }, [mode, payload, resolveAndClose, t]);

  // Vision Fallback Camera
  const cameraRef = useRef<Camera>(null);
  const { hasPermission, requestPermission } = useCameraPermission();
  const device = useCameraDevice('back');
  const [scanning, setScanning] = useState(false);
  const scanningRef = useRef(false);
  const [lastConfidence, setLastConfidence] = useState<number | null>(null);

  useEffect(() => {
    if (mode !== 'vision') return;
    if (!hasPermission) {
      requestPermission();
      return;
    }
    const interval = setInterval(async () => {
      if (!cameraRef.current || scanningRef.current || resolvedRef.current) return;
      scanningRef.current = true;
      setScanning(true);
      try {
        const photo = await cameraRef.current.takePhoto({ flash: 'off', enableShutterSound: false });
        const result = await scanPackForMedication(photo.path, payload.medicationName);
        setLastConfidence(result.confidence);
        if (result.verified) {
          triggerHapticCascade();
          resolveAndClose('verified', () => confirmIntake(payload, 'VISION'));
        }
      } catch (captureError) {
        console.warn('[AlarmScreen] vision capture failed', captureError);
      } finally {
        scanningRef.current = false;
        setScanning(false);
      }
    }, VISION_CAPTURE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [mode, hasPermission, requestPermission, payload, resolveAndClose]);

  // Escalation Countdown
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      setRemainingMs(msUntilEscalation(firedAtMs, now));
      if (isPastEscalationDeadline(firedAtMs, now)) {
        resolveAndClose('escalated', () => escalateToCaregiver(payload));
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [firedAtMs, payload, resolveAndClose]);

  const handleSnooze = useCallback(async () => {
    if (!canSnooze(snoozeCount) || resolvedRef.current) return;
    resolvedRef.current = true;
    stopVoiceAnnouncements();
    triggerHaptic('impactMedium');
    try {
      await scheduleSnoozeAlarm(alarm.notificationId, payload);
    } catch (error) {
      console.warn('[AlarmScreen] snooze failed, keeping alarm active', error);
      resolvedRef.current = false;
      setStatusMessage(t('alarmRinging.actionFailed'));
      return;
    }
    incrementSnooze();
    await notifee.cancelNotification(alarm.notificationId).catch(() => {});
    clearActiveAlarm();
  }, [alarm.notificationId, clearActiveAlarm, incrementSnooze, payload, snoozeCount, stopVoiceAnnouncements, t]);

  const handleMarkAsTaken = useCallback(() => {
    triggerHapticCascade();
    resolveAndClose('verified', () => confirmIntake(payload, 'MANUAL_OVERRIDE'));
  }, [payload, resolveAndClose]);

  const handleSilenceAlarm = useCallback(() => {
    triggerHaptic('selection');
    resolveAndClose('overridden', () => logManualOverride(payload));
  }, [payload, resolveAndClose]);

  const handleBack = useCallback(() => {
    triggerHaptic('selection');
    stopVoiceAnnouncements();
    if (onBack) {
      onBack();
    } else {
      clearActiveAlarm();
    }
  }, [clearActiveAlarm, onBack, stopVoiceAnnouncements]);

  const mealText =
    payload.mealRelation === 'BEFORE'
      ? t('alarms.mealBefore')
      : payload.mealRelation === 'AFTER'
      ? t('alarms.mealAfter')
      : t('alarms.mealWith');

  const reminderNote =
    payload.title ??
    (payload.medicationName === 'Naprosyn'
      ? 'Take 1 tablet with food. Scan the bottle for more details.'
      : t('alarmRinging.reminderNoteDesc'));

  if (resolution === 'verified') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-6" style={{ backgroundColor: '#EEF5FC' }}>
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 140,
            height: 140,
            backgroundColor: '#DCFCE7',
            shadowColor: '#10B981',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 18,
            elevation: 8,
          }}
        >
          <CheckCircle2 color="#059669" size={84} strokeWidth={2.2} />
        </View>
        <Text className="text-2xl font-bold tracking-tight" style={{ color: '#0F172A' }}>
          {t('alarmRinging.confirmed', { name: payload.medicationName })}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'left', 'right']} className="flex-1" style={{ backgroundColor: '#EEF5FC' }}>
      {/* Top Header Bar */}
      <View className="flex-row items-center justify-between px-5 pt-2 pb-3">
        <Pressable
          onPress={handleBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Back"
          className="items-center justify-center rounded-full"
          style={{ width: 40, height: 40 }}
        >
          <ArrowLeft color="#1E293B" size={24} strokeWidth={2.4} />
        </Pressable>

        <View className="flex-1 items-center px-2">
          <Text className="text-[19px] font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
            {t('alarmRinging.title')}
          </Text>
          <Text className="text-[13px] font-medium" style={{ color: '#64748B' }}>
            {t('alarmRinging.timeToTake')}
          </Text>
        </View>

        <Pressable
          onPress={() => {
            triggerHaptic('selection');
            setHelpVisible(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t('alarmRinging.help')}
          className="flex-row items-center gap-1.5 rounded-full px-3.5 py-1.5"
          style={{ backgroundColor: '#DBEAFE' }}
        >
          <CircleHelp color="#2563EB" size={16} strokeWidth={2.2} />
          <Text className="text-[13.5px] font-bold" style={{ color: '#2563EB' }}>
            {t('alarmRinging.help')}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 4, paddingBottom: 28 }}
      >
        {/* Main Floating Card */}
        <View
          className="rounded-[32px] p-5 border"
          style={{
            backgroundColor: '#FFFFFF',
            borderColor: '#E2EDF8',
            shadowColor: '#2563EB',
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.08,
            shadowRadius: 18,
            elevation: 4,
          }}
        >
          {/* Header Row: Pill Avatar & Medicine Details */}
          <View className="flex-row items-center gap-4">
            <View
              className="items-center justify-center rounded-full"
              style={{
                width: 64,
                height: 64,
                backgroundColor: '#E6F0FC',
                borderWidth: 1,
                borderColor: '#DBEAFE',
              }}
            >
              <Image
                source={require('../../assets/branding/tablet.png')}
                style={{ width: 48, height: 48 }}
                resizeMode="contain"
              />
            </View>

            <View className="flex-1">
              <Text className="text-[23px] font-extrabold tracking-tight" style={{ color: '#0F172A' }}>
                {payload.medicationName}
              </Text>
              <Text className="text-[14.5px] font-medium" style={{ color: '#64748B' }}>
                {payload.dosageLabel}
              </Text>

              {/* Badges / Chips Row */}
              <View className="flex-row items-center gap-2 mt-2">
                <View
                  className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1 border"
                  style={{ backgroundColor: '#F1F5F9', borderColor: '#E2E8F0' }}
                >
                  <Utensils color="#475569" size={12} strokeWidth={2.2} />
                  <Text className="text-[12px] font-semibold" style={{ color: '#475569' }}>
                    {mealText}
                  </Text>
                </View>

                <View
                  className="flex-row items-center gap-1.5 rounded-full px-2.5 py-1 border"
                  style={{ backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }}
                >
                  <Clock color="#2563EB" size={12} strokeWidth={2.2} />
                  <Text className="text-[12px] font-bold" style={{ color: '#2563EB' }}>
                    {t('alarmRinging.dueNow')}
                  </Text>
                </View>
              </View>
            </View>
          </View>

          {/* Reminder Note Callout */}
          <View
            className="flex-row items-center gap-3 rounded-2xl p-3.5 mt-5 border"
            style={{ backgroundColor: '#F0F6FE', borderColor: '#DBEAFE' }}
          >
            <View
              className="items-center justify-center rounded-xl"
              style={{ width: 36, height: 36, backgroundColor: '#DBEAFE' }}
            >
              <FileText color="#2563EB" size={18} strokeWidth={2.2} />
            </View>

            <View className="flex-1">
              <Text className="text-[13px] font-bold" style={{ color: '#1E3A8A' }}>
                {t('alarmRinging.reminderNote')}
              </Text>
              <Text className="text-[12.5px] font-medium mt-0.5 leading-4" style={{ color: '#475569' }}>
                {reminderNote}
              </Text>
            </View>

            <ChevronRight color="#94A3B8" size={18} strokeWidth={2.4} />
          </View>

          {/* NFC Radar / Camera Scanner Area */}
          <View className="items-center justify-center pt-6 pb-2">
            {mode === 'nfc' ? (
              <View className="items-center">
                {/* Concentric Radar Graphic */}
                <View className="items-center justify-center" style={{ width: 160, height: 160 }}>
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: 'absolute',
                        width: 156,
                        height: 156,
                        borderRadius: 78,
                        backgroundColor: 'rgba(239, 246, 255, 0.65)',
                        borderWidth: 1.5,
                        borderColor: 'rgba(59, 130, 246, 0.16)',
                      },
                      pulseOuterStyle,
                    ]}
                  />
                  <Animated.View
                    pointerEvents="none"
                    style={[
                      {
                        position: 'absolute',
                        width: 118,
                        height: 118,
                        borderRadius: 59,
                        backgroundColor: 'rgba(219, 234, 254, 0.75)',
                        borderWidth: 1.5,
                        borderColor: 'rgba(59, 130, 246, 0.32)',
                      },
                      pulseMiddleStyle,
                    ]}
                  />
                  <View
                    className="items-center justify-center rounded-full"
                    style={{
                      width: 80,
                      height: 80,
                      backgroundColor: '#2563EB',
                      shadowColor: '#2563EB',
                      shadowOffset: { width: 0, height: 6 },
                      shadowOpacity: 0.38,
                      shadowRadius: 12,
                      elevation: 6,
                    }}
                  >
                    <NfcContactlessWave size={36} />
                  </View>
                </View>

                {/* Subtitle / Prompt */}
                <Text className="text-[17.5px] font-bold tracking-tight text-center mt-3" style={{ color: '#0F172A' }}>
                  {t('alarmRinging.tapPhoneToBottle')}
                </Text>
                <Text className="text-[13px] font-medium text-center mt-1" style={{ color: '#64748B' }}>
                  {nfcReady ? t('alarmRinging.nfcPrompt') : t('alarmRinging.nfcUnavailable')}
                </Text>
              </View>
            ) : (
              <View className="w-full items-center gap-3">
                <View
                  className="w-full overflow-hidden rounded-2xl items-center justify-center"
                  style={{
                    height: 220,
                    backgroundColor: '#0F172A',
                    borderWidth: 1,
                    borderColor: '#CBD5E1',
                  }}
                >
                  {device && hasPermission ? (
                    <Camera ref={cameraRef} style={{ width: '100%', height: '100%' }} device={device} isActive photo />
                  ) : (
                    <View className="items-center justify-center gap-2">
                      <CameraIcon color="#94A3B8" size={44} />
                      <Text className="text-[13px] font-medium" style={{ color: '#94A3B8' }}>
                        {t('alarmRinging.visionPrompt')}
                      </Text>
                    </View>
                  )}
                </View>
                {scanning ? <ActivityIndicator color="#2563EB" /> : null}
                {lastConfidence !== null ? (
                  <Text className="text-[12px] font-semibold" style={{ color: '#64748B' }}>
                    {t('alarmRinging.lastReadMatch', { confidence: lastConfidence, threshold: VISION_CONFIDENCE_THRESHOLD })}
                  </Text>
                ) : null}
              </View>
            )}
          </View>

          {/* Error Message if Mismatch */}
          {statusMessage ? (
            <View
              className="flex-row items-center gap-2 rounded-xl px-4 py-2.5 mt-3"
              style={{ backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: '#FEE2E2' }}
            >
              <AlertTriangle color="#DC2626" size={17} />
              <Text className="flex-1 text-[12.5px] font-medium" style={{ color: '#DC2626' }}>
                {statusMessage}
              </Text>
            </View>
          ) : null}

          {/* Camera Alternate Button */}
          <Pressable
            onPress={() => {
              triggerHaptic('selection');
              setMode(mode === 'nfc' ? 'vision' : 'nfc');
            }}
            accessibilityRole="button"
            className="flex-row items-center justify-between rounded-2xl px-4 py-3 mt-4 border active:opacity-85"
            style={{ backgroundColor: '#EFF6FF', borderColor: '#DBEAFE' }}
          >
            <View className="flex-row items-center gap-2.5">
              <CameraIcon color="#2563EB" size={18} strokeWidth={2.2} />
              <Text className="text-[13.5px] font-bold" style={{ color: '#1D4ED8' }}>
                {mode === 'nfc' ? t('alarmRinging.useCameraInstead') : t('alarmRinging.useNfcInstead')}
              </Text>
            </View>
            <ChevronRight color="#2563EB" size={17} strokeWidth={2.4} />
          </Pressable>

          {/* Action Buttons */}
          <Pressable
            onPress={handleMarkAsTaken}
            accessibilityRole="button"
            accessibilityLabel={t('alarmRinging.markAsTaken')}
            className="flex-row items-center justify-center gap-2.5 rounded-full py-4 mt-4 shadow-md active:opacity-90"
            style={{
              backgroundColor: '#2563EB',
              shadowColor: '#2563EB',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.28,
              shadowRadius: 10,
              elevation: 4,
            }}
          >
            <CheckCircle2 color="#FFFFFF" size={20} strokeWidth={2.5} />
            <Text className="text-[16px] font-bold" style={{ color: '#FFFFFF' }}>
              {t('alarmRinging.markAsTaken')}
            </Text>
          </Pressable>

          <Pressable
            onPress={handleSnooze}
            disabled={!canSnooze(snoozeCount)}
            accessibilityRole="button"
            accessibilityLabel={t('alarmRinging.snoozeMinutes', { count: remainingSnoozes(snoozeCount) })}
            className="flex-row items-center justify-center gap-2.5 rounded-full py-4 mt-3 border-2 active:bg-blue-50/50"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#BFDBFE',
              opacity: canSnooze(snoozeCount) ? 1 : 0.6,
            }}
          >
            <Clock color="#2563EB" size={18} strokeWidth={2.2} />
            <Text className="text-[15.5px] font-bold" style={{ color: '#2563EB' }}>
              {canSnooze(snoozeCount)
                ? t('alarmRinging.snoozeMinutes', { count: remainingSnoozes(snoozeCount) })
                : t('alarmRinging.noSnoozesLeft')}
            </Text>
          </Pressable>

          {/* Silence This Alarm Card */}
          <View
            className="flex-row items-center gap-3 rounded-2xl p-3.5 mt-4 border"
            style={{
              backgroundColor: '#FFFFFF',
              borderColor: '#FEE2E2',
              shadowColor: '#EF4444',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.04,
              shadowRadius: 6,
              elevation: 1,
            }}
          >
            <View
              className="items-center justify-center rounded-full"
              style={{ width: 42, height: 42, backgroundColor: '#FEE2E2' }}
            >
              <BellRing color="#DC2626" size={20} strokeWidth={2.2} />
            </View>

            <View className="flex-1">
              <Text className="text-[13.5px] font-bold" style={{ color: '#DC2626' }}>
                {t('alarmRinging.silenceTitle')}
              </Text>
              <Text className="text-[11.5px] font-medium leading-4 mt-0.5" style={{ color: '#64748B' }}>
                {t('alarmRinging.silenceSubtitle')}
              </Text>
            </View>

            <Pressable
              onPress={handleSilenceAlarm}
              accessibilityRole="button"
              accessibilityLabel={t('alarmRinging.turnOff')}
              className="rounded-full px-4 py-2 active:opacity-80"
              style={{ backgroundColor: '#FEE2E2' }}
            >
              <Text className="text-[13px] font-bold" style={{ color: '#DC2626' }}>
                {t('alarmRinging.turnOff')}
              </Text>
            </Pressable>
          </View>
        </View>

        {/* Auto-escalation Countdown Pill */}
        <View className="items-center mt-3">
          <View
            className="flex-row items-center gap-1.5 rounded-full px-3.5 py-1.5 border"
            style={{ backgroundColor: '#F0F5FA', borderColor: '#D5DEEF' }}
          >
            <Clock color="#64748B" size={13} strokeWidth={2} />
            <Text className="text-[12px] font-medium" style={{ color: '#64748B' }}>
              {t('alarmRinging.autoEscalates', { time: formatCountdown(remainingMs) })}
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Help Modal */}
      <Modal visible={helpVisible} transparent animationType="fade" onRequestClose={() => setHelpVisible(false)}>
        <View className="flex-1 items-center justify-center px-6" style={{ backgroundColor: 'rgba(15, 23, 42, 0.45)' }}>
          <View
            className="w-full rounded-[28px] p-6 border shadow-2xl"
            style={{ backgroundColor: '#FFFFFF', borderColor: '#E2EDF8' }}
          >
            <View className="flex-row items-center justify-between pb-3 border-b" style={{ borderColor: '#F1F5F9' }}>
              <View className="flex-row items-center gap-2.5">
                <View
                  className="items-center justify-center rounded-xl"
                  style={{ width: 36, height: 36, backgroundColor: '#DBEAFE' }}
                >
                  <CircleHelp color="#2563EB" size={20} strokeWidth={2.2} />
                </View>
                <Text className="text-[17px] font-bold" style={{ color: '#0F172A' }}>
                  {t('alarmRinging.helpTitle')}
                </Text>
              </View>
              <Pressable
                onPress={() => setHelpVisible(false)}
                hitSlop={8}
                className="items-center justify-center rounded-full"
                style={{ width: 32, height: 32, backgroundColor: '#F1F5F9' }}
              >
                <X color="#64748B" size={18} strokeWidth={2.4} />
              </Pressable>
            </View>

            <Text className="text-[13px] font-medium mt-3" style={{ color: '#64748B' }}>
              {t('alarmRinging.helpDesc')}
            </Text>

            <View className="gap-3.5 mt-4">
              <View className="flex-row items-start gap-3">
                <View
                  className="items-center justify-center rounded-full mt-0.5"
                  style={{ width: 22, height: 22, backgroundColor: '#DBEAFE' }}
                >
                  <Text className="text-[11px] font-bold" style={{ color: '#2563EB' }}>1</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[13.5px] font-bold" style={{ color: '#0F172A' }}>
                    {t('alarmRinging.helpStep1Title')}
                  </Text>
                  <Text className="text-[12px] font-medium text-slate-500 mt-0.5">
                    {t('alarmRinging.helpStep1Desc')}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View
                  className="items-center justify-center rounded-full mt-0.5"
                  style={{ width: 22, height: 22, backgroundColor: '#DBEAFE' }}
                >
                  <Text className="text-[11px] font-bold" style={{ color: '#2563EB' }}>2</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[13.5px] font-bold" style={{ color: '#0F172A' }}>
                    {t('alarmRinging.helpStep2Title')}
                  </Text>
                  <Text className="text-[12px] font-medium text-slate-500 mt-0.5">
                    {t('alarmRinging.helpStep2Desc')}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View
                  className="items-center justify-center rounded-full mt-0.5"
                  style={{ width: 22, height: 22, backgroundColor: '#DBEAFE' }}
                >
                  <Text className="text-[11px] font-bold" style={{ color: '#2563EB' }}>3</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[13.5px] font-bold" style={{ color: '#0F172A' }}>
                    {t('alarmRinging.helpStep3Title')}
                  </Text>
                  <Text className="text-[12px] font-medium text-slate-500 mt-0.5">
                    {t('alarmRinging.helpStep3Desc')}
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View
                  className="items-center justify-center rounded-full mt-0.5"
                  style={{ width: 22, height: 22, backgroundColor: '#FEE2E2' }}
                >
                  <Text className="text-[11px] font-bold" style={{ color: '#DC2626' }}>4</Text>
                </View>
                <View className="flex-1">
                  <Text className="text-[13.5px] font-bold" style={{ color: '#0F172A' }}>
                    {t('alarmRinging.helpStep4Title')}
                  </Text>
                  <Text className="text-[12px] font-medium text-slate-500 mt-0.5">
                    {t('alarmRinging.helpStep4Desc')}
                  </Text>
                </View>
              </View>
            </View>

            <Pressable
              onPress={() => setHelpVisible(false)}
              className="items-center justify-center rounded-2xl py-3.5 mt-6 shadow-sm active:opacity-90"
              style={{ backgroundColor: '#2563EB' }}
            >
              <Text className="text-[15px] font-bold" style={{ color: '#FFFFFF' }}>
                {t('alarmRinging.closeHelp')}
              </Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
