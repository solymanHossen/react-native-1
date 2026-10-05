import type { DB } from '@op-engineering/op-sqlite';
import { closeDatabase, getDatabase } from './client';
import { ConflictService } from './services/conflictService';
import { DrugSearchService } from './services/drugSearchService';
import { IntakeLogsRepository } from './services/intakeLogsRepository';
import { MedicationsRepository } from './services/medicationsRepository';
import { SchedulesRepository } from './services/schedulesRepository';
import { VitalsRepository } from './services/vitalsRepository';

export interface MediusDatabase {
  db: DB;
  drugSearch: DrugSearchService;
  conflicts: ConflictService;
  medications: MedicationsRepository;
  schedules: SchedulesRepository;
  intakeLogs: IntakeLogsRepository;
  vitals: VitalsRepository;
}

let instance: Promise<MediusDatabase> | null = null;

/**
 * App-wide database lifecycle entry point. Call once (e.g. in App.tsx on
 * mount) and share the result — opening the encrypted connection, deriving
 * the key, importing the bundled seed and running migrations all happen
 * exactly once, on the first call.
 */
export function initializeDatabase(): Promise<MediusDatabase> {
  if (!instance) {
    instance = getDatabase()
      .then(async (db) => {
        const drugSearch = new DrugSearchService(db);
        // Not awaited: pre-builds the fuzzy-search cache in the background
        // instead of blocking app startup on it.
        drugSearch.warmFuzzyCache().catch((error: unknown) => {
          console.warn('[initializeDatabase] failed to warm the fuzzy search cache', error);
        });

        return {
          db,
          drugSearch,
          conflicts: new ConflictService(db),
          medications: new MedicationsRepository(db),
          schedules: new SchedulesRepository(db),
          intakeLogs: new IntakeLogsRepository(db),
          vitals: new VitalsRepository(db),
        };
      })
      .catch((error: unknown) => {
        instance = null;
        throw error;
      });
  }
  return instance;
}

export async function shutdownDatabase(): Promise<void> {
  await closeDatabase();
  instance = null;
}

export * from './types';
export { ConflictService } from './services/conflictService';
export { DrugSearchService } from './services/drugSearchService';
export { IntakeLogsRepository } from './services/intakeLogsRepository';
export { MedicationsRepository } from './services/medicationsRepository';
export { SchedulesRepository } from './services/schedulesRepository';
export { VitalsRepository } from './services/vitalsRepository';
