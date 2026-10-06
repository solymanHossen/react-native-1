import { create } from 'zustand';
// Imports the leaf module directly, not the `../alarms` barrel: several
// files under `src/alarms/*` (e.g. `intakeConfirmation.ts`) import from this
// store module, and the barrel re-exports those same files — going through
// the barrel here would create an import cycle.
import { getActiveMedicationAlerts, type MedicationAlert } from '../alarms/sentinel';

interface SentinelState {
  alerts: MedicationAlert[];
  loading: boolean;
  refresh: () => Promise<void>;
}

/** Read-only mirror of the notification sentinel's own classification (see `alarms/sentinel.ts`'s `getActiveMedicationAlerts`) — this store never fires a notification itself, it's purely what the in-app refill/expiry banner renders from. */
export const useSentinelStore = create<SentinelState>((set) => ({
  alerts: [],
  loading: false,
  refresh: async () => {
    set({ loading: true });
    try {
      const alerts = await getActiveMedicationAlerts();
      set({ alerts, loading: false });
    } catch (error) {
      set({ loading: false });
      console.warn('[sentinelStore] failed to refresh', error);
    }
  },
}));
