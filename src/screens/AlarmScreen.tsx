import notifee from '@notifee/react-native';
import { AlertTriangle, Camera as CameraIcon, CheckCircle2, Clock, Nfc } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Camera, useCameraDevice, useCameraPermission } from 'react-native-vision-camera';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { cancelAnimation, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import { EmergencyHoldButton, LargeTextButton } from '../components/ui';
import {
  OVERRIDE_HOLD_MS,
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
import { action as brandAction, palette, status } from '../theme/tokens';
import { triggerHapticCascade, triggerHaptic } from '../lib/haptics';
import { speakReminder, stopSpeaking } from '../lib/tts';

const VISION_CAPTURE_INTERVAL_MS = 2500;

/**
 * How often the voice announcement repeats while the alarm stays
 * unresolved. A single announcement only reaches someone who happens to be
 * listening at that exact moment — asleep, in another room, or mid-task, a
 * one-shot utterance is as good as silent. 30s is short enough to still be
 * useful well before the 15-minute `ESCALATION_TIMEOUT_MS` caregiver
 * handoff, long enough that a ~4-6s spoken reminder ("Time to take your
 * Naprosyn, 1 tablet, with food") never overlaps itself, and matches how the
 * NFC/vision verification loops in this same screen already poll on a fixed
 * interval rather than a one-shot check.
 */
const VOICE_REPEAT_INTERVAL_MS = 30 * 1000;

/**
 * This screen deliberately ignores the user's light/dark preference (see the
 * component doc comment) and always renders as a fixed dark surface, so its
 * colors come straight from `palette.dark`/`status` rather than `useTheme()`.
 */
const SCHEDULED_ACCENT = status.scheduled.onDark ?? status.scheduled.base;

type VerificationMode = 'nfc' | 'vision';
type Resolution = 'pending' | 'verified' | 'overridden' | 'escalated';

function usePulse() {
  const pulse = useSharedValue(1);
  useEffect(() => {
    pulse.value = withRepeat(withSequence(withTiming(1.12, { duration: 700 }), withTiming(1, { duration: 700 })), -1, false);
    return () => cancelAnimation(pulse);
  }, [pulse]);
  return pulse;
}

interface AlarmScreenProps {
  alarm: ActiveAlarm;
}

/**
 * Takes over the entire screen whenever an alarm is active (see App.tsx) —
 * there is deliberately no back button, no tab bar, no way to navigate away
 * from it except the three resolution paths below: NFC match, vision match,
 * or the hold-to-override safety valve.
 */
export default function AlarmScreen({ alarm }: AlarmScreenProps) {
  const { t, language } = useTranslation();
  const { payload, firedAtMs, snoozeCount } = alarm;
  const clearActiveAlarm = useActiveAlarmStore((state) => state.clearActiveAlarm);
  const incrementSnooze = useActiveAlarmStore((state) => state.incrementSnooze);

  const [mode, setMode] = useState<VerificationMode>('nfc');
  const [nfcReady, setNfcReady] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [resolution, setResolution] = useState<Resolution>('pending');
  const [remainingMs, setRemainingMs] = useState(() => msUntilEscalation(firedAtMs, Date.now()));
  const resolvedRef = useRef(false);
  const voiceRepeatTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pulse = usePulse();

  const pulseStyle = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));

  // Stops both the in-progress utterance and the repeat timer together —
  // every resolution path (verify/snooze/override/escalate) needs both, and
  // calling this instead of a bare `stopSpeaking()` is what makes the repeat
  // stop the instant resolution begins rather than up to
  // VOICE_REPEAT_INTERVAL_MS late (or, for the 1.1s "confirmed" celebration
  // screen, firing one extra repeat during it).
  const stopVoiceAnnouncements = useCallback(() => {
    if (voiceRepeatTimer.current) {
      clearInterval(voiceRepeatTimer.current);
      voiceRepeatTimer.current = null;
    }
    stopSpeaking().catch(() => {});
  }, []);

  // Speaks the reminder the moment this specific alarm instance mounts, then
  // keeps repeating it every VOICE_REPEAT_INTERVAL_MS until the alarm
  // resolves — a single announcement only reaches someone already listening
  // at that exact moment (notifee's fullScreenAction already brought the app
  // to the foreground to get here — this is "Path B" from the
  // voice-announcement design: reading it aloud once the app is actually
  // running, not attempting background TTS before the Activity exists, which
  // no community RN TTS library can do reliably on a killed app). Keyed on
  // notificationId, not payload/language, so it (re)starts exactly once per
  // alarm and never restarts on an unrelated re-render.
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
    // `payload` is stable for the lifetime of one alarm (incrementSnooze
    // spreads a new activeAlarm object but keeps the same payload reference),
    // so this still only (re)starts once per real alarm instance even though
    // `payload` is listed here for exhaustive-deps correctness.
  }, [alarm.notificationId, payload, language]);

  const resolveAndClose = useCallback(
    async (next: Resolution, action: () => Promise<void>) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      stopVoiceAnnouncements();
      try {
        await action();
      } catch (error) {
        // The action (confirmIntake/escalateToCaregiver/logManualOverride) never
        // completed, so the alarm must stay active and resolvable — flipping to
        // "confirmed" here would tell the patient a dose was logged when it wasn't.
        console.warn('[AlarmScreen] resolution action failed, keeping alarm active', error);
        resolvedRef.current = false;
        setStatusMessage(t('alarmRinging.actionFailed'));
        return;
      }
      setResolution(next);
      await notifee.cancelNotification(alarm.notificationId).catch(() => {});
      setTimeout(() => clearActiveAlarm(), next === 'verified' ? 1100 : 0);
    },
    [alarm.notificationId, clearActiveAlarm, stopVoiceAnnouncements, t],
  );

  // NFC: starts listening the moment the screen mounts (or the moment the
  // user switches back to NFC mode after trying the camera) and keeps
  // listening until a match resolves the alarm or the screen unmounts.
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

  // Vision fallback: auto-captures and scores a frame on a fixed interval
  // rather than a manual shutter — the person using this may be groggy or
  // fumbling with a blister pack, and shouldn't also have to time a photo.
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
    // `scanning` is deliberately not a dependency: the interval callback itself
    // toggles it every cycle via setScanning (kept only for the UI spinner), so
    // including it here would tear down and recreate this interval twice per
    // capture, drifting the real capture cadence away from VISION_CAPTURE_INTERVAL_MS.
  }, [mode, hasPermission, requestPermission, payload, resolveAndClose]);

  // Escalation countdown — ticks every second; once 15 minutes pass with no
  // resolution, auto-marks the dose MISSED and alerts the configured
  // caregiver number, then closes the screen on its own.
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
    // Shares `resolvedRef` with resolveAndClose so an NFC/vision match or the
    // escalation timeout landing while this is in flight can't race it —
    // without this guard both paths could run concurrently and double-write.
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

  // Hold-to-override: a sustained press for OVERRIDE_HOLD_MS silences the
  // alarm without verification — logged as a manual override, never as a
  // confirmed dose. Exists so a hardware failure (no tag, dead camera)
  // or a genuine emergency can't trap someone in an un-silenceable screen.
  const handleOverrideComplete = useCallback(() => {
    resolveAndClose('overridden', () => logManualOverride(payload));
  }, [payload, resolveAndClose]);

  if (resolution === 'verified') {
    return (
      <SafeAreaView className="flex-1 items-center justify-center gap-6" style={{ backgroundColor: palette.dark.canvas }}>
        <View
          className="items-center justify-center rounded-full"
          style={{
            width: 160,
            height: 160,
            backgroundColor: 'rgba(16, 185, 129, 0.12)',
            shadowColor: status.taken.baseDark ?? status.taken.base,
            shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.5,
            shadowRadius: 24,
            elevation: 10,
          }}
        >
          <CheckCircle2 color={status.taken.baseDark ?? status.taken.base} size={96} strokeWidth={1.5} />
        </View>
        <Text className="text-title-lg" style={{ color: palette.dark.ink }}>
          {t('alarmRinging.confirmed', { name: payload.medicationName })}
        </Text>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: palette.dark.canvas }}>
      <View className="flex-1 items-center justify-center gap-5 px-8">
        {/* Medication info card: the one piece of information the whole screen
            exists to surface, so it gets the same glass-card treatment as
            every other primary surface in the app instead of floating
            directly on the bare canvas. */}
        <View
          className="w-full items-center gap-2 rounded-3xl px-6 py-7"
          style={{
            backgroundColor: 'rgba(31, 41, 55, 0.75)',
            borderWidth: 1,
            borderColor: 'rgba(255, 255, 255, 0.08)',
            shadowColor: '#000000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: 0.35,
            shadowRadius: 20,
            elevation: 8,
          }}
        >
          <View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 20, right: 20, height: 1, backgroundColor: 'rgba(255, 255, 255, 0.1)' }} />
          <Text className="text-caption uppercase tracking-wider" style={{ color: palette.dark.inkMuted }}>
            {payload.title ?? t('alarmRinging.title')}
          </Text>
          <Text className="text-center text-display-lg" style={{ color: '#FFFFFF' }}>
            {payload.medicationName}
          </Text>
          <Text className="text-center text-body-lg" style={{ color: palette.dark.inkSecondary }}>
            {payload.dosageLabel}
          </Text>
        </View>

        {mode === 'nfc' ? (
          <View className="items-center gap-4">
            <Animated.View style={pulseStyle}>
              <View
                className="items-center justify-center rounded-full"
                style={{
                  width: 140,
                  height: 140,
                  backgroundColor: `${brandAction.dark.base}2E`,
                  borderWidth: 1,
                  borderColor: `${brandAction.dark.base}55`,
                  shadowColor: brandAction.dark.base,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.6,
                  shadowRadius: 20,
                  elevation: 8,
                }}
              >
                <Nfc color={SCHEDULED_ACCENT} size={64} strokeWidth={1.5} />
              </View>
            </Animated.View>
            <Text className="text-center text-body-lg" style={{ color: '#FFFFFF' }}>
              {nfcReady ? t('alarmRinging.nfcPrompt') : t('alarmRinging.nfcUnavailable')}
            </Text>
          </View>
        ) : (
          <View className="w-full items-center gap-3">
            <View
              className="overflow-hidden rounded-3xl"
              style={{
                width: 240,
                height: 320,
                backgroundColor: '#000000',
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.12)',
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 10 },
                shadowOpacity: 0.4,
                shadowRadius: 20,
                elevation: 8,
              }}
            >
              {device && hasPermission ? (
                <Camera ref={cameraRef} style={{ width: 240, height: 320 }} device={device} isActive photo />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <CameraIcon color={palette.dark.inkMuted} size={40} />
                </View>
              )}
            </View>
            <Text className="text-center text-body-lg" style={{ color: '#FFFFFF' }}>
              {t('alarmRinging.visionPrompt')}
            </Text>
            {scanning ? <ActivityIndicator color="#FFFFFF" /> : null}
            {lastConfidence !== null ? (
              <Text className="text-caption" style={{ color: palette.dark.inkSecondary }}>
                {t('alarmRinging.lastReadMatch', { confidence: lastConfidence, threshold: VISION_CONFIDENCE_THRESHOLD })}
              </Text>
            ) : null}
          </View>
        )}

        {statusMessage ? (
          <View
            className="flex-row items-center gap-2 rounded-2xl px-4 py-2"
            style={{
              backgroundColor: 'rgba(255,107,107,0.15)',
              borderWidth: 1,
              borderColor: 'rgba(255,107,107,0.3)',
            }}
          >
            <AlertTriangle color="#FF6B6B" size={18} />
            <Text className="text-caption" style={{ color: '#FF9B9B' }}>
              {statusMessage}
            </Text>
          </View>
        ) : null}

        <Pressable onPress={() => setMode(mode === 'nfc' ? 'vision' : 'nfc')} accessibilityRole="button">
          <Text className="text-body-lg underline" style={{ color: SCHEDULED_ACCENT }}>
            {mode === 'nfc' ? t('alarmRinging.useCameraInstead') : t('alarmRinging.useNfcInstead')}
          </Text>
        </Pressable>

        <View
          className="flex-row items-center gap-2 rounded-full px-4 py-2"
          style={{ backgroundColor: 'rgba(255, 255, 255, 0.06)', borderWidth: 1, borderColor: 'rgba(255, 255, 255, 0.08)' }}
        >
          <Clock color={palette.dark.inkMuted} size={14} />
          <Text className="text-caption" style={{ color: palette.dark.inkMuted }}>
            {t('alarmRinging.autoEscalates', { time: formatCountdown(remainingMs) })}
          </Text>
        </View>
      </View>

      <View className="gap-4 px-8 pb-10">
        {canSnooze(snoozeCount) ? (
          <LargeTextButton
            label={t('alarmRinging.snooze', { count: remainingSnoozes(snoozeCount) })}
            variant="secondary"
            onPress={handleSnooze}
            forceDark
          />
        ) : (
          <View
            className="min-h-hit items-center justify-center rounded-full border px-8 py-5"
            style={{ backgroundColor: 'rgba(31, 41, 55, 0.75)', borderColor: palette.dark.hairline }}
          >
            <Text className="text-body-lg" style={{ color: palette.dark.inkMuted }}>
              {t('alarmRinging.noSnoozesLeft')}
            </Text>
          </View>
        )}

        <EmergencyHoldButton
          onComplete={handleOverrideComplete}
          holdDurationMs={OVERRIDE_HOLD_MS}
          accessibilityLabel={t('alarmRinging.overrideAccessibility')}
        />
      </View>
    </SafeAreaView>
  );
}
