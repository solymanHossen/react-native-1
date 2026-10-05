/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { Camera, Home, Pill } from 'lucide-react-native';
import { useState, type ComponentType } from 'react';
import { Pressable, StatusBar, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import DrugLabScreen from './src/screens/DrugLabScreen';
import HomeScreen from './src/screens/HomeScreen';
import PrescriptionScanScreen from './src/screens/PrescriptionScanScreen';
import { useThemeMode } from './src/theme/useTheme';
import './global.css';

type Tab = 'home' | 'drugLab' | 'scanRx';

const TAB_CONFIG: Record<Tab, { label: string; Icon: ComponentType<{ size?: number; color?: string; strokeWidth?: number }> }> = {
  home: { label: 'Home', Icon: Home },
  drugLab: { label: 'Medications', Icon: Pill },
  scanRx: { label: 'Scan Rx', Icon: Camera },
};

const BAR_BACKGROUND = '#0B0E14';
const SEGMENT_ACTIVE_BG = '#2563EB';
const ACTIVE_COLOR = '#FFFFFF';
const INACTIVE_COLOR = '#8891A7';

/** Dev-only switcher between the design-system demo, the DB verification screen, and the OCR pipeline demo — not a real navigator. */
function DevTabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    // A real SafeAreaView, not a manually-computed `insets.top` padding: the
    // hook-based value was landing on or near 0 on a notched/dynamic-island
    // device, leaving labels nearly behind the status bar — a native
    // SafeAreaView measures the actual inset itself instead of trusting a
    // value read at an arbitrary render. Screens below keep excluding 'top'
    // from their own SafeAreaView (see each screen's comment) so this is the
    // only place the top inset is ever consumed.
    //
    // Colors are plain hex via `style`, not NativeWind classNames: this bar
    // has to render correctly before anything else does, so it shouldn't
    // depend on NativeWind's class resolution having run yet.
    <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: BAR_BACKGROUND }}>
      {/* A segmented control, not plain text links: a filled pill for the
          active segment reads as "one of three mutually-exclusive views" at
          a glance, and matches the fully-rounded pill language used
          everywhere else in this app (buttons, status pills, search field)
          instead of introducing a different, flatter nav idiom. */}
      <View style={{ flexDirection: 'row', gap: 6, padding: 6 }}>
        {(['home', 'drugLab', 'scanRx'] as const).map((value) => {
          const isActive = tab === value;
          const { label, Icon } = TAB_CONFIG[value];
          return (
            <Pressable
              key={value}
              onPress={() => onChange(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={{
                flex: 1,
                minHeight: 56,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 6,
                borderRadius: 999,
                backgroundColor: isActive ? SEGMENT_ACTIVE_BG : 'transparent',
              }}
            >
              <Icon size={15} color={isActive ? ACTIVE_COLOR : INACTIVE_COLOR} strokeWidth={2.25} />
              <Text style={{ fontSize: 12, fontWeight: '700', color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR }} numberOfLines={1}>
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </SafeAreaView>
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
  }
}

function App() {
  // Driven by our Zustand/MMKV theme store, not the OS scheme directly — the
  // app's theme preference ('light' | 'dark' | 'system') can diverge from
  // the device setting, and the status bar should follow whichever mode
  // NativeWind actually resolved to.
  const mode = useThemeMode();
  const [tab, setTab] = useState<Tab>('home');

  return (
    // GestureHandlerRootView wraps the whole app, not just the screen that
    // uses it: react-native-gesture-handler (a @gorhom/bottom-sheet peer
    // dependency) requires exactly one root-level wrapper, and it has to be
    // an ancestor of every gesture-handling view, not a per-screen concern.
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <BottomSheetModalProvider>
          <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
          <DevTabBar tab={tab} onChange={setTab} />
          <ActiveScreen tab={tab} />
        </BottomSheetModalProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
