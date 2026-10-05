/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import { useState } from 'react';
import { Pressable, StatusBar, Text, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import DrugLabScreen from './src/screens/DrugLabScreen';
import HomeScreen from './src/screens/HomeScreen';
import { useThemeMode } from './src/theme/useTheme';
import './global.css';

type Tab = 'home' | 'drugLab';

/** Dev-only switcher between the design-system demo and the DB verification screen — not a real navigator. */
function DevTabBar({ tab, onChange }: { tab: Tab; onChange: (tab: Tab) => void }) {
  // Manual inset, not another nested SafeAreaView: HomeScreen/DrugLabScreen
  // each already consume the top inset themselves, so stacking a second
  // edges=['top'] SafeAreaView here would pad for it twice.
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-row bg-black" style={{ paddingTop: insets.top }}>
      {(['home', 'drugLab'] as const).map((value) => (
        <Pressable
          key={value}
          onPress={() => onChange(value)}
          className={`min-h-hit flex-1 items-center justify-center ${tab === value ? 'opacity-100' : 'opacity-50'}`}
        >
          <Text className="text-caption text-white">{value === 'home' ? 'Design System' : 'Drug Lab'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function App() {
  // Driven by our Zustand/MMKV theme store, not the OS scheme directly — the
  // app's theme preference ('light' | 'dark' | 'system') can diverge from
  // the device setting, and the status bar should follow whichever mode
  // NativeWind actually resolved to.
  const mode = useThemeMode();
  const [tab, setTab] = useState<Tab>('home');

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} />
      <DevTabBar tab={tab} onChange={setTab} />
      {tab === 'home' ? <HomeScreen /> : <DrugLabScreen />}
    </SafeAreaProvider>
  );
}


export default App;
