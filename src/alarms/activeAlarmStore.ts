import { create } from 'zustand';
import type { ActiveAlarm } from './types';

interface ActiveAlarmState {
  activeAlarm: ActiveAlarm | null;
  setActiveAlarm: (alarm: ActiveAlarm) => void;
  incrementSnooze: () => void;
  clearActiveAlarm: () => void;
}

/**
 * Plain Zustand store, same pattern as the theme store: App.tsx subscribes
 * to `activeAlarm` and renders the full-screen AlarmScreen instead of the
 * normal tab UI whenever it's non-null — this is what makes the alarm
 * "unmissable" even while the app is already open on some other tab.
 */
export const useActiveAlarmStore = create<ActiveAlarmState>((set) => ({
  activeAlarm: null,
  setActiveAlarm: (alarm) => set({ activeAlarm: alarm }),
  incrementSnooze: () =>
    set((state) => (state.activeAlarm ? { activeAlarm: { ...state.activeAlarm, snoozeCount: state.activeAlarm.snoozeCount + 1 } } : state)),
  clearActiveAlarm: () => set({ activeAlarm: null }),
}));
