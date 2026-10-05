import { MMKV } from 'react-native-mmkv';

/**
 * Synchronous key-value store backing the theme engine. MMKV reads/writes
 * complete in the same tick (no Promise), which is what makes the boot-time
 * theme hydration in `src/theme/useTheme.ts` flash-free: the stored
 * preference is available before the first component renders.
 */
export const storage = new MMKV({ id: 'medius-app-storage' });
