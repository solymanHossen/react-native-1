/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { BottomSheetModalProvider } from '@gorhom/bottom-sheet';
import { useState } from 'react';
import { Pressable, StatusBar, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import DrugLabScreen from './src/screens/DrugLabScreen';
import HomeScreen from './src/screens/HomeScreen';
import PrescriptionScanScreen from './src/screens/PrescriptionScanScreen';
import { useThemeMode } from './src/theme/useTheme';
import './global.css';

type Tab = 'home' | 'drugLab' | 'scanRx';

const TAB_LABEL: Record<Tab, string> = {
  home: 'Design System',
  drugLab: 'Drug Lab',
  scanRx: 'Scan Rx',
};

const BAR_BACKGROUND = '#0B0E14';
const ACTIVE_COLOR = '#FFFFFF';
const INACTIVE_COLOR = '#6B7280';
const INDICATOR_COLOR = '#2563EB';

/** Dev-only switcher between the design-system demo, the DB verification screen, and the OCR pipeline demo — not a real navigator. */
function DevTabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  return (
    // A real SafeAreaView, not a manually-computed `insets.top` padding: the
    // hook-based value was landing on or near 0 on a notched/dynamic-island
    // device, leaving these labels nearly behind the status bar — a native
    // SafeAreaView measures the actual inset itself instead of trusting a
    // value read at an arbitrary render. Screens below keep excluding 'top'
    // from their own SafeAreaView (see each screen's comment) so this is the
    // only place the top inset is ever consumed.
    //
    // Colors are plain hex via `style`, not NativeWind classNames: this bar
    // has to render correctly before anything else does, so it shouldn't
    // depend on NativeWind's class resolution having run yet.
    <SafeAreaView edges={['top', 'left', 'right']} style={{ backgroundColor: BAR_BACKGROUND }}>
      <View style={{ flexDirection: 'row' }}>
        {(['home', 'drugLab', 'scanRx'] as const).map((value) => {
          const isActive = tab === value;
          return (
            <Pressable
              key={value}
              onPress={() => onChange(value)}
              accessibilityRole="tab"
              accessibilityState={{ selected: isActive }}
              style={{ flex: 1, minHeight: 56, alignItems: 'center', justifyContent: 'center' }}
            >
              <Text style={{ fontSize: 13, fontWeight: '600', color: isActive ? ACTIVE_COLOR : INACTIVE_COLOR }}>
                {TAB_LABEL[value]}
              </Text>
              <View
                style={{
                  marginTop: 6,
                  height: 3,
                  width: 28,
                  borderRadius: 2,
                  backgroundColor: isActive ? INDICATOR_COLOR : 'transparent',
                }}
              />
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
