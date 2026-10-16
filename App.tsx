/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import {
  BottomSheetBackdrop,
  type BottomSheetBackdropProps,
  BottomSheetModal,
  BottomSheetModalProvider,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import { AlarmClock, Camera, ChevronRight, Ellipsis, HeartPulse, Home, Pill, Waves } from 'lucide-react-native';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ComponentType } from 'react';
import { BackHandler, Image, LogBox, Pressable, StatusBar, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { initializeAlarmSystem } from './src/alarms';
import { ErrorBoundary, ToastContainer } from './src/components/ui';
import { useTranslation, type TranslationKey } from './src/i18n';
import { triggerHaptic } from './src/lib/haptics';
import AlarmScreen from './src/screens/AlarmScreen';
import AlarmsScreen from './src/screens/AlarmsScreen';
import CircadianDashboardScreen from './src/screens/CircadianDashboardScreen';
import DrugLabScreen from './src/screens/DrugLabScreen';
import HomeScreen from './src/screens/HomeScreen';
import PrescriptionScanScreen from './src/screens/PrescriptionScanScreen';
import { refreshAllStores, useActiveAlarmStore } from './src/store';
import type { VitalType } from './src/db/types';
import VitalsScreen from './src/screens/VitalsScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import { palette } from './src/theme/tokens';
import { useTheme, useThemeMode } from './src/theme/useTheme';
import './global.css';

// Two warnings this app can't actually act on, both from third-party code and
// both dev-only (LogBox doesn't exist in a release build, so neither ever
// reaches a real user) — but both fire constantly and their LogBox
// notification was intermittently eating taps meant for the screen below it:
//  - @gorhom/bottom-sheet@5.2.14 (latest published version) still calls several
//    Reanimated hooks with an explicit dependency array, which Reanimated 4's
//    dev-only check now warns on even though the array is harmlessly ignored
//    on native either way (the warning itself says so). Bottom sheets are
//    used throughout this app, so this fires on practically every screen.
//  - NativeWind's css-interop runtime touches RN's `ImageBackground` export at
//    import time (to register `className` support for it) merely by
//    importing `./global.css` below — regardless of whether this app ever
//    renders one — which trips RN's own lazy-module deprecation warning for
//    that component on every single launch.
LogBox.ignoreLogs([
  'Dependencies should only be used on the web and are always ignored on native',
  'ImageBackground is deprecated',
]);

type Tab = 'home' | 'drugLab' | 'scanRx' | 'rhythm' | 'alarms' | 'vitals';

// Apple HIG and Material Design both call for the same fix once a tab bar
// passes 5 items: keep the most-used destinations as direct tabs and fold
// the rest into a single "More" tab (iOS's own UITabBarController does this
// automatically past 5; Android has no built-in equivalent, so it's built
// by hand here). Home/Meds/Alarms/Vitals are this app's core daily-use loop
// (check in, manage medications, set/react to reminders, track vitals);
// Scan Rx (an occasional "add a medication via camera" utility) and Rhythm
// (a secondary visualization of the same schedule Alarms already manages)
// are the two that move into "More" — nothing is removed, just regrouped.
const PRIMARY_TABS: Tab[] = ['home', 'drugLab', 'alarms', 'vitals'];
const OVERFLOW_TABS: Tab[] = ['scanRx', 'rhythm'];
const MORE_SEGMENT = 'more' as const;
type TabBarSegment = Tab | typeof MORE_SEGMENT;
const TAB_BAR_SEGMENTS: TabBarSegment[] = [...PRIMARY_TABS, MORE_SEGMENT];

const TAB_ICON: Record<Tab, ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  home: Home,
  drugLab: Pill,
  scanRx: Camera,
  rhythm: Waves,
  alarms: AlarmClock,
  vitals: HeartPulse,
};

// `drugLab`'s key is shortened for this bar specifically ("Meds" not
// "Medications"): five stacked icon+label columns leaves too little width per
// tab for the full word (the screen itself still titles itself that in full
// — see DrugLabScreen).
const TAB_LABEL_KEY: Record<Tab, TranslationKey> = {
  home: 'tabs.home',
  drugLab: 'tabs.medications',
  scanRx: 'tabs.scanRx',
  rhythm: 'tabs.rhythm',
  alarms: 'tabs.alarms',
  vitals: 'tabs.vitals',
};

const PILL_WIDTH = 58;
const PILL_HEIGHT = 34;
const PILL_TOP = 7;
const PILL_SPRING = { damping: 20, stiffness: 260, mass: 0.7 };

interface MoreSheetRef {
  present: () => void;
}

/** The two tabs folded out of the primary bar — same `ActiveScreen` destinations, just reached through one extra tap instead of a direct tab. */
const MoreSheet = forwardRef<MoreSheetRef, { onSelect: (tab: Tab) => void }>(function MoreSheetImpl({ onSelect }, ref) {
  const theme = useTheme();
  const { t } = useTranslation();
  const modalRef = useRef<BottomSheetModal>(null);

  useImperativeHandle(ref, () => ({ present: () => modalRef.current?.present() }), []);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={theme.mode === 'dark' ? 0.75 : 0.5}
        pressBehavior="close"
      />
    ),
    [theme.mode],
  );

  return (
    <BottomSheetModal
      ref={modalRef}
      enableDynamicSizing
      enablePanDownToClose
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: theme.colors.surface,
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        borderWidth: theme.mode === 'dark' ? 1 : 0,
        borderColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.10)' : 'transparent',
      }}
      handleIndicatorStyle={{
        backgroundColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.22)' : theme.colors.hairline,
        width: 36,
        height: 4.5,
        borderRadius: 3,
      }}
    >
      <BottomSheetView style={{ paddingHorizontal: 24, paddingTop: 4, paddingBottom: 24, gap: 4 }}>
        <Text className="text-title-lg font-bold" style={{ color: theme.colors.ink, marginBottom: 8 }}>
          {t('tabs.moreSheetTitle')}
        </Text>
        {OVERFLOW_TABS.map((value) => {
          const Icon = TAB_ICON[value];
          return (
            <Pressable
              key={value}
              onPress={() => {
                triggerHaptic('selection');
                modalRef.current?.dismiss();
                onSelect(value);
              }}
              accessibilityRole="button"
              className="min-h-hit flex-row items-center gap-3 rounded-2xl px-2 py-3"
            >
              <View className="items-center justify-center rounded-2xl" style={{ width: 42, height: 42, backgroundColor: `${theme.action.base}14` }}>
                <Icon color={theme.action.base} size={21} strokeWidth={2.25} />
              </View>
              <Text className="flex-1 text-body-lg font-semibold" style={{ color: theme.colors.ink }}>
                {t(TAB_LABEL_KEY[value])}
              </Text>
              <ChevronRight color={theme.colors.inkMuted} size={18} strokeWidth={2.5} />
            </Pressable>
          );
        })}
      </BottomSheetView>
    </BottomSheetModal>
  );
});

/**
 * World-class bottom navigation bar:
 * Seamless sticky bottom bar with frosted glass effect, glowing active indicator,
 * and minimal monochrome icons strictly adhering to Apple HIG & Material You aesthetics.
 * Caps at 5 visible segments (4 primary tabs + "More") per Apple HIG/Material
 * guidance for tab bars past 5 items — see PRIMARY_TABS/OVERFLOW_TABS above.
 */
function BottomTabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const segmentLayouts = useRef<Partial<Record<TabBarSegment, { x: number; width: number }>>>({});
  const pillX = useSharedValue(0);
  const moreSheetRef = useRef<MoreSheetRef>(null);

  // Which of the 5 rendered segments should look active: the 4 primary tabs
  // map 1:1, but `scanRx`/`rhythm` aren't rendered as their own segment
  // anymore — they roll up to "More" so it doesn't look unselected while
  // you're actually on one of its two screens.
  const activeSegment: TabBarSegment = OVERFLOW_TABS.includes(tab) ? MORE_SEGMENT : tab;
  const isHome = activeSegment === 'home';

  const handleSegmentLayout = (value: TabBarSegment) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    segmentLayouts.current[value] = { x, width };
    if (value === activeSegment && pillX.value === 0) {
      pillX.value = x + width / 2 - PILL_WIDTH / 2;
    }
  };

  useEffect(() => {
    const layout = segmentLayouts.current[activeSegment];
    if (!layout) return;
    pillX.value = withSpring(layout.x + layout.width / 2 - PILL_WIDTH / 2, PILL_SPRING);
  }, [activeSegment, pillX]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

  const handlePress = (value: TabBarSegment) => {
    if (value === MORE_SEGMENT) {
      triggerHaptic('selection');
      moreSheetRef.current?.present();
      return;
    }
    if (value !== tab) triggerHaptic('selection');
    onChange(value);
  };

  return (
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={{
        backgroundColor: theme.mode === 'dark' ? 'rgba(15, 23, 42, 0.92)' : theme.colors.surface,
        borderTopWidth: 1,
        borderTopColor: theme.mode === 'dark' ? 'rgba(255, 255, 255, 0.08)' : theme.colors.hairline,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: theme.mode === 'dark' ? 0.45 : 0.08,
        shadowRadius: 18,
        elevation: 16,
      }}
    >
      {/* Specular frosted glass hairline */}
      {theme.mode === 'dark' ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: 1,
            backgroundColor: 'rgba(255, 255, 255, 0.1)',
          }}
        />
      ) : null}

      <View style={{ flexDirection: 'row', paddingTop: 2 }}>
        {/* Active indicator pill — a glowing translucent outline in dark mode
            (part of the glassmorphism redesign), the original solid action-color
            pill in light mode. */}
        <Animated.View
          pointerEvents="none"
          style={[
            theme.mode === 'dark'
              ? {
                  position: 'absolute',
                  top: PILL_TOP,
                  left: 0,
                  width: PILL_WIDTH,
                  height: PILL_HEIGHT,
                  borderRadius: 17,
                  backgroundColor: isHome ? 'rgba(59, 130, 246, 0.22)' : 'rgba(59, 130, 246, 0.16)',
                  borderWidth: 1,
                  borderColor: isHome ? 'rgba(96, 165, 250, 0.55)' : 'rgba(59, 130, 246, 0.35)',
                  shadowColor: '#3B82F6',
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: isHome ? 0.9 : 0.7,
                  shadowRadius: isHome ? 14 : 10,
                  elevation: 8,
                }
              : {
                  position: 'absolute',
                  top: PILL_TOP,
                  left: 0,
                  width: PILL_WIDTH,
                  height: PILL_HEIGHT,
                  borderRadius: 16,
                  backgroundColor: theme.action.base,
                },
            pillStyle,
          ]}
        />
        {TAB_BAR_SEGMENTS.map((value) => {
          const isActive = activeSegment === value;
          const Icon = value === MORE_SEGMENT ? Ellipsis : TAB_ICON[value];
          const label = value === MORE_SEGMENT ? t('tabs.more') : t(TAB_LABEL_KEY[value]);

          // Minimal monochrome icons in dark mode (#FFFFFF active, #94A3B8
          // inactive); light mode keeps the original theme-driven colors.
          const iconColor = theme.mode === 'dark' ? (isActive ? '#FFFFFF' : '#94A3B8') : isActive ? theme.action.ink : theme.colors.inkMuted;
          const labelColor = theme.mode === 'dark' ? (isActive ? '#FFFFFF' : '#64748B') : isActive ? theme.action.base : theme.colors.inkMuted;

          return (
            <Pressable
              key={value}
              onLayout={handleSegmentLayout(value)}
              onPress={() => handlePress(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 6 }}
            >
              <View style={{ width: PILL_WIDTH, height: PILL_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={iconColor} strokeWidth={isActive ? 2.25 : 1.85} />
              </View>
              <Text
                style={{
                  fontSize: 10.5,
                  fontWeight: isActive ? '800' : '600',
                  color: labelColor,
                  letterSpacing: 0.2,
                }}
                numberOfLines={1}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <MoreSheet ref={moreSheetRef} onSelect={onChange} />
    </SafeAreaView>
  );
}

/** A quick fade on the incoming screen, not an abrupt cut — the tab content swap is the other half of "smooth," the pill sliding over an instantly-replaced screen would look like two unrelated animations. */
function FadingScreen({
  tab,
  onNavigate,
  onOpenSettings,
  vitalsFocus,
}: {
  tab: Tab;
  onNavigate: (tab: Tab, focus?: VitalType) => void;
  onOpenSettings: () => void;
  vitalsFocus: VitalType | null;
}) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 180 });
  }, [tab, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[{ flex: 1 }, style]}>
      <ActiveScreen tab={tab} onNavigate={onNavigate} onOpenSettings={onOpenSettings} vitalsFocus={vitalsFocus} />
    </Animated.View>
  );
}

function ActiveScreen({
  tab,
  onNavigate,
  onOpenSettings,
  vitalsFocus,
}: {
  tab: Tab;
  onNavigate: (tab: Tab, focus?: VitalType) => void;
  onOpenSettings: () => void;
  vitalsFocus: VitalType | null;
}) {
  switch (tab) {
    case 'home':
      return <HomeScreen onNavigateToVitals={(focus) => onNavigate('vitals', focus)} onOpenSettings={onOpenSettings} />;
    case 'drugLab':
      return <DrugLabScreen />;
    case 'scanRx':
      return <PrescriptionScanScreen />;
    case 'rhythm':
      return <CircadianDashboardScreen />;
    case 'alarms':
      return <AlarmsScreen onOpenSettings={onOpenSettings} onNavigateToMedications={() => onNavigate('drugLab')} />;
    case 'vitals':
      return <VitalsScreen focusVital={vitalsFocus} />;
  }
}

const BOOT_SPLASH_FADE_MS = 250;

/**
 * JS-level continuation of the native splash. The native drawable
 * (android/app/src/main/res/drawable/splash_background.xml) only covers
 * pre-API-31 devices showing "Medicine Reminder" / the tagline — API 31+
 * is bound by the platform's own icon-only splash screen rules and can't
 * show that text at all, so this picks up right where the native splash
 * leaves off, on every Android version, until the real stores are primed.
 * Fades out (not an abrupt unmount) once `visible` goes false.
 */
function BootSplash({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  const { t } = useTranslation();
  const opacity = useSharedValue(1);

  useEffect(() => {
    if (!visible) {
      opacity.value = withTiming(0, { duration: BOOT_SPLASH_FADE_MS }, (finished) => {
        if (finished) runOnJS(onHidden)();
      });
    }
  }, [visible, opacity, onHidden]);

  const fadeStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        fadeStyle,
        { backgroundColor: '#395886', alignItems: 'center', justifyContent: 'center', zIndex: 50 },
      ]}
    >
      <Image source={require('./assets/branding/medicine-reminder-icon.png')} style={{ width: 96, height: 96 }} resizeMode="contain" />
      <Text style={{ marginTop: 14, fontSize: 21, fontWeight: '800', color: '#FFFFFF' }}>{t('home.brand')}</Text>
      <Text style={{ marginTop: 2, fontSize: 13, fontWeight: '500', color: 'rgba(255, 255, 255, 0.8)' }}>{t('splash.tagline')}</Text>
    </Animated.View>
  );
}

function App() {
  // Driven by our Zustand/MMKV theme store, not the OS scheme directly — the
  // app's theme preference ('light' | 'dark' | 'system') can diverge from
  // the device setting, and the status bar should follow whichever mode
  // NativeWind actually resolved to.
  const mode = useThemeMode();
  const [tab, setTab] = useState<Tab>('home');
  const [vitalsFocus, setVitalsFocus] = useState<VitalType | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeAlarm = useActiveAlarmStore((state) => state.activeAlarm);
  const clearActiveAlarm = useActiveAlarmStore((state) => state.clearActiveAlarm);

  // Boot splash: visible until the stores are actually primed *and* a
  // minimum floor has elapsed (so it doesn't flash-and-vanish on a fast
  // device/reload — a sub-200ms boot splash reads as a glitch, not a splash).
  // `splashMounted` stays true through the fade-out; BootSplash flips it
  // off itself once the animation finishes.
  const [storesReady, setStoresReady] = useState(false);
  const [minDelayDone, setMinDelayDone] = useState(false);
  const [splashMounted, setSplashMounted] = useState(true);
  const bootDone = storesReady && minDelayDone;

  const handleNavigate = (nextTab: Tab, focus?: VitalType) => {
    setVitalsFocus(nextTab === 'vitals' ? (focus ?? null) : null);
    setTab(nextTab);
  };

  useEffect(() => {
    const timer = setTimeout(() => setMinDelayDone(true), 600);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    Promise.allSettled([
      initializeAlarmSystem().catch((error: unknown) => {
        console.warn('[App] failed to initialize the alarm system', error);
      }),
      refreshAllStores().catch((error: unknown) => {
        console.warn('[App] failed to prime the shared stores', error);
      }),
    ]).finally(() => setStoresReady(true));
  }, []);

  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      if (settingsOpen) {
        setSettingsOpen(false);
        return true;
      }
      if (tab !== 'home') {
        setTab('home');
        return true;
      }
      return false;
    });
    return () => subscription.remove();
  }, [settingsOpen, tab]);

  return (
    // GestureHandlerRootView wraps the whole app, not just the screen that
    // uses it: react-native-gesture-handler (a @gorhom/bottom-sheet peer
    // dependency) requires exactly one root-level wrapper, and it has to be
    // an ancestor of every gesture-handling view, not a per-screen concern.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette[mode].canvas }}>
      <ErrorBoundary>
        <SafeAreaProvider>
          <BottomSheetModalProvider>
            {activeAlarm ? (
              <>
                <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
                <AlarmScreen
                  alarm={activeAlarm}
                  onBack={() => clearActiveAlarm()}
                  onNavigate={(nextTab) => {
                    clearActiveAlarm();
                    handleNavigate(nextTab);
                  }}
                />
                <BottomTabBar
                  tab="alarms"
                  onChange={(nextTab) => {
                    clearActiveAlarm();
                    handleNavigate(nextTab);
                  }}
                />
              </>
            ) : (
              <>
                <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
                {settingsOpen ? (
                  <SettingsScreen onBack={() => setSettingsOpen(false)} />
                ) : (
                  <>
                    <FadingScreen tab={tab} onNavigate={handleNavigate} onOpenSettings={() => setSettingsOpen(true)} vitalsFocus={vitalsFocus} />
                    <BottomTabBar tab={tab} onChange={(nextTab) => handleNavigate(nextTab)} />
                  </>
                )}
              </>
            )}
          </BottomSheetModalProvider>
          <ToastContainer />
          {splashMounted ? <BootSplash visible={!bootDone} onHidden={() => setSplashMounted(false)} /> : null}
        </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default App;
