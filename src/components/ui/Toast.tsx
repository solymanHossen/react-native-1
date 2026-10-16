import { AlertCircle, AlertTriangle, CheckCircle2, Info, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useToastStore, type ToastItem, type ToastType } from '../../store/toastStore';
import { useTheme } from '../../theme/useTheme';

const SPRING_CONFIG = { damping: 18, stiffness: 220, mass: 0.8 };

interface ToastItemViewProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const TYPE_CONFIG = {
  success: {
    icon: CheckCircle2,
    light: {
      iconColor: '#059669',
      badgeBg: '#DCFCE7',
      borderColor: '#A7F3D0',
      progressBar: '#10B981',
    },
    dark: {
      iconColor: '#34D399',
      badgeBg: 'rgba(16, 185, 129, 0.2)',
      borderColor: 'rgba(16, 185, 129, 0.35)',
      progressBar: '#10B981',
    },
  },
  error: {
    icon: AlertCircle,
    light: {
      iconColor: '#DC2626',
      badgeBg: '#FEE2E2',
      borderColor: '#FECACA',
      progressBar: '#EF4444',
    },
    dark: {
      iconColor: '#F87171',
      badgeBg: 'rgba(239, 68, 68, 0.2)',
      borderColor: 'rgba(239, 68, 68, 0.35)',
      progressBar: '#EF4444',
    },
  },
  warning: {
    icon: AlertTriangle,
    light: {
      iconColor: '#D97706',
      badgeBg: '#FEF3C7',
      borderColor: '#FDE68A',
      progressBar: '#F59E0B',
    },
    dark: {
      iconColor: '#FBBF24',
      badgeBg: 'rgba(245, 158, 11, 0.2)',
      borderColor: 'rgba(245, 158, 11, 0.35)',
      progressBar: '#F59E0B',
    },
  },
  info: {
    icon: Info,
    light: {
      iconColor: '#2563EB',
      badgeBg: '#DBEAFE',
      borderColor: '#BFDBFE',
      progressBar: '#3B82F6',
    },
    dark: {
      iconColor: '#60A5FA',
      badgeBg: 'rgba(59, 130, 246, 0.2)',
      borderColor: 'rgba(59, 130, 246, 0.35)',
      progressBar: '#3B82F6',
    },
  },
} as const;

function ToastItemView({ toast, onDismiss }: ToastItemViewProps) {
  const theme = useTheme();
  const isDark = theme.mode === 'dark';
  const config = TYPE_CONFIG[toast.type];
  const colors = isDark ? config.dark : config.light;
  const IconComponent = config.icon;

  const translateY = useSharedValue(-60);
  const opacity = useSharedValue(0);
  const scale = useSharedValue(0.92);
  const progress = useSharedValue(1);

  const duration = toast.duration ?? 3500;
  const isDismissing = useRef(false);

  const handleDismiss = useCallback(() => {
    if (isDismissing.current) return;
    isDismissing.current = true;
    opacity.value = withTiming(0, { duration: 200 });
    translateY.value = withTiming(-60, { duration: 220 }, (finished) => {
      if (finished) {
        runOnJS(onDismiss)(toast.id);
      }
    });
  }, [onDismiss, opacity, toast.id, translateY]);

  useEffect(() => {
    translateY.value = withSpring(0, SPRING_CONFIG);
    opacity.value = withTiming(1, { duration: 240 });
    scale.value = withSpring(1, SPRING_CONFIG);
    progress.value = withTiming(0, { duration });

    const timer = setTimeout(() => {
      handleDismiss();
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, handleDismiss, opacity, progress, scale, translateY]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }, { scale: scale.value }],
    opacity: opacity.value,
  }));

  const progressStyle = useAnimatedStyle(() => ({
    width: `${progress.value * 100}%`,
  }));

  return (
    <Animated.View
      style={[
        styles.toastWrapper,
        {
          backgroundColor: isDark ? 'rgba(26, 36, 51, 0.95)' : '#FFFFFF',
          borderColor: colors.borderColor,
          shadowColor: isDark ? '#000000' : '#1E3A8A',
        },
        animatedStyle,
      ]}
    >
      {/* Specular highlight hairline in dark mode */}
      {isDark ? <View pointerEvents="none" style={styles.darkHairline} /> : null}

      <View style={styles.contentRow}>
        {/* Type Icon Badge */}
        <View style={[styles.iconBadge, { backgroundColor: colors.badgeBg }]}>
          <IconComponent color={colors.iconColor} size={20} strokeWidth={2.4} />
        </View>

        {/* Message Content */}
        <View style={styles.textColumn}>
          {toast.title ? (
            <Text
              numberOfLines={1}
              style={[styles.titleText, { color: isDark ? '#FFFFFF' : '#0F172A' }]}
            >
              {toast.title}
            </Text>
          ) : null}
          <Text
            numberOfLines={2}
            style={[
              styles.messageText,
              { color: isDark ? '#CBD5E1' : '#334155', marginTop: toast.title ? 2 : 0 },
            ]}
          >
            {toast.message}
          </Text>
        </View>

        {/* Optional Action Button */}
        {toast.action ? (
          <Pressable
            onPress={() => {
              toast.action?.onPress();
              handleDismiss();
            }}
            style={[styles.actionBtn, { backgroundColor: colors.badgeBg }]}
            hitSlop={6}
          >
            <Text style={[styles.actionBtnText, { color: colors.iconColor }]}>
              {toast.action.label}
            </Text>
          </Pressable>
        ) : null}

        {/* Dismiss Button */}
        <Pressable
          onPress={handleDismiss}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Dismiss notification"
          style={styles.closeBtn}
        >
          <X color={isDark ? '#64748B' : '#94A3B8'} size={17} strokeWidth={2.4} />
        </Pressable>
      </View>

      {/* Progress Bar Indicator */}
      <View style={styles.progressTrack}>
        <Animated.View
          style={[styles.progressBar, { backgroundColor: colors.progressBar }, progressStyle]}
        />
      </View>
    </Animated.View>
  );
}

export function ToastContainer() {
  const insets = useSafeAreaInsets();
  const toasts = useToastStore((state) => state.toasts);
  const dismiss = useToastStore((state) => state.dismiss);

  if (toasts.length === 0) return null;

  return (
    <View
      pointerEvents="box-none"
      style={[styles.container, { top: Math.max(insets.top, 14) + 6 }]}
    >
      {toasts.map((item) => (
        <ToastItemView key={item.id} toast={item} onDismiss={dismiss} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 9999,
    gap: 8,
    alignItems: 'center',
  },
  toastWrapper: {
    width: '100%',
    borderRadius: 22,
    borderWidth: 1.2,
    overflow: 'hidden',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.14,
    shadowRadius: 16,
    elevation: 8,
  },
  darkHairline: {
    position: 'absolute',
    top: 0,
    left: 12,
    right: 12,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  contentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 11,
    gap: 12,
  },
  iconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  textColumn: {
    flex: 1,
    justifyContent: 'center',
  },
  titleText: {
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  messageText: {
    fontSize: 13,
    fontWeight: '500',
    lineHeight: 18,
  },
  actionBtn: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  actionBtnText: {
    fontSize: 12.5,
    fontWeight: '700',
  },
  closeBtn: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 14,
  },
  progressTrack: {
    height: 2.5,
    width: '100%',
    backgroundColor: 'transparent',
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderTopRightRadius: 2,
    borderBottomRightRadius: 2,
  },
});
