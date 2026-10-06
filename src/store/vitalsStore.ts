import { create } from 'zustand';
import { initializeDatabase } from '../db';
import type { Vital } from '../db/types';

export interface LatestVitals {
  bloodGlucose: Vital | null;
  systolic: Vital | null;
  diastolic: Vital | null;
  weight: Vital | null;
  temperature: Vital | null;
}

interface VitalsState {
  latest: LatestVitals;
  loading: boolean;
  refresh: () => Promise<void>;
}

const EMPTY_LATEST: LatestVitals = { bloodGlucose: null, systolic: null, diastolic: null, weight: null, temperature: null };

/** Most-recent-reading cache for every vital type, one shared read instead of each screen (Home's metric cards, the Vitals tab) querying the same table independently. `VitalsScreen` calls `refresh()` again right after saving a new reading so both stay in sync immediately. */
export const useVitalsStore = create<VitalsState>((set) => ({
  latest: EMPTY_LATEST,
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const database = await initializeDatabase();
      const [bloodGlucose, systolic, diastolic, weight, temperature] = await Promise.all([
        database.vitals.listByType('BLOOD_SUGAR', 1),
        database.vitals.listByType('BP_SYS', 1),
        database.vitals.listByType('BP_DIA', 1),
        database.vitals.listByType('WEIGHT', 1),
        database.vitals.listByType('TEMPERATURE', 1),
      ]);
      set({
        latest: {
          bloodGlucose: bloodGlucose[0] ?? null,
          systolic: systolic[0] ?? null,
          diastolic: diastolic[0] ?? null,
          weight: weight[0] ?? null,
          temperature: temperature[0] ?? null,
        },
        loading: false,
      });
    } catch (error) {
      set({ loading: false });
      console.warn('[vitalsStore] failed to refresh', error);
    }
  },
}));
