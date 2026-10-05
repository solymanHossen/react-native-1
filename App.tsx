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
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
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

/** Dev-only switcher between the design-system demo, the DB verification screen, and the OCR pipeline demo — not a real navigator. */
function DevTabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  // Manual inset, not another nested SafeAreaView: the screens below each
  // already consume the top inset themselves, so stacking a second
  // edges=['top'] SafeAreaView here would pad for it twice.
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-row bg-black" style={{ paddingTop: insets.top }}>
      {(['home', 'drugLab', 'scanRx'] as const).map((value) => (
        <Pressable
          key={value}
          onPress={() => onChange(value)}
          className={`min-h-hit flex-1 items-center justify-center ${tab === value ? 'opacity-100' : 'opacity-50'}`}
        >
          <Text className="text-caption text-white">{TAB_LABEL[value]}</Text>
        </Pressable>
      ))}
    </View>
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
