/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AlarmClock, Camera, HeartPulse, Home, Pill, Waves } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Image, Pressable, StatusBar, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Animated, { runOnJS, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { initializeAlarmSystem } from './src/alarms';
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

type Tab = 'home' | 'drugLab' | 'scanRx' | 'rhythm' | 'alarms' | 'vitals';

const TAB_ORDER: Tab[] = ['home', 'drugLab', 'scanRx', 'rhythm', 'alarms', 'vitals'];

const TAB_ICON: Record<Tab, ComponentType<{ size?: number; color?: string; strokeWidth?: number }>> = {
  home: Home,
  drugLab: Pill,
  scanRx: Camera,
  rhythm: Waves,
  alarms: AlarmClock,
  vitals: HeartPulse,
};

// `drugLab`'s key is shortened for this bar specifically ("Meds" not
// "Medications"): six stacked icon+label columns leaves too little width per
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

/**
 * World-class bottom navigation bar:
 * Seamless sticky bottom bar with frosted glass effect, glowing active indicator,
 * and minimal monochrome icons strictly adhering to Apple HIG & Material You aesthetics.
 */
function BottomTabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const theme = useTheme();
  const { t } = useTranslation();
  const segmentLayouts = useRef<Partial<Record<Tab, { x: number; width: number }>>>({});
  const pillX = useSharedValue(0);

  const isHome = tab === 'home';

  const handleSegmentLayout = (value: Tab) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    segmentLayouts.current[value] = { x, width };
    if (value === tab && pillX.value === 0) {
      pillX.value = x + width / 2 - PILL_WIDTH / 2;
    }
  };

  useEffect(() => {
    const layout = segmentLayouts.current[tab];
    if (!layout) return;
    pillX.value = withSpring(layout.x + layout.width / 2 - PILL_WIDTH / 2, PILL_SPRING);
  }, [tab, pillX]);

  const pillStyle = useAnimatedStyle(() => ({ transform: [{ translateX: pillX.value }] }));

  const handlePress = (value: Tab) => {
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
        {TAB_ORDER.map((value) => {
          const isActive = tab === value;
          const Icon = TAB_ICON[value];
          const label = t(TAB_LABEL_KEY[value]);

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

  return (
    // GestureHandlerRootView wraps the whole app, not just the screen that
    // uses it: react-native-gesture-handler (a @gorhom/bottom-sheet peer
    // dependency) requires exactly one root-level wrapper, and it has to be
    // an ancestor of every gesture-handling view, not a per-screen concern.
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: palette[mode].canvas }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          {activeAlarm ? (
            // A fired alarm takes over the whole app — no tab bar, no way
            // back to the normal screens except resolving it
            <>
              <StatusBar barStyle="light-content" />
              <AlarmScreen alarm={activeAlarm} />
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
        {splashMounted ? <BootSplash visible={!bootDone} onHidden={() => setSplashMounted(false)} /> : null}
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
