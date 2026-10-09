import { Check, X } from 'lucide-react-native';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';
import { StatusPill } from '../ui';
import type { DoseEntry, SkipReason } from '../../dashboard/types';
import { useTranslation, type TranslationKey } from '../../i18n';
import { useTheme } from '../../theme/useTheme';
import { triggerHaptic } from '../../lib/haptics';

const SWIPE_THRESHOLD = 96;
const FLY_OUT_DISTANCE = 520;
const SPRING_CONFIG = { damping: 18, stiffness: 220, mass: 0.6 };

const DOSE_STATE_KEY: Record<DoseEntry['state'], TranslationKey> = {
  taken: 'rhythm.doseState.taken',
  pending: 'rhythm.doseState.pending',
  missed: 'rhythm.doseState.missed',
  scheduled: 'rhythm.doseState.scheduled',
};

const SKIP_REASON_KEY: Record<SkipReason, TranslationKey> = {
  'Feeling better': 'rhythm.skipSheet.reasons.Feeling better',
  'Side effects': 'rhythm.skipSheet.reasons.Side effects',
  'Forgot dose': 'rhythm.skipSheet.reasons.Forgot dose',
  'Out of stock': 'rhythm.skipSheet.reasons.Out of stock',
  'Doctor advised': 'rhythm.skipSheet.reasons.Doctor advised',
};

function formatHour(hour: number): string {
  const h24 = Math.floor(hour);
  const minutes = Math.round((hour - h24) * 60);
  const period = h24 >= 12 ? 'PM' : 'AM';
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  return `${h12}:${minutes.toString().padStart(2, '0')} ${period}`;
}

function SwipeHint({ translateX, side }: { translateX: SharedValue<number>; side: 'left' | 'right' }) {
  const theme = useTheme();
  const isLeft = side === 'left';
  const Icon = isLeft ? Check : X;
  const color = isLeft ? theme.status.taken.base : theme.status.missed.base;

  const style = useAnimatedStyle(() => {
    const progress = isLeft ? Math.max(0, translateX.value) : Math.max(0, -translateX.value);
    return { opacity: Math.min(1, progress / SWIPE_THRESHOLD) };
  });

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: 0, bottom: 0, width: 72, alignItems: 'center', justifyContent: 'center' },
        isLeft ? { left: 0 } : { right: 0 },
        style,
      ]}
    >
      <Icon color={color} size={26} strokeWidth={2.5} />
    </Animated.View>
  );
}

/**
 * Pan-right commits "taken" (card flies off and resets at rest in its new
 * state — the same "swipe to complete" idiom as most reminder/task apps);
 * pan-left snaps back immediately and opens the skip-reason sheet, since a
 * skip needs a reason before it's committed. Long-press opens the detail
 * sheet. Pan and long-press are raced, not run simultaneously, so holding
 * still opens details while dragging never also fires a long-press.
 */
export function DoseActionCard({ dose, skipReason, onMarkTaken, onRequestSkip, onLongPressDetail }: DoseActionCardProps) {
  const theme = useTheme();
  const { t, language } = useTranslation();
  const translateX = useSharedValue(0);

  const commitTaken = () => {
    triggerHaptic('notificationSuccess');
    onMarkTaken(dose.id);
    translateX.value = 0;
  };

  const requestSkip = () => {
    triggerHaptic('impactLight');
    onRequestSkip(dose);
  };

  const openDetail = () => {
    triggerHaptic('impactLight');
    onLongPressDetail(dose);
  };

  const panGesture = Gesture.Pan()
    .activeOffsetX([-10, 10])
    .failOffsetY([-20, 20])
    .onUpdate((event) => {
      translateX.value = event.translationX;
    })
    .onEnd((event) => {
      if (event.translationX > SWIPE_THRESHOLD) {
        translateX.value = withSpring(FLY_OUT_DISTANCE, SPRING_CONFIG, (finished) => {
          if (finished) runOnJS(commitTaken)();
        });
      } else if (event.translationX < -SWIPE_THRESHOLD) {
        translateX.value = withSpring(0, SPRING_CONFIG);
        runOnJS(requestSkip)();
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
      }
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(450)
    .maxDistance(12)
    .onStart(() => {
      runOnJS(openDetail)();
    });

  const composedGesture = Gesture.Race(panGesture, longPressGesture);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const stateColor = theme.status[dose.state].base;
  const isSkipped = dose.state === 'missed' && Boolean(skipReason);

  return (
    <View style={{ position: 'relative' }}>
      <View style={StyleSheet.absoluteFill} pointerEvents="none">
        <SwipeHint translateX={translateX} side="left" />
        <SwipeHint translateX={translateX} side="right" />
      </View>
      <GestureDetector gesture={composedGesture}>
        <Animated.View
          style={[cardStyle, { backgroundColor: theme.colors.elevated, borderColor: theme.colors.hairline, borderLeftColor: stateColor }]}
          className="gap-2 rounded-3xl border border-l-4 p-5"
        >
          <View className="flex-row items-center justify-between gap-3">
            {/* `flex-1` + numberOfLines on the zone/time label, not the pill:
                the pill is the status-at-a-glance element and should never
                truncate — if anything has to give room when space is tight,
                it's the (less critical, also shown via the marker's color)
                zone/time text. */}
            <Text className="flex-1 text-caption uppercase tracking-wider" numberOfLines={1} style={{ color: theme.colors.inkSecondary }}>
              {language === 'bn' ? dose.labelBn : dose.label} · {formatHour(dose.hour)}
            </Text>
            <StatusPill status={dose.state} label={t(DOSE_STATE_KEY[dose.state])} />
          </View>
          <Text className="text-body-lg" style={{ color: theme.colors.ink, fontWeight: '600' }}>
            {dose.medicationName}
          </Text>
          <Text className="text-caption" style={{ color: theme.colors.inkMuted }}>
            {dose.dosage} · {t(`rhythm.mealRelation.${dose.mealRelation}` as never)}
          </Text>
          {isSkipped && skipReason ? (
            <Text className="text-caption" style={{ color: theme.statusText('missed') }}>
              {t('rhythm.skippedPrefix')}
              {t(SKIP_REASON_KEY[skipReason])}
            </Text>
          ) : null}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

interface DoseActionCardProps {
  dose: DoseEntry;
  skipReason?: SkipReason;
  onMarkTaken: (id: string) => void;
  onRequestSkip: (dose: DoseEntry) => void;
  onLongPressDetail: (dose: DoseEntry) => void;
}
