import type { DB } from '@op-engineering/op-sqlite';
import { parseHighRiskInteractions, type DrugConflict } from '../types';

interface ActiveRegimenRow {
  medication_id: number;
  medication_name: string;
  generic_name: string;
  high_risk_interactions_json: string;
}

/**
 * Clinical drug-drug conflict sentinel. Checks a candidate generic against
 * every medication currently on an active schedule, in both directions —
 * real interaction datasets are usually documented asymmetrically (e.g.
 * Warfarin's entry lists Aspirin, but Aspirin's entry may not list Warfarin
 * back), so this checks the candidate's own interaction list against each
 * active generic, AND each active medication's interaction list against the
 * candidate, and merges the results.
 *
 * Returns every interaction found (moderate, severe, and contraindicated) —
 * each `DrugConflict` carries its own `severity` field, so the caller
 * decides the UI policy (hard-block on `contraindicated`, strong-warn on
 * `severe`, soft-warn on `moderate`) rather than this data-layer function
 * silently deciding what counts as worth surfacing.
 */
export class ConflictService {
  private readonly db: DB;

  constructor(db: DB) {
    this.db = db;
  }

  async checkDrugConflicts(newMedGeneric: string): Promise<DrugConflict[]> {
    const candidate = newMedGeneric.trim();
    if (!candidate) return [];

    const [candidateEntry, activeRegimens] = await Promise.all([
      this.findDirectoryEntryByGeneric(candidate),
      this.getActiveRegimens(),
    ]);

    const candidateInteractions = candidateEntry ? parseHighRiskInteractions(candidateEntry.high_risk_interactions_json) : [];
    const conflictsByMedicationId = new Map<number, DrugConflict>();

    for (const regimen of activeRegimens) {
      if (regimen.generic_name.toLowerCase() === candidate.toLowerCase()) {
        // Same drug already in the regimen is a duplicate-therapy question,
        // not a drug-drug interaction — out of scope for this sentinel.
        continue;
      }

      // Direction 1: does the candidate's own interaction list name this active drug?
      const fromCandidate = candidateInteractions.find((entry) => entry.generic.toLowerCase() === regimen.generic_name.toLowerCase());

      // Direction 2: does this active drug's interaction list name the candidate?
      const activeInteractions = parseHighRiskInteractions(regimen.high_risk_interactions_json);
      const fromActive = activeInteractions.find((entry) => entry.generic.toLowerCase() === candidate.toLowerCase());

      const match = fromCandidate ?? fromActive;
      if (!match) continue;

      const existing = conflictsByMedicationId.get(regimen.medication_id);
      if (existing && severityRank(existing.severity) >= severityRank(match.severity)) {
        continue; // keep the more severe of the two directions if both fired
      }

      conflictsByMedicationId.set(regimen.medication_id, {
        conflictingGeneric: regimen.generic_name,
        medicationId: regimen.medication_id,
        medicationName: regimen.medication_name,
        severity: match.severity,
        description: match.description,
      });
    }

    return Array.from(conflictsByMedicationId.values()).sort((a, b) => severityRank(b.severity) - severityRank(a.severity));
  }

  private async findDirectoryEntryByGeneric(generic: string): Promise<{ high_risk_interactions_json: string } | null> {
    // Plain equality, not MATCH: FTS5 MATCH tests token membership, not exact
    // field equality, and this single lookup-by-name isn't the hot
    // search-as-you-type path that needs the MATCH index (see
    // drugSearchService.ts for that).
    const { rows } = await this.db.execute(
      'SELECT high_risk_interactions_json FROM drug_directory WHERE generic_name = ? COLLATE NOCASE LIMIT 1;',
      [generic],
    );
    const row = rows[0];
    return row ? { high_risk_interactions_json: String(row.high_risk_interactions_json ?? '[]') } : null;
  }

  private async getActiveRegimens(): Promise<ActiveRegimenRow[]> {
    const { rows } = await this.db.execute(`
      SELECT DISTINCT m.id AS medication_id, m.name AS medication_name,
             dd.generic_name AS generic_name, dd.high_risk_interactions_json AS high_risk_interactions_json
      FROM medications m
      JOIN schedules s ON s.medication_id = m.id AND s.is_active = 1
      JOIN drug_directory dd ON dd.rowid = m.generic_id
      WHERE dd.generic_name IS NOT NULL
        AND (m.course_end_date IS NULL OR date(m.course_end_date) >= date('now', 'localtime'));
    `);

    return rows.map((row) => ({
      medication_id: Number(row.medication_id),
      medication_name: String(row.medication_name ?? ''),
      generic_name: String(row.generic_name ?? ''),
      high_risk_interactions_json: String(row.high_risk_interactions_json ?? '[]'),
    }));
  }
}

function severityRank(severity: DrugConflict['severity']): number {
  switch (severity) {
    case 'contraindicated':
      return 3;
    case 'severe':
      return 2;
    case 'moderate':
    default:
      return 1;
  }
}
