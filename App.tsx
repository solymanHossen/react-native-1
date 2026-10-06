/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { AlarmClock, Camera, HeartPulse, Home, Pill, Waves } from 'lucide-react-native';
import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Pressable, StatusBar, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { initializeAlarmSystem } from './src/alarms';
import { triggerHaptic } from './src/lib/haptics';
import AlarmScreen from './src/screens/AlarmScreen';
import AlarmsScreen from './src/screens/AlarmsScreen';
import CircadianDashboardScreen from './src/screens/CircadianDashboardScreen';
import DrugLabScreen from './src/screens/DrugLabScreen';
import HomeScreen from './src/screens/HomeScreen';
import PrescriptionScanScreen from './src/screens/PrescriptionScanScreen';
import { refreshAllStores, useActiveAlarmStore } from './src/store';
import VitalsScreen from './src/screens/VitalsScreen';
import { useTheme, useThemeMode } from './src/theme/useTheme';
import './global.css';

type Tab = 'home' | 'drugLab' | 'scanRx' | 'rhythm' | 'alarms' | 'vitals';

const TAB_ORDER: Tab[] = ['home', 'drugLab', 'scanRx', 'rhythm', 'alarms', 'vitals'];

const TAB_CONFIG: Record<Tab, { label: string; Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }> }> = {
  home: { label: 'Home', Icon: Home },
  // Shortened just for this bar: six stacked icon+label columns leaves too
  // little width per tab for the full "Medications" (the screen itself still
  // titles itself that in full — see DrugLabScreen).
  drugLab: { label: 'Meds', Icon: Pill },
  scanRx: { label: 'Scan Rx', Icon: Camera },
  rhythm: { label: 'Rhythm', Icon: Waves },
  alarms: { label: 'Alarms', Icon: AlarmClock },
  vitals: { label: 'Vitals', Icon: HeartPulse },
};

const PILL_WIDTH = 56;
const PILL_HEIGHT = 32;
const PILL_TOP = 8;
const PILL_SPRING = { damping: 20, stiffness: 260, mass: 0.7 };

/**
 * The app's primary navigation. Lives at the bottom of the screen (thumb
 * reach, the platform convention every reference app — Apple Health
 * included — uses for top-level nav, not the top-of-screen bar this
 * replaced) and is built from this app's own theme tokens instead of a
 * fixed dark bar, so it reads as this app's chrome rather than a debug strip
 * floating over an otherwise light UI. Icon-over-label per tab, rather than
 * icon-beside-label, is what lets six tabs each get a full-width column for
 * their own label instead of fighting each other for horizontal space.
 */
function BottomTabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  const theme = useTheme();
  // One shared pill behind the active icon, sprung to whichever tab is
  // active, reads as a single object sliding between slots rather than six
  // independently-colored icons — the same sliding-indicator idea as before,
  // just resized to sit behind the icon alone instead of spanning the whole
  // tab, matching how Material You's own bottom navigation bar highlights
  // its active icon.
  const segmentLayouts = useRef<Partial<Record<Tab, { x: number; width: number }>>>({});
  const pillX = useSharedValue(0);

  const handleSegmentLayout = (value: Tab) => (event: LayoutChangeEvent) => {
    const { x, width } = event.nativeEvent.layout;
    segmentLayouts.current[value] = { x, width };
    if (value === tab && pillX.value === 0) {
      // First-ever measurement for the already-active tab: snap directly
      // instead of springing in from the zero-width placeholder at x=0.
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
    // A real SafeAreaView for the bottom inset (gesture bar / home
    // indicator), not a manually-computed `insets.bottom` padding — see the
    // same reasoning this bar used for the top inset when it lived there.
    <SafeAreaView
      edges={['bottom', 'left', 'right']}
      style={{ backgroundColor: theme.colors.surface, borderTopWidth: 1, borderTopColor: theme.colors.hairline }}
    >
      <View style={{ flexDirection: 'row' }}>
        <Animated.View
          pointerEvents="none"
          style={[
            {
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
          const { label, Icon } = TAB_CONFIG[value];
          return (
            <Pressable
              key={value}
              onLayout={handleSegmentLayout(value)}
              onPress={() => handlePress(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={{ flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 8 }}
            >
              <View style={{ width: PILL_WIDTH, height: PILL_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
                <Icon size={20} color={isActive ? theme.action.ink : theme.colors.inkMuted} strokeWidth={2.25} />
              </View>
              <Text
                style={{ fontSize: 11, fontWeight: '700', color: isActive ? theme.action.base : theme.colors.inkMuted }}
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
function FadingScreen({ tab }: { tab: Tab }) {
  const opacity = useSharedValue(1);

  useEffect(() => {
    opacity.value = 0;
    opacity.value = withTiming(1, { duration: 180 });
  }, [tab, opacity]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));

  return (
    <Animated.View style={[{ flex: 1 }, style]}>
      <ActiveScreen tab={tab} />
    </Animated.View>
  );
}

function ActiveScreen({ tab }: { tab: Tab }) {
  switch (tab) {
    case 'home':
      return <HomeScreen />;
    case 'drugLab':
      return <DrugLabScreen />;
    case 'scanRx':
      return <PrescriptionScanScreen />;
    case 'rhythm':
      return <CircadianDashboardScreen />;
    case 'alarms':
      return <AlarmsScreen />;
    case 'vitals':
      return <VitalsScreen />;
  }
}

function App() {
  // Driven by our Zustand/MMKV theme store, not the OS scheme directly — the
  // app's theme preference ('light' | 'dark' | 'system') can diverge from
  // the device setting, and the status bar should follow whichever mode
  // NativeWind actually resolved to.
  const mode = useThemeMode();
  const [tab, setTab] = useState<Tab>('home');
  const activeAlarm = useActiveAlarmStore((state) => state.activeAlarm);

  useEffect(() => {
    initializeAlarmSystem().catch((error: unknown) => {
      console.warn('[App] failed to initialize the alarm system', error);
    });
    refreshAllStores().catch((error: unknown) => {
      console.warn('[App] failed to prime the shared stores', error);
    });
  }, []);

  return (
    // GestureHandlerRootView wraps the whole app, not just the screen that
    // uses it: react-native-gesture-handler (a @gorhom/bottom-sheet peer
    // dependency) requires exactly one root-level wrapper, and it has to be
    // an ancestor of every gesture-handling view, not a per-screen concern.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          {activeAlarm ? (
            // A fired alarm takes over the whole app — no tab bar, no way
            // back to the normal screens except resolving it (see
            // AlarmScreen's own doc comment for why).
            <>
              <StatusBar barStyle="light-content" />
              <AlarmScreen alarm={activeAlarm} />
            </>
          ) : (
            <>
              <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
              <FadingScreen tab={tab} />
              <BottomTabBar tab={tab} onChange={setTab} />
            </>
          )}
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
